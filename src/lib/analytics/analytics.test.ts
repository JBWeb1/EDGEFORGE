import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeClosedResults, computeTradeResult, isClosed, type ClosedTrade, type TradeInput } from "./trade-math";
import { breakdown, dailyEquityCurve, maxDrawdown, summarize } from "./metrics";
import { generateInsights, MIN_SAMPLE } from "./insights";

let seq = 0;
function trade(overrides: Partial<TradeInput>): TradeInput {
  seq += 1;
  return {
    id: `t${String(seq).padStart(4, "0")}`,
    symbol: "AAPL",
    direction: "LONG",
    quantity: "10",
    entryPrice: "100",
    entryAt: new Date(Date.UTC(2026, 0, 5, 14, 30) + seq * 60_000),
    exitPrice: "110",
    exitAt: new Date(Date.UTC(2026, 0, 5, 15, 30) + seq * 60_000),
    fees: "0",
    ...overrides,
  };
}

const result = (overrides: Partial<TradeInput>) => computeTradeResult(trade(overrides) as ClosedTrade);

/** A trade with a chosen net P&L: 1 unit, entry 100, exit 100 + pnl. */
const pnlTrade = (pnl: number, extra: Partial<TradeInput> = {}) =>
  trade({ quantity: "1", entryPrice: "100", exitPrice: String(100 + pnl), ...extra });

describe("computeTradeResult", () => {
  it("calculates long P&L net of fees", () => {
    const r = result({ fees: "2.50" });
    assert.equal(r.grossPnl.toString(), "100");
    assert.equal(r.netPnl.toString(), "97.5");
    assert.equal(r.outcome, "WIN");
  });

  it("calculates short P&L", () => {
    const r = result({ direction: "SHORT", entryPrice: "50", exitPrice: "45", quantity: "3", fees: "1" });
    assert.equal(r.grossPnl.toString(), "15");
    assert.equal(r.netPnl.toString(), "14");
  });

  it("is exact for decimal prices (no floating point drift)", () => {
    const r = result({ entryPrice: "1.1", exitPrice: "1.3", quantity: "3", fees: "0.1" });
    // In floating point (1.3 - 1.1) * 3 - 0.1 = 0.5000000000000002
    assert.equal(r.netPnl.toString(), "0.5");
  });

  it("applies the contract multiplier", () => {
    const r = result({ symbol: "ES", entryPrice: "5000", exitPrice: "4990.25", quantity: "2", multiplier: "50", fees: "8.4" });
    assert.equal(r.grossPnl.toString(), "-975");
    assert.equal(r.netPnl.toString(), "-983.4");
    assert.equal(r.outcome, "LOSS");
  });

  it("computes initial risk, R multiple and planned reward:risk", () => {
    const r = result({ entryPrice: "100", stopLoss: "98", takeProfit: "106", exitPrice: "104", quantity: "10", fees: "0" });
    assert.equal(r.initialRisk!.toString(), "20");
    assert.equal(r.rMultiple!.toString(), "2");
    assert.equal(r.plannedRewardRisk!.toString(), "3");
  });

  it("works out risk for shorts with the stop above entry", () => {
    const r = result({ direction: "SHORT", entryPrice: "100", stopLoss: "102", exitPrice: "103", quantity: "5" });
    assert.equal(r.initialRisk!.toString(), "10");
    assert.equal(r.rMultiple!.toString(), "-1.5");
  });

  it("leaves R undefined without a stop or with a stop at entry", () => {
    assert.equal(result({}).rMultiple, null);
    assert.equal(result({ stopLoss: "100" }).rMultiple, null);
  });

  it("flags breakeven trades", () => {
    assert.equal(result({ exitPrice: "100" }).outcome, "BREAKEVEN");
  });
});

describe("computeClosedResults", () => {
  it("excludes open trades and sorts by exit time", () => {
    const late = trade({ exitAt: new Date("2026-02-01T00:00:00Z") });
    const early = trade({ exitAt: new Date("2026-01-01T00:00:00Z") });
    const open = trade({ exitPrice: null, exitAt: null });
    assert.equal(isClosed(open), false);
    const ids = computeClosedResults([late, open, early]).map((r) => r.trade.id);
    assert.deepEqual(ids, [early.id, late.id]);
  });
});

describe("summarize", () => {
  const results = computeClosedResults([
    pnlTrade(100),
    pnlTrade(-50),
    pnlTrade(200),
    pnlTrade(0),
    pnlTrade(-100),
  ]);
  const s = summarize(results, 1000);

  it("counts outcomes", () => {
    assert.equal(s.closedTrades, 5);
    assert.equal(s.wins, 2);
    assert.equal(s.losses, 2);
    assert.equal(s.breakevens, 1);
  });

  it("computes win rate over all closed trades", () => {
    assert.equal(s.winRate, 40);
  });

  it("computes profit factor, expectancy and payoff", () => {
    assert.equal(s.netPnl.toString(), "150");
    assert.equal(s.profitFactor, 2); // 300 / 150
    assert.equal(s.expectancy!.toString(), "30");
    assert.equal(s.averageWin!.toString(), "150");
    assert.equal(s.averageLoss!.toString(), "-75");
    assert.equal(s.payoffRatio, 2);
    assert.equal(s.largestWin!.toString(), "200");
    assert.equal(s.largestLoss!.toString(), "-100");
  });

  it("computes balance and return", () => {
    assert.equal(s.endingBalance.toString(), "1150");
    assert.equal(s.returnPct, 15);
  });

  it("returns null profit factor when there are no losses", () => {
    assert.equal(summarize(computeClosedResults([pnlTrade(10)])).profitFactor, null);
  });

  it("handles an empty journal", () => {
    const empty = summarize([], 0);
    assert.equal(empty.winRate, null);
    assert.equal(empty.expectancy, null);
    assert.equal(empty.maxDrawdownPct, null);
    assert.equal(empty.netPnl.toString(), "0");
  });
});

describe("maxDrawdown", () => {
  it("measures the largest peak-to-trough fall from the starting balance", () => {
    // Equity: 1000 -> 1100 -> 1000 -> 1300 -> 1040 -> 1200
    const results = computeClosedResults([pnlTrade(100), pnlTrade(-100), pnlTrade(300), pnlTrade(-260), pnlTrade(160)]);
    const dd = maxDrawdown(results, 1000);
    assert.equal(dd.amount.toString(), "260");
    assert.equal(dd.pct, 20); // 260 / 1300
  });

  it("counts an immediate loss against the starting balance", () => {
    const dd = maxDrawdown(computeClosedResults([pnlTrade(-50)]), 1000);
    assert.equal(dd.amount.toString(), "50");
    assert.equal(dd.pct, 5);
  });

  it("gives no percentage when the peak balance is not positive", () => {
    const dd = maxDrawdown(computeClosedResults([pnlTrade(-50)]), 0);
    assert.equal(dd.amount.toString(), "50");
    assert.equal(dd.pct, null);
  });
});

describe("streaks", () => {
  it("tracks the longest winning and losing runs", () => {
    const s = summarize(computeClosedResults([1, 1, -1, -1, -1, 0, -1, 1, 1, 1].map((p) => pnlTrade(p))));
    assert.equal(s.longestWinStreak, 3);
    assert.equal(s.longestLossStreak, 3);
  });
});

describe("dailyEquityCurve", () => {
  it("buckets trades by UTC exit day", () => {
    const results = computeClosedResults([
      pnlTrade(10, { exitAt: new Date("2026-03-02T10:00:00Z") }),
      pnlTrade(-4, { exitAt: new Date("2026-03-02T23:59:00Z") }),
      pnlTrade(20, { exitAt: new Date("2026-03-03T00:01:00Z") }),
    ]);
    const curve = dailyEquityCurve(results, 100);
    assert.deepEqual(
      curve.map((p) => [p.date, p.equity.toString(), p.pnl.toString(), p.trades]),
      [
        ["2026-03-02", "106", "6", 2],
        ["2026-03-03", "126", "20", 1],
      ],
    );
  });
});

describe("breakdown", () => {
  it("groups by setup and sorts by net P&L", () => {
    const results = computeClosedResults([
      pnlTrade(10, { setup: "Breakout" }),
      pnlTrade(-5, { setup: "Breakout" }),
      pnlTrade(-20, { setup: "Reversal" }),
      pnlTrade(3, { setup: null }),
    ]);
    const rows = breakdown(results, "setup");
    assert.deepEqual(rows.map((r) => [r.key, r.trades, r.netPnl.toString()]), [
      ["Breakout", 2, "5"],
      ["No setup", 1, "3"],
      ["Reversal", 1, "-20"],
    ]);
    assert.equal(rows[0].winRate, 50);
  });

  it("uses the trader's time zone for weekdays and hours", () => {
    // Friday 23:30 UTC is Saturday 01:30 in Johannesburg.
    const results = computeClosedResults([
      pnlTrade(1, { entryAt: new Date("2026-03-06T23:30:00Z"), exitAt: new Date("2026-03-06T23:45:00Z") }),
    ]);
    assert.equal(breakdown(results, "weekday")[0].key, "Friday");
    assert.equal(breakdown(results, "weekday", "Africa/Johannesburg")[0].key, "Saturday");
    assert.equal(breakdown(results, "hour", "Africa/Johannesburg")[0].key, "01:00");
    assert.equal(dailyEquityCurve(results, 0, "Africa/Johannesburg")[0].date, "2026-03-07");
  });

  it("counts a trade in every one of its tags", () => {
    const results = computeClosedResults([
      pnlTrade(10, { tags: ["news", "a+"] }),
      pnlTrade(-4, { tags: ["news"] }),
      pnlTrade(2, {}),
    ]);
    const rows = breakdown(results, "tag");
    assert.deepEqual(rows.map((r) => [r.key, r.trades, r.netPnl.toString()]), [
      ["a+", 1, "10"],
      ["news", 2, "6"],
      ["Untagged", 1, "2"],
    ]);
  });

  it("orders weekdays by calendar", () => {
    const results = computeClosedResults([
      pnlTrade(1, { entryAt: new Date("2026-03-06T10:00:00Z"), exitAt: new Date("2026-03-06T11:00:00Z") }), // Fri
      pnlTrade(1, { entryAt: new Date("2026-03-02T10:00:00Z"), exitAt: new Date("2026-03-02T11:00:00Z") }), // Mon
    ]);
    assert.deepEqual(breakdown(results, "weekday").map((r) => r.key), ["Monday", "Friday"]);
  });
});

describe("generateInsights", () => {
  it("refuses to draw conclusions from too few trades", () => {
    const insights = generateInsights(computeClosedResults([pnlTrade(10)]));
    assert.equal(insights.length, 1);
    assert.equal(insights[0].id, "sample-size");
  });

  it("compares rule-following and rule-breaking trades with evidence", () => {
    const followed = Array.from({ length: MIN_SAMPLE }, () => pnlTrade(20, { followedRules: true }));
    const broke = Array.from({ length: MIN_SAMPLE }, () => pnlTrade(-10, { followedRules: false }));
    const insights = generateInsights(computeClosedResults([...followed, ...broke]));
    const rules = insights.find((i) => i.id === "rules");
    assert.ok(rules);
    assert.equal(rules.tone, "positive");
    assert.ok(rules.evidence.some((e) => e.label === "Followed rules: avg per trade" && e.value === "+20.00"));
    assert.ok(rules.evidence.some((e) => e.label === "Broke rules: avg per trade" && e.value === "-10.00"));
  });

  it("ignores groups below the minimum sample size", () => {
    const trades = [
      ...Array.from({ length: MIN_SAMPLE }, () => pnlTrade(5, { followedRules: true })),
      ...Array.from({ length: MIN_SAMPLE - 1 }, () => pnlTrade(-5, { followedRules: false })),
    ];
    assert.equal(generateInsights(computeClosedResults(trades)).find((i) => i.id === "rules"), undefined);
  });
});
