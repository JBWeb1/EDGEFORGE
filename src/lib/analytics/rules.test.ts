import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findViolations, todayStatus } from "./rules";
import type { TradeInput } from "./trade-math";

let n = 0;
const t = (o: Partial<TradeInput>): TradeInput => ({
  id: `r${++n}`,
  symbol: "AAPL",
  direction: "LONG",
  quantity: "1",
  entryPrice: "100",
  entryAt: new Date("2026-03-02T09:00:00Z"),
  exitPrice: null,
  exitAt: null,
  ...o,
});
const closed = (pnl: number, entry: string, exit: string, o: Partial<TradeInput> = {}) =>
  t({ entryAt: new Date(entry), exitAt: new Date(exit), exitPrice: String(100 + pnl), ...o });

describe("findViolations", () => {
  it("flags trades risking more than the maximum", () => {
    const big = t({ quantity: "10", stopLoss: "95" }); // risk 50
    const ok = t({ quantity: "10", stopLoss: "98" }); // risk 20
    const noStop = t({});
    const { violations } = findViolations([big, ok, noStop], { maxRiskPerTrade: "30" });
    assert.deepEqual(violations.map((v) => [v.rule, v.tradeId]), [["max-risk", big.id]]);
  });

  it("flags trades beyond the daily maximum, per local day", () => {
    const a = t({ entryAt: new Date("2026-03-02T08:00:00Z") });
    const b = t({ entryAt: new Date("2026-03-02T09:00:00Z") });
    const c = t({ entryAt: new Date("2026-03-02T10:00:00Z") });
    // 23:30 UTC on the 2nd is the 3rd in Johannesburg, so it's a new day there.
    const d = t({ entryAt: new Date("2026-03-02T23:30:00Z") });
    const utc = findViolations([a, b, c, d], { maxTradesPerDay: 2 }, "UTC").violations.map((v) => v.tradeId);
    const jhb = findViolations([a, b, c, d], { maxTradesPerDay: 2 }, "Africa/Johannesburg").violations.map((v) => v.tradeId);
    assert.deepEqual(utc, [c.id, d.id]);
    assert.deepEqual(jhb, [c.id]);
  });

  it("flags trades opened after the daily loss limit was hit", () => {
    const l1 = closed(-60, "2026-03-02T09:00:00Z", "2026-03-02T10:00:00Z");
    const l2 = closed(-50, "2026-03-02T10:05:00Z", "2026-03-02T11:00:00Z"); // day total -110: limit hit at 11:00
    const revenge = closed(-30, "2026-03-02T11:15:00Z", "2026-03-02T12:00:00Z");
    const nextDay = closed(10, "2026-03-03T09:00:00Z", "2026-03-03T10:00:00Z");
    const { violations, limitHits } = findViolations([l1, l2, revenge, nextDay], { dailyLossLimit: "100" });
    assert.equal(limitHits.length, 1);
    assert.equal(limitHits[0].realised.toString(), "-110");
    assert.deepEqual(violations.map((v) => [v.rule, v.tradeId]), [["daily-loss", revenge.id]]);
  });

  it("returns nothing when no rules are set", () => {
    assert.deepEqual(findViolations([t({ stopLoss: "1", quantity: "1000" })], {}).violations, []);
  });
});

describe("todayStatus", () => {
  it("reports today's realised P&L and remaining loss allowance", () => {
    const now = new Date("2026-03-02T15:00:00Z");
    const trades = [
      closed(-40, "2026-03-02T09:00:00Z", "2026-03-02T10:00:00Z"),
      closed(15, "2026-03-02T11:00:00Z", "2026-03-02T12:00:00Z"),
      closed(-500, "2026-03-01T09:00:00Z", "2026-03-01T10:00:00Z"), // yesterday
      t({ entryAt: new Date("2026-03-02T14:00:00Z") }), // open, entered today
    ];
    const s = todayStatus(trades, { dailyLossLimit: "100", maxTradesPerDay: 3 }, "UTC", now);
    assert.equal(s.realised.toString(), "-25");
    assert.equal(s.lossRemaining!.toString(), "75");
    assert.equal(s.tradesToday, 3);
    assert.equal(s.tradesLimitHit, true);
    assert.equal(s.lossLimitHit, false);
  });
});
