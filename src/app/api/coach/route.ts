import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zonedParts } from "@/lib/analytics/timezone";
import { anthropic, COACH_DAILY_LIMIT, COACH_MODEL, coachConfigured } from "@/lib/coach/client";
import { buildCoachContext } from "@/lib/coach/context";
import { COACH_SYSTEM_PROMPT } from "@/lib/coach/prompt";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/data/settings";
import { getCurrentUser } from "@/lib/session";

const MAX_TURNS = 20;

const bodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(4000) }))
    .min(1)
    .max(MAX_TURNS)
    .refine((m) => m[0].role === "user" && m[m.length - 1].role === "user", "Conversation must start and end with a user message.")
    .refine((m) => m.every((x, i) => i === 0 || x.role !== m[i - 1].role), "Messages must alternate."),
});

const json = (body: unknown, status: number) => Response.json(body, { status });

/**
 * Streams the coach's answer. The first line of the response is JSON with the
 * trade references ({"refs": {"T1": "<trade id>", ...}}); the rest is text.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!coachConfigured()) return json({ error: "The AI coach isn't configured on this server." }, 503);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, 400);

  // Daily question limit, per the user's own trading day.
  const { timeZone } = await getSettings(user.id);
  const today = zonedParts(new Date(), timeZone).date;
  const usage = await prisma.coachUsage.upsert({
    where: { userId_date: { userId: user.id, date: today } },
    create: { userId: user.id, date: today, count: 1 },
    update: { count: { increment: 1 } },
  });
  if (usage.count > COACH_DAILY_LIMIT) {
    return json({ error: `You've reached today's limit of ${COACH_DAILY_LIMIT} coach questions. It resets tomorrow.` }, 429);
  }

  const context = await buildCoachContext(user.id);
  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (text: string) => controller.enqueue(encoder.encode(text));
      write(`${JSON.stringify({ refs: context.refs })}\n`);
      try {
        const stream = anthropic().beta.messages.stream(
          {
            model: COACH_MODEL,
            max_tokens: 64000,
            output_config: { effort: "medium" },
            // On a safety decline, the API retries on Anthropic's recommended fallback model.
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            // Caches the stable prefix (instructions + journal data) across follow-up questions.
            cache_control: { type: "ephemeral" },
            system: [
              { type: "text", text: COACH_SYSTEM_PROMPT },
              { type: "text", text: `<journal_data>\n${context.json}\n</journal_data>` },
            ],
            messages: parsed.data.messages,
          },
          { signal: request.signal },
        );
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") write(event.delta.text);
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          write("\n\nI can't help with that request. Try asking about your trading performance, habits or risk instead.");
        } else if (final.stop_reason === "max_tokens") {
          write("\n\n(The answer was cut off. Ask me to continue.)");
        }
      } catch (error) {
        let message = "Something went wrong reaching the coach. Please try again.";
        if (error instanceof Anthropic.RateLimitError) message = "The coach is busy right now. Please try again in a minute.";
        else if (error instanceof Anthropic.AuthenticationError) message = "The AI coach's API key is invalid. Ask the site administrator to check it.";
        else if (error instanceof Anthropic.APIUserAbortError) message = "";
        else console.error("Coach request failed", error);
        if (message) write(`\n\n⚠️ ${message}`);
        // A failed answer shouldn't use up one of the day's questions.
        await prisma.coachUsage
          .update({ where: { userId_date: { userId: user.id, date: today } }, data: { count: { decrement: 1 } } })
          .catch(() => {});
      } finally {
        try {
          controller.close();
        } catch {
          // The browser already went away.
        }
      }
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
