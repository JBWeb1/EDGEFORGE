"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { DATE_RE } from "@/lib/data/days";
import { bumpDataVersion } from "@/lib/data/sync";
import { requireUser } from "@/lib/session";
import { fieldErrors, type FormState } from "@/lib/validation";

const text = z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : null), z.string().max(10_000).nullable());

const noteSchema = z.object({
  date: z.string().regex(DATE_RE, "Invalid date."),
  premarket: text,
  review: text,
  mood: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(1).max(5).nullable()),
});

export async function saveDailyNote(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = noteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const { date, ...data } = parsed.data;
  await prisma.dailyNote.upsert({
    where: { userId_date: { userId: user.id, date } },
    create: { userId: user.id, date, ...data },
    update: data,
  });
  await bumpDataVersion(user.id);
  revalidatePath(`/days/${date}`);
  return { ok: true, message: "Saved." };
}
