/**
 * Generates samples/sample-trades.csv: fictional, illustrative trades for
 * trying the importer and dashboard. Deterministic (seeded) so it is stable.
 *
 *   npx tsx scripts/generate-sample-csv.ts
 */
import { writeFileSync } from "node:fs";
import { TEMPLATE_HEADERS } from "../src/lib/import/csv";

let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];

const SYMBOLS = [
  { symbol: "AAPL", price: 190, qty: 50, mult: 1, tick: 0.01 },
  { symbol: "NVDA", price: 120, qty: 80, mult: 1, tick: 0.01 },
  { symbol: "EURUSD", price: 1.085, qty: 10000, mult: 1, tick: 0.00001 },
  { symbol: "ES", price: 5000, qty: 1, mult: 50, tick: 0.25 },
] as const;
const SETUPS = ["Opening range breakout", "VWAP pullback", "Failed breakdown", "Trend continuation"] as const;
const EDGE: Record<string, number> = { "Opening range breakout": 0.64, "VWAP pullback": 0.58, "Failed breakdown": 0.36, "Trend continuation": 0.52 };

const round = (n: number, tick: number) => (Math.round(n / tick) * tick).toFixed(tick < 0.001 ? 5 : 2);
const rows: string[] = [TEMPLATE_HEADERS.join(",")];
const start = Date.UTC(2026, 6, 1, 13, 30);

for (let i = 0; i < 90; i++) {
  const day = Math.floor(i / 1.5);
  const d = new Date(start + day * 86_400_000);
  if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
  const s = pick(SYMBOLS);
  const setup = pick(SETUPS);
  const long = rand() < 0.6;
  const entry = s.price * (1 + (rand() - 0.5) * 0.04);
  const riskDist = entry * (s.mult > 1 ? 0.0015 + rand() * 0.001 : 0.004 + rand() * 0.004);
  const stop = long ? entry - riskDist : entry + riskDist;
  const target = long ? entry + riskDist * 2 : entry - riskDist * 2;
  const win = rand() < EDGE[setup];
  const r = win ? 0.8 + rand() * 1.6 : -(0.5 + rand() * 0.6);
  const exit = entry + (long ? 1 : -1) * r * riskDist;
  const entryAt = new Date(d.getTime() + Math.floor(rand() * 300) * 60_000);
  const exitAt = new Date(entryAt.getTime() + (10 + Math.floor(rand() * 180)) * 60_000);
  const fees = (s.mult > 1 ? 4.2 : 1 + rand() * 2).toFixed(2);
  const iso = (x: Date) => x.toISOString().slice(0, 16).replace("T", " ");
  rows.push(
    [s.symbol, long ? "long" : "short", s.qty, iso(entryAt), round(entry, s.tick), iso(exitAt), round(exit, s.tick),
      round(stop, s.tick), round(target, s.tick), fees, s.mult, setup, "", ""].join(","),
  );
}

writeFileSync("samples/sample-trades.csv", rows.join("\n") + "\n");
console.log(`Wrote ${rows.length - 1} sample trades to samples/sample-trades.csv`);
