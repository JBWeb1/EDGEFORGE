import type { Metadata } from "next";
import { LogoMark } from "@/components/logo";
import { ButtonLink, Card, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import { zonedParts } from "@/lib/analytics/timezone";
import { COACH_DAILY_LIMIT, coachConfigured } from "@/lib/coach/client";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/data/settings";
import { requireUser } from "@/lib/session";
import { CoachChat } from "./coach-chat";

export const metadata: Metadata = { title: "AI coach" };

export default async function CoachPage() {
  const user = await requireUser();
  const [{ timeZone }, closed] = await Promise.all([
    getSettings(user.id),
    prisma.trade.count({ where: { userId: user.id, exitPrice: { not: null } } }),
  ]);
  const today = zonedParts(new Date(), timeZone).date;
  const used = await prisma.coachUsage.findUnique({ where: { userId_date: { userId: user.id, date: today } } });

  return (
    <>
      <PageHeader title="AI trading coach" description="Personal analysis of your own journal. Every insight is traceable to your trades." />
      {!coachConfigured() ? (
        <EmptyState title="The AI coach isn't switched on yet">
          The server needs an <code className="text-navy-200">ANTHROPIC_API_KEY</code> environment variable. Add it and restart EDGEFORGE.
        </EmptyState>
      ) : closed === 0 ? (
        <EmptyState title="Log some trades first" action={<ButtonLink href="/import">Import trades</ButtonLink>}>
          The coach works from your closed trades. The more you record (setups, emotions, rule adherence, notes), the sharper its feedback.
        </EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
          <CoachChat remaining={Math.max(0, COACH_DAILY_LIMIT - (used?.count ?? 0))} />
          <Card className="h-fit text-sm text-navy-300">
            <CardTitle action={<LogoMark className="h-6 w-6" />}>How it works</CardTitle>
            <ul className="list-disc space-y-2 pl-5">
              <li>The coach reads your statistics, breakdowns, rule breaches, daily journal and up to your 300 most recent trades.</li>
              <li>Trade references like <span className="rounded bg-electric/15 px-1 text-xs text-electric-soft">T12</span> link to the trades behind a claim.</li>
              <li>It describes patterns in your data. It doesn&apos;t predict markets or give financial advice.</li>
              <li>{closed < 20 ? `With ${closed} closed trades, treat its patterns as early signals.` : `Based on ${closed} closed trades.`}</li>
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}
