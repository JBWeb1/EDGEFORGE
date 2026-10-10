"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { accountSchema, fieldErrors, type FormState } from "@/lib/validation";

export async function saveAccount(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = accountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const id = formData.get("id");
  if (typeof id === "string" && id) {
    const { count } = await prisma.tradingAccount.updateMany({ where: { id, userId: user.id }, data: parsed.data });
    if (count === 0) return { message: "Account not found." };
  } else {
    await prisma.tradingAccount.create({ data: { ...parsed.data, userId: user.id } });
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Account saved." };
}

export async function deleteAccount(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  // Cascades to the account's trades and import history.
  await prisma.tradingAccount.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/", "layout");
}
