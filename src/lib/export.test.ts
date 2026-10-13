import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseTradeCsv } from "@/lib/import/csv";
import { neutralizeFormula, tradesToCsv, type ExportRow } from "./export";

const row: ExportRow = {
  id: "x",
  symbol: "AAPL",
  direction: "SHORT",
  quantity: "10",
  multiplier: "1",
  entryPrice: "190.5",
  entryAt: new Date("2026-03-02T14:30:00Z"),
  exitPrice: "188",
  exitAt: new Date("2026-03-02T15:00:00Z"),
  stopLoss: "192",
  takeProfit: null,
  fees: "1.5",
  setup: "Fade, \"quoted\"",
  strategy: null,
  notes: "=HYPERLINK(\"http://evil\")",
  tags: ["news", "a+ setup"],
  accountName: "Main",
  currency: "USD",
  emotion: "CALM",
  followedRules: true,
};

describe("tradesToCsv", () => {
  it("adds calculated columns and escapes text", () => {
    const csv = tradesToCsv([row]);
    assert.match(csv, /,25,23\.5,1\.5667$/m); // net = 2.5*10 - 1.5; R = 23.5 / 15
    assert.match(csv, /"Fade, ""quoted"""/);
    assert.match(csv, /'=HYPERLINK/);
  });

  it("round-trips through the importer", () => {
    const parsed = parseTradeCsv(tradesToCsv([row]));
    assert.deepEqual(parsed.fileErrors, []);
    const r = parsed.rows[0];
    assert.ok(r.ok);
    assert.equal(r.trade.direction, "SHORT");
    assert.equal(r.trade.entryAt.toISOString(), "2026-03-02T14:30:00.000Z");
    assert.equal(r.trade.exitPrice, "188");
    assert.equal(r.trade.fees, "1.5");
    assert.deepEqual(r.trade.tags, ["news", "a+ setup"]);
  });
});

describe("neutralizeFormula", () => {
  it("only touches formula-like text", () => {
    assert.equal(neutralizeFormula("@SUM(A1)"), "'@SUM(A1)");
    assert.equal(neutralizeFormula("Breakout"), "Breakout");
  });
});
