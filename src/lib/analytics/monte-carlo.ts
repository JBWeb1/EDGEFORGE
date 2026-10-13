/**
 * Monte Carlo projection by bootstrap resampling: each simulated future draws
 * trades at random (with replacement) from the trader's own closed results.
 *
 * Assumes future trades look like past ones and are independent of each
 * other. It shows the range of outcomes luck alone can produce with the same
 * edge; it is not a forecast.
 */

export type SimulationInput = {
  /** Historical per-trade outcomes (net P&L, or R multiples). */
  outcomes: number[];
  /** Trades per simulated future. */
  trades: number;
  runs?: number;
  /** Starting balance for drawdown % (use 0 for R-based sims). */
  startBalance?: number;
  /** Drawdown level to report the probability of, in % of peak (or in R when startBalance is 0). */
  drawdownThreshold?: number;
  seed?: number;
};

export type SimulationResult = {
  runs: number;
  trades: number;
  sampleSize: number;
  /** Final P&L percentiles. */
  final: { p5: number; p25: number; p50: number; p75: number; p95: number };
  probProfit: number;
  /** Max drawdown (amount, or % of peak when a start balance is given). */
  maxDrawdown: { p50: number; p95: number };
  probDrawdownAbove: number;
  longestLosingStreak: { p50: number; p95: number };
  /** Percentile bands of cumulative P&L after each trade (index 0 = start). */
  bands: { step: number; p5: number; p25: number; p50: number; p75: number; p95: number }[];
};

/** Small deterministic PRNG so the same inputs give the same projection. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Linear-interpolated percentile of a sorted array. */
export function percentile(sorted: number[], p: number) {
  if (!sorted.length) return NaN;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function simulate(input: SimulationInput): SimulationResult {
  const { outcomes, trades } = input;
  const runs = input.runs ?? 5000;
  const start = input.startBalance ?? 0;
  const usePct = start > 0;
  const threshold = input.drawdownThreshold ?? (usePct ? 20 : 10);
  if (outcomes.length === 0 || trades < 1) throw new Error("Need at least one outcome and one trade.");

  const rand = mulberry32(input.seed ?? 42);
  const finals = new Float64Array(runs);
  const drawdowns = new Float64Array(runs);
  const streaks = new Float64Array(runs);
  // paths[step][run] for the percentile bands
  const paths = Array.from({ length: trades + 1 }, () => new Float64Array(runs));
  let breaches = 0;

  for (let r = 0; r < runs; r++) {
    let pnl = 0;
    let peak = start;
    let worst = 0;
    let streak = 0;
    let longest = 0;
    for (let i = 1; i <= trades; i++) {
      const o = outcomes[Math.floor(rand() * outcomes.length)];
      pnl += o;
      paths[i][r] = pnl;
      const equity = start + pnl;
      if (equity > peak) peak = equity;
      const dd = usePct ? (peak > 0 ? ((peak - equity) / peak) * 100 : 0) : peak - equity;
      if (dd > worst) worst = dd;
      streak = o < 0 ? streak + 1 : 0;
      if (streak > longest) longest = streak;
    }
    finals[r] = pnl;
    drawdowns[r] = worst;
    streaks[r] = longest;
    if (worst >= threshold) breaches++;
  }

  const sort = (a: Float64Array) => Array.from(a).sort((x, y) => x - y);
  const f = sort(finals);
  const d = sort(drawdowns);
  const s = sort(streaks);
  const every = Math.max(1, Math.floor(trades / 100));
  const bands = [];
  for (let i = 0; i <= trades; i += every) {
    const col = sort(paths[i]);
    bands.push({ step: i, p5: percentile(col, 0.05), p25: percentile(col, 0.25), p50: percentile(col, 0.5), p75: percentile(col, 0.75), p95: percentile(col, 0.95) });
  }
  if (bands[bands.length - 1].step !== trades) {
    const col = sort(paths[trades]);
    bands.push({ step: trades, p5: percentile(col, 0.05), p25: percentile(col, 0.25), p50: percentile(col, 0.5), p75: percentile(col, 0.75), p95: percentile(col, 0.95) });
  }

  return {
    runs,
    trades,
    sampleSize: outcomes.length,
    final: { p5: percentile(f, 0.05), p25: percentile(f, 0.25), p50: percentile(f, 0.5), p75: percentile(f, 0.75), p95: percentile(f, 0.95) },
    probProfit: f.filter((x) => x > 0).length / runs,
    maxDrawdown: { p50: percentile(d, 0.5), p95: percentile(d, 0.95) },
    probDrawdownAbove: breaches / runs,
    longestLosingStreak: { p50: percentile(s, 0.5), p95: percentile(s, 0.95) },
    bands,
  };
}
