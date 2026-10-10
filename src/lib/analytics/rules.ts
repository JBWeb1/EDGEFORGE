import Decimal from "decimal.js";
import { zonedParts } from "./timezone";
import { computeInitialRisk, computeTradeResult, isClosed, type TradeInput } from "./trade-math";

/**
 * Checks trades against the risk rules in a trader's plan. Trading days are
 * calendar days in the trader's time zone. Rules apply per account, in the
 * account's currency.
 */

export type RiskRules = {
  dailyLossLimit?: Decimal.Value | null;
  maxTradesPerDay?: number | null;
  maxRiskPerTrade?: Decimal.Value | null;
};

export type RuleId = "daily-loss" | "max-trades" | "max-risk";

export type Violation = {
  rule: RuleId;
  tradeId: string;
  /** Local trading day. */
  date: string;
  message: string;
};

export type LimitHit = { date: string; at: Date; realised: Decimal };

export const RULE_LABELS: Record<RuleId, string> = {
  "daily-loss": "Traded after daily loss limit",
  "max-trades": "Over max trades per day",
  "max-risk": "Risk above max per trade",
};

const present = <T,>(v: T | null | undefined): v is T => v !== null && v !== undefined;

export function findViolations(trades: TradeInput[], rules: RiskRules, timeZone = "UTC") {
  const violations: Violation[] = [];
  const limitHits: LimitHit[] = [];
  const day = (d: Date) => zonedParts(d, timeZone).date;

  if (present(rules.maxRiskPerTrade)) {
    const max = new Decimal(rules.maxRiskPerTrade);
    for (const t of trades) {
      const risk = computeInitialRisk(t);
      if (risk && risk.gt(max)) {
        violations.push({
          rule: "max-risk",
          tradeId: t.id,
          date: day(t.entryAt),
          message: `Risked ${risk.toDecimalPlaces(2).toString()} against a maximum of ${max.toString()}.`,
        });
      }
    }
  }

  if (present(rules.maxTradesPerDay)) {
    const byDay = new Map<string, TradeInput[]>();
    for (const t of trades) {
      const d = day(t.entryAt);
      byDay.set(d, [...(byDay.get(d) ?? []), t]);
    }
    for (const [d, list] of byDay) {
      list
        .sort((a, b) => a.entryAt.getTime() - b.entryAt.getTime() || a.id.localeCompare(b.id))
        .slice(rules.maxTradesPerDay)
        .forEach((t, i) =>
          violations.push({
            rule: "max-trades",
            tradeId: t.id,
            date: d,
            message: `Trade ${rules.maxTradesPerDay! + i + 1} of the day; your limit is ${rules.maxTradesPerDay}.`,
          }),
        );
    }
  }

  if (present(rules.dailyLossLimit)) {
    const limit = new Decimal(rules.dailyLossLimit).abs();
    const exits = trades
      .filter(isClosed)
      .map(computeTradeResult)
      .sort((a, b) => a.trade.exitAt!.getTime() - b.trade.exitAt!.getTime());
    const running = new Map<string, Decimal>();
    for (const r of exits) {
      const d = day(r.trade.exitAt!);
      if (limitHits.some((h) => h.date === d)) continue;
      const total = (running.get(d) ?? new Decimal(0)).plus(r.netPnl);
      running.set(d, total);
      if (total.lte(limit.neg())) limitHits.push({ date: d, at: r.trade.exitAt!, realised: total });
    }
    for (const hit of limitHits) {
      for (const t of trades) {
        if (t.entryAt > hit.at && day(t.entryAt) === hit.date) {
          violations.push({
            rule: "daily-loss",
            tradeId: t.id,
            date: hit.date,
            message: `Opened after the day's realised loss reached ${hit.realised.toDecimalPlaces(2).toString()} (limit ${limit.neg().toString()}).`,
          });
        }
      }
    }
  }

  return { violations, limitHits };
}

/** Where today stands against the daily rules, for a live guardrail. */
export function todayStatus(trades: TradeInput[], rules: RiskRules, timeZone = "UTC", now = new Date()) {
  const today = zonedParts(now, timeZone).date;
  const realised = trades
    .filter(isClosed)
    .filter((t) => zonedParts(t.exitAt, timeZone).date === today)
    .map(computeTradeResult)
    .reduce((acc, r) => acc.plus(r.netPnl), new Decimal(0));
  const tradesToday = trades.filter((t) => zonedParts(t.entryAt, timeZone).date === today).length;
  const limit = present(rules.dailyLossLimit) ? new Decimal(rules.dailyLossLimit).abs() : null;
  return {
    date: today,
    realised,
    tradesToday,
    dailyLossLimit: limit,
    lossLimitHit: limit ? realised.lte(limit.neg()) : false,
    /** How much more can be lost today before the limit, never negative. */
    lossRemaining: limit ? Decimal.max(limit.plus(realised), 0) : null,
    maxTradesPerDay: rules.maxTradesPerDay ?? null,
    tradesLimitHit: present(rules.maxTradesPerDay) ? tradesToday >= rules.maxTradesPerDay : false,
  };
}
