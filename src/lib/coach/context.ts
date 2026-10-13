import "server-only";
import { prisma } from "@/lib/db";
import { breakdown, summarize, type BreakdownRow, type Summary } from "@/lib/analytics/metrics";
import { findViolations } from "@/lib/analytics/rules";
import { zonedParts } from "@/lib/analytics/timezone";
import { computeClosedResults, computeTradeResult, isClosed } from "@/lib/analytics/trade-math";
import { getSettings } from "@/lib/data/settings";
import { TAG_SELECT, toTradeInput } from "@/lib/data/trades";

const MAX_TRADES = 300;
const MAX_NOTES = 30;

const n2 = (d: { toDecimalPlaces(n: number): { toString(): string } } | null) => (d ? d.toDecimalPlaces(2).toString() : null);

function summaryJson(s: Summary) {
  return {
    closedTrades: s.closedTrades,
    wins: s.wins,
    losses: s.losses,
    breakevens: s.breakevens,
    netPnl: n2(s.netPnl),
    totalFees: n2(s.totalFees),
    winRatePct: s.winRate === null ? null : +s.winRate.toFixed(1),
    profitFactor: s.profitFactor === null ? null : +s.profitFactor.toFixed(2),
    expectancyPerTrade: n2(s.expectancy),
    averageWin: n2(s.averageWin),
    averageLoss: n2(s.averageLoss),
    largestWin: n2(s.largestWin),
    largestLoss: n2(s.largestLoss),
    averageR: s.averageR === null ? null : +s.averageR.toFixed(2),
    tradesWithStop: s.tradesWithR,
    maxDrawdown: n2(s.maxDrawdown),
    maxDrawdownPct: s.maxDrawdownPct === null ? null : +s.maxDrawdownPct.toFixed(1),
    longestWinStreak: s.longestWinStreak,
    longestLossStreak: s.longestLossStreak,
    startingBalance: n2(s.startingBalance),
    currentBalance: n2(s.endingBalance),
  };
}

const rowsJson = (rows: BreakdownRow[]) =>
  rows.map((r) => ({
    group: r.key,
    trades: r.trades,
    winRatePct: +r.winRate.toFixed(1),
    netPnl: n2(r.netPnl),
    avgPerTrade: n2(r.expectancy),
    averageR: r.averageR === null ? null : +r.averageR.toFixed(2),
  }));

/**
 * Everything the coach may reason over, as compact JSON. Trades get short
 * references (T1 = most recent) so answers can cite them; `refs` maps those
 * back to trade ids for links.
 */
export async function buildCoachContext(userId: string) {
  const [{ timeZone }, accounts, trades, notes] = await Promise.all([
    getSettings(userId),
    prisma.tradingAccount.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.trade.findMany({
      where: { userId },
      orderBy: [{ entryAt: "desc" }, { id: "desc" }],
      include: { tags: TAG_SELECT },
    }),
    prisma.dailyNote.findMany({ where: { userId }, orderBy: { date: "desc" }, take: MAX_NOTES }),
  ]);

  const selected = trades.slice(0, MAX_TRADES);
  const refs: Record<string, string> = {};
  const refOf = new Map<string, string>();
  selected.forEach((t, i) => {
    refs[`T${i + 1}`] = t.id;
    refOf.set(t.id, `T${i + 1}`);
  });

  const accountsJson = accounts.map((a) => {
    const own = trades.filter((t) => t.accountId === a.id).map(toTradeInput);
    const results = computeClosedResults(own);
    const { violations } = findViolations(
      own,
      {
        dailyLossLimit: a.dailyLossLimit?.toString() ?? null,
        maxTradesPerDay: a.maxTradesPerDay,
        maxRiskPerTrade: a.maxRiskPerTrade?.toString() ?? null,
      },
      timeZone,
    );
    return {
      name: a.name,
      currency: a.currency,
      riskRules: {
        dailyLossLimit: a.dailyLossLimit?.toString() ?? null,
        maxTradesPerDay: a.maxTradesPerDay,
        maxRiskPerTrade: a.maxRiskPerTrade?.toString() ?? null,
      },
      openTrades: own.filter((t) => !isClosed(t)).length,
      summary: summaryJson(summarize(results, a.startingBalance.toString())),
      breakdowns: {
        bySetup: rowsJson(breakdown(results, "setup")),
        bySymbol: rowsJson(breakdown(results, "symbol")),
        byDirection: rowsJson(breakdown(results, "direction")),
        byWeekday: rowsJson(breakdown(results, "weekday", timeZone)),
        byEntryHour: rowsJson(breakdown(results, "hour", timeZone)),
        byRuleAdherence: rowsJson(breakdown(results, "rules")),
        byEmotion: rowsJson(breakdown(results, "emotion")),
        byTag: rowsJson(breakdown(results, "tag")),
      },
      ruleBreaches: violations.slice(0, 100).map((v) => ({ rule: v.rule, date: v.date, trade: refOf.get(v.tradeId) ?? "older trade", detail: v.message })),
    };
  });

  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const tradesJson = selected.map((t) => {
    const input = toTradeInput(t);
    const r = isClosed(input) ? computeTradeResult(input) : null;
    return {
      ref: refOf.get(t.id),
      account: accountName.get(t.accountId),
      symbol: t.symbol,
      side: t.direction,
      entered: `${zonedParts(t.entryAt, timeZone).date} ${String(zonedParts(t.entryAt, timeZone).hour).padStart(2, "0")}:${String(zonedParts(t.entryAt, timeZone).minute).padStart(2, "0")}`,
      status: r ? r.outcome : "OPEN",
      netPnl: r ? n2(r.netPnl) : null,
      r: r?.rMultiple ? +r.rMultiple.toNumber().toFixed(2) : null,
      plannedRR: r?.plannedRewardRisk ? +r.plannedRewardRisk.toNumber().toFixed(2) : null,
      holdMinutes: r?.holdingMs ? Math.round(r.holdingMs / 60000) : null,
      setup: t.setup,
      strategy: t.strategy,
      emotion: t.emotion,
      followedRules: t.followedRules,
      confidence: t.confidence,
      tags: input.tags,
      notes: t.notes ? t.notes.slice(0, 400) : null,
    };
  });

  const data = {
    timeZone,
    totalTradesInJournal: trades.length,
    tradesIncluded: selected.length,
    accounts: accountsJson,
    dailyJournal: notes.map((n) => ({
      date: n.date,
      mood1to5: n.mood,
      premarketPlan: n.premarket?.slice(0, 600) ?? null,
      review: n.review?.slice(0, 600) ?? null,
    })),
    trades: tradesJson,
  };

  return { json: JSON.stringify(data), refs, tradeCount: trades.length };
}
