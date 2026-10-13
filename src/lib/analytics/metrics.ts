import Decimal from "decimal.js";
import { zonedParts } from "./timezone";
import type { TradeResult } from "./trade-math";

/**
 * Portfolio statistics derived from closed-trade results.
 *
 * Definitions (all based on net P&L, i.e. after fees):
 * - Win rate: winning trades ÷ all closed trades (breakevens count as non-wins).
 * - Profit factor: sum of winning P&L ÷ |sum of losing P&L|; null when there
 *   are no losing trades (undefined, not infinite).
 * - Expectancy: average net P&L per closed trade.
 * - Max drawdown: largest peak-to-trough fall of the equity curve, where the
 *   curve starts at the account's starting balance.
 */

export type Summary = {
  closedTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
  netPnl: Decimal;
  grossProfit: Decimal;
  grossLoss: Decimal;
  totalFees: Decimal;
  winRate: number | null;
  profitFactor: number | null;
  expectancy: Decimal | null;
  averageWin: Decimal | null;
  averageLoss: Decimal | null;
  payoffRatio: number | null;
  largestWin: Decimal | null;
  largestLoss: Decimal | null;
  averageR: number | null;
  tradesWithR: number;
  averagePlannedRewardRisk: number | null;
  maxDrawdown: Decimal;
  maxDrawdownPct: number | null;
  longestWinStreak: number;
  longestLossStreak: number;
  startingBalance: Decimal;
  endingBalance: Decimal;
  returnPct: number | null;
};

const ZERO = new Decimal(0);

const sum = (values: Decimal[]) => values.reduce((acc, v) => acc.plus(v), ZERO);
const mean = (values: Decimal[]) => (values.length ? sum(values).div(values.length) : null);

export type EquityPoint = {
  /** Local trading day (YYYY-MM-DD in the trader's time zone). */
  date: string;
  equity: Decimal;
  pnl: Decimal;
  trades: number;
};

/** Daily equity curve by trading day in `timeZone`, starting from the starting balance. */
export function dailyEquityCurve(
  results: TradeResult[],
  startingBalance: Decimal.Value = 0,
  timeZone = "UTC",
): EquityPoint[] {
  const points: EquityPoint[] = [];
  let equity = new Decimal(startingBalance);
  for (const r of results) {
    const date = zonedParts(r.trade.exitAt!, timeZone).date;
    equity = equity.plus(r.netPnl);
    const last = points[points.length - 1];
    if (last && last.date === date) {
      last.equity = equity;
      last.pnl = last.pnl.plus(r.netPnl);
      last.trades += 1;
    } else {
      points.push({ date, equity, pnl: r.netPnl, trades: 1 });
    }
  }
  return points;
}

export function maxDrawdown(results: TradeResult[], startingBalance: Decimal.Value = 0) {
  let equity = new Decimal(startingBalance);
  let peak = equity;
  let worst = ZERO;
  let worstPct: number | null = null;
  for (const r of results) {
    equity = equity.plus(r.netPnl);
    if (equity.gt(peak)) peak = equity;
    const dd = peak.minus(equity);
    if (dd.gt(worst)) {
      worst = dd;
      // A percentage is only meaningful against a positive peak balance.
      worstPct = peak.gt(0) ? dd.div(peak).mul(100).toNumber() : null;
    }
  }
  if (worst.isZero()) worstPct = peak.gt(0) ? 0 : null;
  return { amount: worst, pct: worstPct };
}

export function streaks(results: TradeResult[]) {
  let win = 0;
  let loss = 0;
  let longestWin = 0;
  let longestLoss = 0;
  for (const r of results) {
    if (r.outcome === "WIN") {
      win += 1;
      loss = 0;
    } else if (r.outcome === "LOSS") {
      loss += 1;
      win = 0;
    } else {
      win = 0;
      loss = 0;
    }
    longestWin = Math.max(longestWin, win);
    longestLoss = Math.max(longestLoss, loss);
  }
  return { longestWin, longestLoss };
}

export function summarize(results: TradeResult[], startingBalance: Decimal.Value = 0): Summary {
  const start = new Decimal(startingBalance);
  const winners = results.filter((r) => r.outcome === "WIN").map((r) => r.netPnl);
  const losers = results.filter((r) => r.outcome === "LOSS").map((r) => r.netPnl);
  const net = sum(results.map((r) => r.netPnl));
  const grossProfit = sum(winners);
  const grossLoss = sum(losers); // negative or zero
  const withR = results.filter((r) => r.rMultiple !== null).map((r) => r.rMultiple!);
  const withPlan = results.filter((r) => r.plannedRewardRisk !== null).map((r) => r.plannedRewardRisk!);
  const averageWin = mean(winners);
  const averageLoss = mean(losers);
  const dd = maxDrawdown(results, start);
  const s = streaks(results);
  const ending = start.plus(net);

  return {
    closedTrades: results.length,
    wins: winners.length,
    losses: losers.length,
    breakevens: results.length - winners.length - losers.length,
    netPnl: net,
    grossProfit,
    grossLoss,
    totalFees: sum(results.map((r) => r.fees)),
    winRate: results.length ? (winners.length / results.length) * 100 : null,
    profitFactor: grossLoss.isZero() ? null : grossProfit.div(grossLoss.abs()).toNumber(),
    expectancy: mean(results.map((r) => r.netPnl)),
    averageWin,
    averageLoss,
    payoffRatio: averageWin && averageLoss ? averageWin.div(averageLoss.abs()).toNumber() : null,
    largestWin: winners.length ? Decimal.max(...winners) : null,
    largestLoss: losers.length ? Decimal.min(...losers) : null,
    averageR: withR.length ? mean(withR)!.toNumber() : null,
    tradesWithR: withR.length,
    averagePlannedRewardRisk: withPlan.length ? mean(withPlan)!.toNumber() : null,
    maxDrawdown: dd.amount,
    maxDrawdownPct: dd.pct,
    longestWinStreak: s.longestWin,
    longestLossStreak: s.longestLoss,
    startingBalance: start,
    endingBalance: ending,
    returnPct: start.gt(0) ? net.div(start).mul(100).toNumber() : null,
  };
}

export type BreakdownRow = {
  key: string;
  trades: number;
  wins: number;
  winRate: number;
  netPnl: Decimal;
  expectancy: Decimal;
  profitFactor: number | null;
  averageR: number | null;
};

export type GroupBy = "setup" | "symbol" | "weekday" | "direction" | "emotion" | "rules" | "hour" | "tag";

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Grouping key for a trade. Time-based groups use the entry time in `timeZone`. */
export function groupKey(r: TradeResult, by: Exclude<GroupBy, "tag">, timeZone = "UTC"): string {
  const t = r.trade;
  switch (by) {
    case "setup":
      return t.setup?.trim() || "No setup";
    case "symbol":
      return t.symbol.toUpperCase();
    case "weekday":
      return WEEKDAYS[zonedParts(t.entryAt, timeZone).weekday];
    case "hour":
      return `${String(zonedParts(t.entryAt, timeZone).hour).padStart(2, "0")}:00`;
    case "direction":
      return t.direction === "LONG" ? "Long" : "Short";
    case "emotion":
      return t.emotion ? t.emotion.charAt(0) + t.emotion.slice(1).toLowerCase() : "Not recorded";
    case "rules":
      return t.followedRules === true ? "Followed rules" : t.followedRules === false ? "Broke rules" : "Not recorded";
  }
}

/** Groups a trade belongs to. Only tags can put a trade in several groups. */
export function groupKeys(r: TradeResult, by: GroupBy, timeZone = "UTC"): string[] {
  if (by === "tag") return r.trade.tags?.length ? r.trade.tags : ["Untagged"];
  return [groupKey(r, by, timeZone)];
}

export function breakdown(results: TradeResult[], by: GroupBy, timeZone = "UTC"): BreakdownRow[] {
  const groups = new Map<string, TradeResult[]>();
  for (const r of results) {
    for (const key of groupKeys(r, by, timeZone)) {
      const list = groups.get(key);
      if (list) list.push(r);
      else groups.set(key, [r]);
    }
  }
  const rows = [...groups.entries()].map(([key, rs]) => {
    const s = summarize(rs);
    return {
      key,
      trades: s.closedTrades,
      wins: s.wins,
      winRate: s.winRate ?? 0,
      netPnl: s.netPnl,
      expectancy: s.expectancy ?? ZERO,
      profitFactor: s.profitFactor,
      averageR: s.averageR,
    };
  });
  if (by === "weekday") {
    return rows.sort((a, b) => WEEKDAYS.indexOf(a.key) - WEEKDAYS.indexOf(b.key));
  }
  if (by === "hour") return rows.sort((a, b) => a.key.localeCompare(b.key));
  return rows.sort((a, b) => b.netPnl.comparedTo(a.netPnl));
}
