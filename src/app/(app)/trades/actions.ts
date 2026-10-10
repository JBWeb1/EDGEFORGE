"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { bumpDataVersion } from "@/lib/data/sync";
import { requireUser } from "@/lib/session";
import { fieldErrors, tradeSchema, type FormState } from "@/lib/validation";

function formValues(formData: FormData) {
  const values: Record<string, string> = {};
  for (const [k, v] of formData) if (typeof v === "string" && !k.startsWith("$")) values[k] = v;
  return values;
}

export async function saveTrade(prev: FormState, formData: FormData): Promise<FormState> {
  const attempt = (prev.attempt ?? 0) + 1;
  const user = await requireUser();
  const values = formValues(formData);
  const parsed = tradeSchema.safeParse(values);
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values, attempt, message: "Please fix the highlighted fields." };
  }

  const account = await prisma.tradingAccount.findFirst({ where: { id: parsed.data.accountId, userId: user.id } });
  if (!account) return { errors: { accountId: ["Choose one of your accounts."] }, values, attempt };

  const id = values.id;
  let tradeId: string;
  if (id) {
    // Editing a trade manually detaches it from import de-duplication.
    const { count } = await prisma.trade.updateMany({
      where: { id, userId: user.id },
      data: { ...parsed.data, fingerprint: null },
    });
    if (count === 0) return { message: "Trade not found.", values, attempt };
    tradeId = id;
  } else {
    const trade = await prisma.trade.create({ data: { ...parsed.data, userId: user.id } });
    tradeId = trade.id;
  }
  await bumpDataVersion(user.id);
  revalidatePath("/", "layout");
  redirect(`/trades/${tradeId}`);
}

export async function deleteTrade(formData: FormData) {
  const user = await requireUser();
  const { count } = await prisma.trade.deleteMany({ where: { id: String(formData.get("id") ?? ""), userId: user.id } });
  if (count) await bumpDataVersion(user.id);
  revalidatePath("/", "layout");
  redirect("/trades");
}
