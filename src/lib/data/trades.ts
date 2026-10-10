import "server-only";
import type { Trade } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { TradeInput } from "@/lib/analytics/trade-math";

export type TradeFilter = {
  accountId?: string;
  status?: "open" | "closed";
  symbol?: string;
};

export function listTrades(userId: string, filter: TradeFilter = {}) {
  return prisma.trade.findMany({
    where: {
      userId,
      ...(filter.accountId ? { accountId: filter.accountId } : {}),
      ...(filter.status === "open" ? { exitPrice: null } : filter.status === "closed" ? { exitPrice: { not: null } } : {}),
      ...(filter.symbol ? { symbol: filter.symbol.toUpperCase() } : {}),
    },
    orderBy: [{ entryAt: "desc" }, { id: "desc" }],
    include: { account: { select: { name: true, currency: true } } },
  });
}

export function getTrade(userId: string, id: string) {
  return prisma.trade.findFirst({
    where: { id, userId },
    include: { account: { select: { name: true, currency: true } } },
  });
}

/** Maps a database trade onto the analytics engine's input shape. */
export function toTradeInput(t: Trade): TradeInput {
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
  };
}
