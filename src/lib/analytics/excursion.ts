import Decimal from "decimal.js";
import type { Grade, TradeResult } from "./trade-math";

/**
 * Maximum adverse / favorable excursion (MAE / MFE): how far price moved
 * against and in favour of a trade while it was open. Measured from the entry
 * in price, in money (× quantity × multiplier) and in R (÷ distance to stop).
 */

export type Excursion = {
  /** Adverse move from entry, always ≥ 0. */
  maeMoney: Decimal | null;
  mfeMoney: Decimal | null;
  maeR: Decimal | null;
  mfeR: Decimal | null;
  /**
   * Share of the best available move that the exit captured: realised price
   * move ÷ MFE move. 1 = sold the top, 0 = exited at entry, negative = loss.
   */
  exitEfficiency: Decimal | null;
  /**
   * Open profit not banked: best open profit minus the profit taken (a loss
   * counts as zero taken, so a loser's loss isn't counted twice). ≥ 0.
   */
  leftOnTable: Decimal | null;
};

const val = (v: Decimal.Value | null | undefined) => (v === null || v === undefined ? null : new Decimal(v));

export function computeExcursion(r: TradeResult): Excursion {
  const t = r.trade;
  const sign = t.direction === "LONG" ? 1 : -1;
  const entry = new Decimal(t.entryPrice);
  const exit = new Decimal(t.exitPrice!);
  const size = new Decimal(t.quantity).mul(new Decimal(t.multiplier ?? 1));
  const stop = val(t.stopLoss);
  const stopDistance = stop ? entry.minus(stop).abs() : null;
  const mae = val(t.maePrice);
  const mfe = val(t.mfePrice);

  const maeMove = mae ? Decimal.max(entry.minus(mae).mul(sign), 0) : null;
  const mfeMove = mfe ? Decimal.max(mfe.minus(entry).mul(sign), 0) : null;
  const realisedMove = exit.minus(entry).mul(sign);
  const inR = (move: Decimal | null) => (move && stopDistance && stopDistance.gt(0) ? move.div(stopDistance) : null);

  return {
    maeMoney: maeMove ? maeMove.mul(size) : null,
    mfeMoney: mfeMove ? mfeMove.mul(size) : null,
    maeR: inR(maeMove),
    mfeR: inR(mfeMove),
    exitEfficiency: mfeMove && mfeMove.gt(0) ? realisedMove.div(mfeMove) : null,
    leftOnTable: mfeMove ? Decimal.max(mfeMove.minus(Decimal.max(realisedMove, 0)), 0).mul(size) : null,
  };
}

export type ExcursionSummary = {
  tradesWithData: number;
  averageMaeR: number | null;
  averageMfeR: number | null;
  /**
   * Average share of the best move that WINNING trades captured. Losers are
   * left out: a loser that barely moved in your favour gives a huge negative
   * ratio that would swamp the average.
   */
  averageExitEfficiency: number | null;
  winnersWithEfficiency: number;
  totalLeftOnTable: Decimal;
  /** Losing trades that were at least 1R in profit before turning. */
  losersThatWereUp1R: number;
  losersWithMfeR: number;
  /** Winners whose MAE stayed within half of the stop distance. */
  winnersWithinHalfStop: number;
  winnersWithMaeR: number;
};

const avg = (xs: Decimal[]) => (xs.length ? xs.reduce((a, b) => a.plus(b), new Decimal(0)).div(xs.length).toNumber() : null);

export function summarizeExcursions(results: TradeResult[]): ExcursionSummary {
  const rows = results
    .filter((r) => r.trade.maePrice != null || r.trade.mfePrice != null)
    .map((r) => ({ r, e: computeExcursion(r) }));
  const losers = rows.filter(({ r, e }) => r.outcome === "LOSS" && e.mfeR);
  const winners = rows.filter(({ r, e }) => r.outcome === "WIN" && e.maeR);
  return {
    tradesWithData: rows.length,
    averageMaeR: avg(rows.flatMap(({ e }) => (e.maeR ? [e.maeR] : []))),
    averageMfeR: avg(rows.flatMap(({ e }) => (e.mfeR ? [e.mfeR] : []))),
    averageExitEfficiency: avg(rows.flatMap(({ r, e }) => (r.outcome === "WIN" && e.exitEfficiency ? [e.exitEfficiency] : []))),
    winnersWithEfficiency: rows.filter(({ r, e }) => r.outcome === "WIN" && e.exitEfficiency).length,
    totalLeftOnTable: rows.reduce((acc, { e }) => acc.plus(e.leftOnTable ?? 0), new Decimal(0)),
    losersThatWereUp1R: losers.filter(({ e }) => e.mfeR!.gte(1)).length,
    losersWithMfeR: losers.length,
    winnersWithinHalfStop: winners.filter(({ e }) => e.maeR!.lte(0.5)).length,
    winnersWithMaeR: winners.length,
  };
}

/**
 * Grade from a playbook checklist: A = every rule met, B ≥ 75%, C ≥ 50%,
 * D below that. Null when the playbook has no rules.
 */
export function gradeFromChecklist(met: number, total: number): Grade | null {
  if (total <= 0) return null;
  const pct = met / total;
  if (pct >= 1) return "A";
  if (pct >= 0.75) return "B";
  if (pct >= 0.5) return "C";
  return "D";
}

/** Holding-time buckets, in display order. */
export const HOLD_BUCKETS: { label: string; maxMs: number }[] = [
  { label: "Under 5 min", maxMs: 5 * 60_000 },
  { label: "5–30 min", maxMs: 30 * 60_000 },
  { label: "30 min–2 h", maxMs: 2 * 3_600_000 },
  { label: "2 h–1 day", maxMs: 24 * 3_600_000 },
  { label: "1–7 days", maxMs: 7 * 24 * 3_600_000 },
  { label: "Over 7 days", maxMs: Infinity },
];

export function holdBucket(ms: number | null): string {
  if (ms === null) return "Unknown";
  return HOLD_BUCKETS.find((b) => ms < b.maxMs)!.label;
}
