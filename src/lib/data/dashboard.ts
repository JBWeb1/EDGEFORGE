import "server-only";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db";
import { computeClosedResults } from "@/lib/analytics/trade-math";
import { breakdown, dailyEquityCurve, summarize } from "@/lib/analytics/metrics";
import { generateInsights } from "@/lib/analytics/insights";
import { toTradeInput } from "@/lib/data/trades";

export const RANGES = {
  "30d": { label: "30 days", days: 30 },
  "90d": { label: "90 days", days: 90 },
  "1y": { label: "1 year", days: 365 },
  all: { label: "All time", days: null },
} as const;

export type RangeKey = keyof typeof RANGES;

export async function getDashboardData(
  userId: string,
  opts: { accountId?: string; range: RangeKey; now?: Date },
) {
  const accounts = await prisma.tradingAccount.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  if (accounts.length === 0) return { kind: "no-accounts" as const };

  // Statistics never mix currencies: "all accounts" is only offered when every
  // account uses the same currency.
  const currencies = [...new Set(accounts.map((a) => a.currency))];
  const canCombine = currencies.length === 1;
  const selected =
    accounts.find((a) => a.id === opts.accountId) ?? (canCombine ? null : accounts[0]);
  const scope = selected ? [selected] : accounts;
  const currency = scope[0].currency;

  const trades = await prisma.trade.findMany({
    where: { userId, accountId: { in: scope.map((a) => a.id) } },
  });
  const all = computeClosedResults(trades.map(toTradeInput));
  const open = trades
    .filter((t) => t.exitPrice === null)
    .sort((a, b) => b.entryAt.getTime() - a.entryAt.getTime());

  // Within a date range, the curve starts at the balance on the range's first
  // day: starting balance plus everything realised before it.
  const days = RANGES[opts.range].days;
  const from = days === null ? null : new Date((opts.now ?? new Date()).getTime() - days * 86_400_000);
  const before = from ? all.filter((r) => r.trade.exitAt! < from) : [];
  const results = from ? all.filter((r) => r.trade.exitAt! >= from) : all;
  const initialBalance = scope.reduce((acc, a) => acc.plus(a.startingBalance.toString()), new Decimal(0));
  const rangeStart = before.reduce((acc, r) => acc.plus(r.netPnl), initialBalance);

  return {
    kind: "ok" as const,
    accounts: accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency })),
    canCombine,
    selectedAccountId: selected?.id ?? null,
    currency,
    openTrades: open.length,
    openPositions: open.map((t) => ({
      id: t.id,
      symbol: t.symbol,
      direction: t.direction,
      quantity: t.quantity.toString(),
      multiplier: t.multiplier.toString(),
      entryPrice: t.entryPrice.toString(),
      stopLoss: t.stopLoss?.toString() ?? null,
      fees: t.fees.toString(),
      entryAt: t.entryAt.toISOString(),
    })),
    summary: summarize(results, rangeStart),
    curve: dailyEquityCurve(results, rangeStart),
    rangeStartBalance: rangeStart,
    bySetup: breakdown(results, "setup"),
    bySymbol: breakdown(results, "symbol"),
    byWeekday: breakdown(results, "weekday"),
    byRules: breakdown(results, "rules"),
    byEmotion: breakdown(results, "emotion"),
    insights: generateInsights(results),
    recent: [...results].reverse().slice(0, 8),
  };
}
