import { describe, it } from "node:test";
import assert from "node:assert/strict";
import Decimal from "decimal.js";
import { positionSize } from "./position-size";
import { buildMonth, parseMonth, shiftMonth } from "./calendar";

describe("positionSize", () => {
  it("sizes a stock trade from a percentage of balance", () => {
    const r = positionSize({ balance: "25000", riskPercent: "1", entry: "182.40", stop: "180.10", target: "187" });
    assert.ok(r.ok);
    assert.equal(r.riskBudget.toString(), "250");
    assert.equal(r.quantity.toString(), "108"); // 250 / 2.30 = 108.69 -> 108
    assert.equal(r.actualRisk.toString(), "248.4");
    assert.equal(r.direction, "LONG");
    assert.equal(r.rewardRisk!.toDecimalPlaces(2).toString(), "2");
  });
  it("respects lot steps and multipliers for shorts", () => {
    const r = positionSize({ riskAmount: "500", entry: "5000", stop: "5010", multiplier: "50", step: "1" });
    assert.ok(r.ok);
    assert.equal(r.direction, "SHORT");
    assert.equal(r.quantity.toString(), "1"); // 500 / (10 * 50) = 1
    const fx = positionSize({ riskAmount: "100", entry: "1.0850", stop: "1.0830", step: "1000" });
    assert.ok(fx.ok);
    assert.equal(fx.quantity.toString(), "50000"); // 100 / 0.002 = 50000
  });
  it("never rounds up past the budget", () => {
    const r = positionSize({ riskAmount: "99", entry: "100", stop: "90" }); // 9.9 units -> 9
    assert.ok(r.ok);
    assert.equal(r.quantity.toString(), "9");
    assert.equal(r.actualRisk.toString(), "90");
    assert.ok(!positionSize({ riskAmount: "5", entry: "100", stop: "90" }).ok); // below one unit
  });
  it("explains invalid input", () => {
    assert.deepEqual(positionSize({ riskAmount: "100", entry: "100", stop: "100" }), { ok: false, error: "The stop must differ from the entry." });
    const wrongTarget = positionSize({ riskAmount: "100", entry: "100", stop: "95", target: "90" });
    assert.ok(!wrongTarget.ok && /above the entry/.test(wrongTarget.error));
  });
});

describe("calendar", () => {
  it("builds a Monday-first month grid with weekly totals", () => {
    const days = new Map([
      ["2026-03-02", { pnl: new Decimal(100), trades: 2 }],
      ["2026-03-03", { pnl: new Decimal(-40), trades: 1 }],
      ["2026-02-27", { pnl: new Decimal(999), trades: 1 }], // outside March
    ]);
    const m = buildMonth(2026, 3, days);
    // March 1st 2026 is a Sunday, so the grid starts Monday Feb 23.
    assert.equal(m.weeks[0].cells[0].date, "2026-02-23");
    assert.equal(m.weeks[0].cells[6].date, "2026-03-01");
    assert.equal(m.weeks[1].pnl.toString(), "60");
    assert.equal(m.monthPnl.toString(), "60");
    assert.equal(m.monthTrades, 3);
    assert.deepEqual([m.greenDays, m.redDays], [1, 1]);
    assert.equal(m.weeks.length, 6);
  });
  it("parses and shifts months", () => {
    assert.deepEqual(parseMonth("2026-13", new Date("2026-05-10")), { year: 2026, month: 5 });
    assert.equal(shiftMonth(2026, 1, -1), "2025-12");
    assert.equal(shiftMonth(2026, 12, 1), "2027-01");
  });
});
