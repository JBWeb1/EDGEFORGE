"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { bumpDataVersion } from "@/lib/data/sync";
import { requireUser } from "@/lib/session";
import { fieldErrors, settingsSchema, type FormState } from "@/lib/validation";

export async function saveSettings(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = settingsSchema.safeParse({ timeZone: formData.get("timeZone") });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  await prisma.userSettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...parsed.data },
    update: parsed.data,
  });
  // Trading days change with the time zone, so every open tab should refresh.
  await bumpDataVersion(user.id);
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved." };
}
