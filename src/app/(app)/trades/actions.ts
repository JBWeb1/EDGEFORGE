"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { bumpDataVersion } from "@/lib/data/sync";
import { requireUser } from "@/lib/session";
import { parseTags } from "@/lib/tags";
import { fieldErrors, tradeSchema, type FormState } from "@/lib/validation";

function formValues(formData: FormData) {
  const values: Record<string, string> = {};
  for (const [k, v] of formData) if (typeof v === "string" && !k.startsWith("$") && k !== "rulesMet") values[k] = v;
  values.rulesMet = formData.getAll("rulesMet").map(String).join(",");
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

  const { tags, ...fields } = parsed.data;

  // Checklist: only rules that belong to the chosen playbook (and this user) count.
  let ruleIds: string[] = [];
  if (fields.playbookId) {
    const playbook = await prisma.playbook.findFirst({
      where: { id: fields.playbookId, userId: user.id },
      select: { rules: { select: { id: true } } },
    });
    if (!playbook) return { errors: { playbookId: ["Choose one of your playbooks."] }, values, attempt };
    const wanted = new Set(formData.getAll("rulesMet").map(String));
    ruleIds = playbook.rules.map((r) => r.id).filter((id) => wanted.has(id));
  }
  const rulesMet = ruleIds.map((id) => ({ id }));
  const connectTags = tags.map((name) => ({
    where: { userId_name: { userId: user.id, name } },
    create: { userId: user.id, name },
  }));
  const id = values.id;
  let tradeId: string;
  if (id) {
    const existing = await prisma.trade.findFirst({ where: { id, userId: user.id }, select: { id: true } });
    if (!existing) return { message: "Trade not found.", values, attempt };
    // Editing a trade manually detaches it from import de-duplication.
    await prisma.trade.update({
      where: { id },
      data: { ...fields, fingerprint: null, tags: { set: [], connectOrCreate: connectTags }, rulesMet: { set: rulesMet } },
    });
    tradeId = id;
  } else {
    const trade = await prisma.trade.create({
      data: { ...fields, userId: user.id, tags: { connectOrCreate: connectTags }, rulesMet: { connect: rulesMet } },
    });
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

const MAX_BULK = 500;

/** Applies one change to many of the user's trades at once. */
export async function bulkEditTrades(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const requested = [...new Set(formData.getAll("ids").map(String))].slice(0, MAX_BULK);
  if (requested.length === 0) return { message: "Select at least one trade." };
  // Only ever touch trades this user owns.
  const owned = await prisma.trade.findMany({ where: { id: { in: requested }, userId: user.id }, select: { id: true } });
  const ids = owned.map((t) => t.id);
  if (ids.length === 0) return { message: "No matching trades." };
  const action = String(formData.get("bulkAction") ?? "");
  const value = String(formData.get("bulkValue") ?? "").trim();

  if (action === "tag") {
    const { tags, error } = parseTags(value);
    if (error || tags.length === 0) return { message: error ?? "Enter at least one tag." };
    for (const name of tags) {
      await prisma.tag.upsert({
        where: { userId_name: { userId: user.id, name } },
        create: { userId: user.id, name, trades: { connect: ids.map((id) => ({ id })) } },
        update: { trades: { connect: ids.map((id) => ({ id })) } },
      });
    }
  } else if (action === "playbook") {
    const playbook = value ? await prisma.playbook.findFirst({ where: { id: value, userId: user.id } }) : null;
    if (value && !playbook) return { message: "Choose one of your playbooks." };
    // A different playbook means different rules, so the old checklist no longer applies.
    await prisma.$transaction(
      ids.map((id) => prisma.trade.update({ where: { id }, data: { playbookId: playbook?.id ?? null, rulesMet: { set: [] } } })),
    );
  } else if (action === "setup") {
    if (value.length > 80) return { message: "Setup names are limited to 80 characters." };
    await prisma.trade.updateMany({ where: { id: { in: ids } }, data: { setup: value || null } });
  } else if (action === "delete") {
    await prisma.trade.deleteMany({ where: { id: { in: ids }, userId: user.id } });
  } else {
    return { message: "Choose what to change." };
  }

  await bumpDataVersion(user.id);
  revalidatePath("/", "layout");
  const verb = { tag: "Tagged", playbook: "Updated", setup: "Updated", delete: "Deleted" }[action];
  return { ok: true, message: `${verb} ${ids.length} trade${ids.length === 1 ? "" : "s"}.` };
}
