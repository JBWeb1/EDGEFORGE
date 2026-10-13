import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { percentile, simulate } from "./monte-carlo";

describe("percentile", () => {
  it("interpolates", () => {
    assert.equal(percentile([1, 2, 3, 4, 5], 0.5), 3);
    assert.equal(percentile([0, 10], 0.25), 2.5);
  });
});

describe("simulate", () => {
  it("is deterministic for a seed", () => {
    const a = simulate({ outcomes: [1, -1, 2], trades: 50, runs: 500, seed: 7 });
    const b = simulate({ outcomes: [1, -1, 2], trades: 50, runs: 500, seed: 7 });
    assert.deepEqual(a.final, b.final);
  });

  it("matches the expected value of the edge", () => {
    // Mean outcome +0.25R per trade -> about +25R after 100 trades.
    const r = simulate({ outcomes: [2, -1, -1, 1], trades: 100, runs: 4000 });
    assert.ok(Math.abs(r.final.p50 - 25) < 3, `median ${r.final.p50}`);
    assert.ok(r.final.p5 < r.final.p50 && r.final.p50 < r.final.p95);
    assert.ok(r.probProfit > 0.8);
  });

  it("never profits with only losing outcomes and reports drawdown in %", () => {
    const r = simulate({ outcomes: [-100], trades: 10, runs: 50, startBalance: 1000, drawdownThreshold: 50 });
    assert.equal(r.probProfit, 0);
    assert.equal(r.final.p50, -1000);
    assert.equal(r.maxDrawdown.p50, 100);
    assert.equal(r.probDrawdownAbove, 1);
    assert.equal(r.longestLosingStreak.p50, 10);
  });

  it("returns bands from the start to the last trade", () => {
    const r = simulate({ outcomes: [1, -1], trades: 250, runs: 100 });
    assert.equal(r.bands[0].step, 0);
    assert.equal(r.bands[0].p50, 0);
    assert.equal(r.bands[r.bands.length - 1].step, 250);
  });
});
