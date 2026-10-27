import "server-only";
import type { Trade } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** Converts a stored trade into the string values the trade form edits. */
export function tradeToFormValues(
  t: Trade & { tags?: { name: string }[]; rulesMet?: { id: string }[] },
): Record<string, string> {
  const s = (v: { toString(): string } | null) => (v === null ? "" : v.toString());
  return {
    id: t.id,
    accountId: t.accountId,
    symbol: t.symbol,
    direction: t.direction,
    quantity: s(t.quantity),
    multiplier: s(t.multiplier),
    entryPrice: s(t.entryPrice),
    entryAt: t.entryAt.toISOString(),
    exitPrice: s(t.exitPrice),
    exitAt: t.exitAt?.toISOString() ?? "",
    stopLoss: s(t.stopLoss),
    takeProfit: s(t.takeProfit),
    fees: s(t.fees),
    setup: t.setup ?? "",
    strategy: t.strategy ?? "",
    emotion: t.emotion ?? "",
    followedRules: t.followedRules === null ? "" : t.followedRules ? "yes" : "no",
    confidence: t.confidence === null ? "" : String(t.confidence),
    notes: t.notes ?? "",
    screenshotUrl: t.screenshotUrl ?? "",
    tags: t.tags?.map((x) => x.name).join(", ") ?? "",
    maePrice: s(t.maePrice),
    mfePrice: s(t.mfePrice),
    playbookId: t.playbookId ?? "",
    rulesMet: t.rulesMet?.map((r) => r.id).join(",") ?? "",
  };
}

/** The user's playbooks with their checklist rules, for the trade form. */
export async function playbookOptions(userId: string) {
  return prisma.playbook.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, rules: { orderBy: { order: "asc" }, select: { id: true, text: true } } },
  });
}

/** Tags the user has created, for suggestions and filters. */
export async function knownTags(userId: string) {
  const rows = await prisma.tag.findMany({ where: { userId }, select: { name: true }, orderBy: { name: "asc" } });
  return rows.map((r) => r.name);
}

/** Setups the user has used before, for form suggestions. */
export async function knownSetups(userId: string) {
  const rows = await prisma.trade.findMany({
    where: { userId, setup: { not: null } },
    distinct: ["setup"],
    select: { setup: true },
    take: 50,
  });
  return rows.map((r) => r.setup!).sort();
}
