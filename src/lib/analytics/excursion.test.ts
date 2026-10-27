import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeExcursion, gradeFromChecklist, holdBucket, summarizeExcursions } from "./excursion";
import { breakdown, summarize } from "./metrics";
import { computeClosedResults, computeTradeResult, type ClosedTrade, type TradeInput } from "./trade-math";

let n = 0;
const closed = (o: Partial<TradeInput>): ClosedTrade =>
  ({
    id: `x${++n}`,
    symbol: "AAPL",
    direction: "LONG",
    quantity: "10",
    entryPrice: "100",
    entryAt: new Date("2026-03-02T10:00:00Z"),
    exitPrice: "104",
    exitAt: new Date("2026-03-02T11:00:00Z"),
    stopLoss: "98",
    ...o,
  }) as ClosedTrade;

describe("computeExcursion", () => {
  it("measures a long trade's MAE, MFE, efficiency and profit left behind", () => {
    // Entry 100, stop 98 (2 points = 1R), went down to 99, up to 108, exited 104.
    const e = computeExcursion(computeTradeResult(closed({ maePrice: "99", mfePrice: "108" })));
    assert.equal(e.maeMoney!.toString(), "10");
    assert.equal(e.mfeMoney!.toString(), "80");
    assert.equal(e.maeR!.toString(), "0.5");
    assert.equal(e.mfeR!.toString(), "4");
    assert.equal(e.exitEfficiency!.toString(), "0.5"); // captured 4 of 8 points
    assert.equal(e.leftOnTable!.toString(), "40");
  });

  it("handles shorts, where adverse means up", () => {
    const e = computeExcursion(
      computeTradeResult(closed({ direction: "SHORT", entryPrice: "50", stopLoss: "51", exitPrice: "52", maePrice: "52.5", mfePrice: "49" })),
    );
    assert.equal(e.maeR!.toString(), "2.5");
    assert.equal(e.mfeR!.toString(), "1");
    assert.equal(e.exitEfficiency!.toString(), "-2"); // lost 2 points after being 1 point up
    assert.equal(e.leftOnTable!.toString(), "10"); // the 1 point of open profit, × 10 (the loss isn't counted again)
  });

  it("leaves fields empty without excursion prices or a stop", () => {
    const e = computeExcursion(computeTradeResult(closed({ stopLoss: null, mfePrice: "106" })));
    assert.equal(e.maeMoney, null);
    assert.equal(e.mfeR, null);
    assert.equal(e.exitEfficiency!.toString(), "0.66666666666666666667");
  });
});

describe("summarizeExcursions", () => {
  it("finds losers that were up 1R and winners that never got near the stop", () => {
    const results = computeClosedResults([
      closed({ maePrice: "99.5", mfePrice: "105" }), // winner, MAE 0.25R
      closed({ exitPrice: "98", maePrice: "98", mfePrice: "103" }), // loser, was +1.5R
      closed({ exitPrice: "98", maePrice: "98", mfePrice: "100.5" }), // loser, only +0.25R
      closed({}), // no excursion data
    ]);
    const s = summarizeExcursions(results);
    assert.equal(s.tradesWithData, 3);
    assert.equal(s.losersThatWereUp1R, 1);
    assert.equal(s.losersWithMfeR, 2);
    assert.equal(s.winnersWithinHalfStop, 1);
    assert.equal(s.totalLeftOnTable.toString(), "45"); // open profit not banked: (1 + 3 + 0.5 points) × 10
    // Efficiency only from winners: the winner captured 4 of 5 points.
    assert.equal(s.averageExitEfficiency, 0.8);
    assert.equal(s.winnersWithEfficiency, 1);
  });
});

describe("grades and holding time", () => {
  it("grades by share of checklist rules met", () => {
    assert.equal(gradeFromChecklist(4, 4), "A");
    assert.equal(gradeFromChecklist(3, 4), "B");
    assert.equal(gradeFromChecklist(2, 4), "C");
    assert.equal(gradeFromChecklist(1, 4), "D");
    assert.equal(gradeFromChecklist(0, 0), null);
  });

  it("buckets holding times and orders them", () => {
    assert.equal(holdBucket(4 * 60_000), "Under 5 min");
    assert.equal(holdBucket(3 * 3_600_000), "2 h–1 day");
    const results = computeClosedResults([
      closed({ exitAt: new Date("2026-03-09T10:00:00Z") }), // 7 days → "Over 7 days"
      closed({ exitAt: new Date("2026-03-02T10:10:00Z") }), // 10 min
    ]);
    assert.deepEqual(breakdown(results, "hold").map((r) => r.key), ["5–30 min", "Over 7 days"]);
  });

  it("reports average hold for winners and losers", () => {
    const s = summarize(computeClosedResults([
      closed({ exitAt: new Date("2026-03-02T10:30:00Z") }),
      closed({ exitPrice: "99", exitAt: new Date("2026-03-02T12:00:00Z") }),
    ]));
    assert.equal(s.averageHoldWinMs, 30 * 60_000);
    assert.equal(s.averageHoldLossMs, 2 * 3_600_000);
  });

  it("groups by grade and playbook", () => {
    const results = computeClosedResults([
      closed({ playbook: "ORB", grade: "A" }),
      closed({ playbook: "ORB", grade: "C", exitPrice: "99" }),
      closed({}),
    ]);
    assert.deepEqual(breakdown(results, "grade").map((r) => r.key), ["Grade A", "Grade C", "Not graded"]);
    // Sorted by net P&L: no playbook +40, ORB +40 - 10 = +30.
    assert.deepEqual(breakdown(results, "playbook").map((r) => [r.key, r.trades]), [["No playbook", 1], ["ORB", 2]]);
  });
});
