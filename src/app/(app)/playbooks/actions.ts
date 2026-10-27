"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { bumpDataVersion } from "@/lib/data/sync";
import { requireUser } from "@/lib/session";
import { fieldErrors, type FormState } from "@/lib/validation";

const MAX_RULES = 20;

const playbookSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(60),
  description: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : null), z.string().max(2000).nullable()),
  rules: z
    .string()
    .transform((v) => [...new Set(v.split("\n").map((l) => l.replace(/^[-*•\d.)\s]+/, "").trim()).filter(Boolean))])
    .refine((r) => r.length >= 1, "Add at least one rule, one per line.")
    .refine((r) => r.length <= MAX_RULES, `Use at most ${MAX_RULES} rules.`)
    .refine((r) => r.every((x) => x.length <= 200), "Keep each rule under 200 characters."),
});

export async function savePlaybook(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = playbookSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    rules: formData.get("rules") ?? "",
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const { name, description, rules } = parsed.data;
  const id = String(formData.get("id") ?? "");

  const clash = await prisma.playbook.findFirst({ where: { userId: user.id, name, NOT: id ? { id } : undefined } });
  if (clash) return { errors: { name: ["You already have a playbook with this name."] } };

  if (id) {
    const existing = await prisma.playbook.findFirst({ where: { id, userId: user.id }, include: { rules: true } });
    if (!existing) return { message: "Playbook not found." };
    // Rules whose wording is unchanged keep their id, so trades stay ticked against them.
    const byText = new Map(existing.rules.map((r) => [r.text, r.id]));
    await prisma.$transaction([
      prisma.playbookRule.deleteMany({ where: { playbookId: id, text: { notIn: rules } } }),
      prisma.playbook.update({ where: { id }, data: { name, description } }),
      ...rules.map((text, order) =>
        byText.has(text)
          ? prisma.playbookRule.update({ where: { id: byText.get(text)! }, data: { order } })
          : prisma.playbookRule.create({ data: { playbookId: id, text, order } }),
      ),
    ]);
  } else {
    await prisma.playbook.create({
      data: { userId: user.id, name, description, rules: { create: rules.map((text, order) => ({ text, order })) } },
    });
  }
  await bumpDataVersion(user.id);
  revalidatePath("/", "layout");
  return { ok: true, message: "Playbook saved." };
}

export async function deletePlaybook(formData: FormData) {
  const user = await requireUser();
  // Trades keep their data; they just lose the playbook link and grade.
  const { count } = await prisma.playbook.deleteMany({ where: { id: String(formData.get("id") ?? ""), userId: user.id } });
  if (count) await bumpDataVersion(user.id);
  revalidatePath("/", "layout");
}
