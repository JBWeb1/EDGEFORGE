import "server-only";
import type { Trade } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { gradeFromChecklist } from "@/lib/analytics/excursion";
import type { TradeInput } from "@/lib/analytics/trade-math";

export type TradeFilter = {
  accountId?: string;
  status?: "open" | "closed";
  symbol?: string;
  /** Matches symbol, setup, strategy or notes (case-insensitive). */
  q?: string;
  setup?: string;
  tag?: string;
  playbookId?: string;
  /** Entry time window, as UTC instants. */
  from?: Date;
  to?: Date;
};

export function listTrades(userId: string, filter: TradeFilter = {}) {
  const q = filter.q?.trim();
  return prisma.trade.findMany({
    where: {
      userId,
      ...(filter.accountId ? { accountId: filter.accountId } : {}),
      ...(filter.status === "open" ? { exitPrice: null } : filter.status === "closed" ? { exitPrice: { not: null } } : {}),
      ...(filter.symbol ? { symbol: filter.symbol.toUpperCase() } : {}),
      ...(filter.setup ? { setup: filter.setup } : {}),
      ...(filter.tag ? { tags: { some: { name: filter.tag } } } : {}),
      ...(filter.playbookId ? { playbookId: filter.playbookId } : {}),
      ...(filter.from || filter.to ? { entryAt: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lt: filter.to } : {}) } } : {}),
      ...(q
        ? {
            OR: [
              { symbol: { contains: q, mode: "insensitive" as const } },
              { setup: { contains: q, mode: "insensitive" as const } },
              { strategy: { contains: q, mode: "insensitive" as const } },
              { notes: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: [{ entryAt: "desc" }, { id: "desc" }],
    include: { account: { select: { name: true, currency: true } }, ...TRADE_EXTRAS },
  });
}

export function getTrade(userId: string, id: string) {
  return prisma.trade.findFirst({
    where: { id, userId },
    include: {
      account: { select: { name: true, currency: true } },
      ...TRADE_EXTRAS,
      rulesMet: { select: { id: true, text: true } },
      playbook: { select: { id: true, name: true, _count: { select: { rules: true } }, rules: { orderBy: { order: "asc" }, select: { id: true, text: true } } } },
    },
  });
}

/** Include this to load tag names alongside trades. */
export const TAG_SELECT = { select: { name: true }, orderBy: { name: "asc" as const } };

/** Relations the analytics need: tags, the playbook and how many of its rules were met. */
export const TRADE_EXTRAS = {
  tags: TAG_SELECT,
  playbook: { select: { id: true, name: true, _count: { select: { rules: true } } } },
  _count: { select: { rulesMet: true } },
};

type TradeWithExtras = Trade & {
  tags?: { name: string }[];
  playbook?: { name: string; _count: { rules: number } } | null;
  _count?: { rulesMet: number };
};

/** Maps a database trade onto the analytics engine's input shape. */
export function toTradeInput(t: TradeWithExtras): TradeInput {
  return {
    id: t.id,
    symbol: t.symbol,
    direction: t.direction,
    quantity: t.quantity.toString(),
    multiplier: t.multiplier.toString(),
    entryPrice: t.entryPrice.toString(),
    entryAt: t.entryAt,
    exitPrice: t.exitPrice?.toString() ?? null,
    exitAt: t.exitAt,
    stopLoss: t.stopLoss?.toString() ?? null,
    takeProfit: t.takeProfit?.toString() ?? null,
    fees: t.fees.toString(),
    setup: t.setup,
    strategy: t.strategy,
    emotion: t.emotion,
    followedRules: t.followedRules,
    tags: t.tags?.map((x) => x.name) ?? [],
    maePrice: t.maePrice?.toString() ?? null,
    mfePrice: t.mfePrice?.toString() ?? null,
    playbook: t.playbook?.name ?? null,
    grade: t.playbook && t._count ? gradeFromChecklist(t._count.rulesMet, t.playbook._count.rules) : null,
  };
}
