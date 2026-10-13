import "server-only";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db";
import { computeClosedResults } from "@/lib/analytics/trade-math";
import { breakdown, dailyEquityCurve, summarize } from "@/lib/analytics/metrics";
import { generateInsights } from "@/lib/analytics/insights";
import { findViolations, todayStatus, type RuleId, type Violation } from "@/lib/analytics/rules";
import { getSettings } from "@/lib/data/settings";
import { TAG_SELECT, toTradeInput } from "@/lib/data/trades";

export const RANGES = {
  "30d": { label: "30 days", days: 30 },
  "90d": { label: "90 days", days: 90 },
  "1y": { label: "1 year", days: 365 },
  all: { label: "All time", days: null },
} as const;

export type RangeKey = keyof typeof RANGES;

/**
 * Which accounts a view covers. Statistics never mix currencies: "all accounts"
 * is only offered when every account uses the same currency.
 */
export function resolveScope<A extends { id: string; currency: string }>(accounts: A[], accountId?: string) {
  const canCombine = new Set(accounts.map((a) => a.currency)).size === 1;
  const selected = accounts.find((a) => a.id === accountId) ?? (canCombine ? null : accounts[0]);
  const scope = selected ? [selected] : accounts;
  return { canCombine, selected, scope, currency: scope[0].currency };
}

export async function getDashboardData(
  userId: string,
  opts: { accountId?: string; range: RangeKey; now?: Date },
) {
  const [accounts, { timeZone }] = await Promise.all([
    prisma.tradingAccount.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    getSettings(userId),
  ]);
  if (accounts.length === 0) return { kind: "no-accounts" as const };

  const { canCombine, selected, scope, currency } = resolveScope(accounts, opts.accountId);

  const trades = await prisma.trade.findMany({
    where: { userId, accountId: { in: scope.map((a) => a.id) } },
    include: { tags: TAG_SELECT },
  });
  const inputs = trades.map(toTradeInput);
  const byId = new Map(inputs.map((t) => [t.id, t]));
  const accountOf = new Map(trades.map((t) => [t.id, t.accountId]));
  const all = computeClosedResults(inputs);
  const open = trades
    .filter((t) => t.exitPrice === null)
    .sort((a, b) => b.entryAt.getTime() - a.entryAt.getTime());

  // Within a date range, the curve starts at the balance on the range's first
  // day: starting balance plus everything realised before it.
  const days = RANGES[opts.range].days;
  const from = days === null ? null : new Date((opts.now ?? new Date()).getTime() - days * 86_400_000);
  const before = from ? all.filter((r) => r.trade.exitAt! < from) : [];
  const results = from ? all.filter((r) => r.trade.exitAt! >= from) : all;
  // Risk rules are per account (and per currency), so check each account separately.
  const now = opts.now ?? new Date();
  const violations: (Violation & { accountId: string })[] = [];
  const guardrails = [];
  for (const account of scope) {
    const rules = {
      dailyLossLimit: account.dailyLossLimit?.toString() ?? null,
      maxTradesPerDay: account.maxTradesPerDay,
      maxRiskPerTrade: account.maxRiskPerTrade?.toString() ?? null,
    };
    const own = inputs.filter((t) => accountOf.get(t.id) === account.id);
    violations.push(...findViolations(own, rules, timeZone).violations.map((v) => ({ ...v, accountId: account.id })));
    if (rules.dailyLossLimit || rules.maxTradesPerDay) {
      guardrails.push({ accountName: account.name, currency: account.currency, ...todayStatus(own, rules, timeZone, now) });
    }
  }
  const inRange = (id: string) => {
    const t = byId.get(id)!;
    return !from || t.entryAt >= from || (t.exitAt !== null && t.exitAt >= from);
  };
  const rangeViolations = violations.filter((v) => inRange(v.tradeId));
  const flagged = new Set(rangeViolations.map((v) => v.tradeId));
  const hasRules = scope.some((a) => a.dailyLossLimit || a.maxTradesPerDay || a.maxRiskPerTrade);
  const discipline = hasRules
    ? {
        byRule: (["daily-loss", "max-trades", "max-risk"] as RuleId[]).map((rule) => ({
          rule,
          count: rangeViolations.filter((v) => v.rule === rule).length,
        })),
        flagged: summarize(results.filter((r) => flagged.has(r.trade.id))),
        clean: summarize(results.filter((r) => !flagged.has(r.trade.id))),
        recent: rangeViolations
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 6)
          .map((v) => ({ ...v, symbol: byId.get(v.tradeId)!.symbol })),
      }
    : null;

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
    curve: dailyEquityCurve(results, rangeStart, timeZone),
    timeZone,
    guardrails,
    discipline,
    rangeStartBalance: rangeStart,
    bySetup: breakdown(results, "setup"),
    bySymbol: breakdown(results, "symbol"),
    byWeekday: breakdown(results, "weekday", timeZone),
    byHour: breakdown(results, "hour", timeZone),
    byTag: breakdown(results, "tag"),
    byRules: breakdown(results, "rules"),
    byEmotion: breakdown(results, "emotion"),
    insights: generateInsights(results),
    recent: [...results].reverse().slice(0, 8),
  };
}
