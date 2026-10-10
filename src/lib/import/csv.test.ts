import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseIsoDate, parseNumber, parseTradeCsv, templateCsv } from "./csv";

describe("parseIsoDate", () => {
  it("reads dates without offset as UTC", () => {
    assert.equal(parseIsoDate("2026-03-02 14:30")!.toISOString(), "2026-03-02T14:30:00.000Z");
    assert.equal(parseIsoDate("2026-03-02")!.toISOString(), "2026-03-02T00:00:00.000Z");
  });
  it("applies offsets", () => {
    assert.equal(parseIsoDate("2026-03-02T14:30:00+02:00")!.toISOString(), "2026-03-02T12:30:00.000Z");
    assert.equal(parseIsoDate("2026-03-02T14:30:00.250Z")!.toISOString(), "2026-03-02T14:30:00.250Z");
  });
  it("rejects ambiguous and impossible dates", () => {
    assert.equal(parseIsoDate("03/02/2026"), null);
    assert.equal(parseIsoDate("2026-02-30"), null);
    assert.equal(parseIsoDate("2026-03-02 25:00"), null);
  });
});

describe("parseNumber", () => {
  it("handles currency symbols, thousands separators and accounting negatives", () => {
    assert.equal(parseNumber("$1,234.50")!.toString(), "1234.5");
    assert.equal(parseNumber("(12.5)")!.toString(), "-12.5");
    assert.equal(parseNumber(".5")!.toString(), "0.5");
  });
  it("rejects ambiguous formats", () => {
    assert.equal(parseNumber("1,5"), null);
    assert.equal(parseNumber("abc"), null);
  });
});

describe("parseTradeCsv", () => {
  it("parses the template", () => {
    const r = parseTradeCsv(templateCsv());
    assert.deepEqual(r.fileErrors, []);
    assert.equal(r.rows.length, 3);
    assert.ok(r.rows.every((row) => row.ok));
    const [first, , open] = r.rows;
    assert.ok(first.ok && open.ok);
    assert.equal(first.trade.direction, "LONG");
    assert.equal(first.trade.exitPrice, "184.1");
    assert.equal(open.trade.exitPrice, null);
    assert.equal(open.trade.multiplier, "50");
  });

  it("maps common broker column names", () => {
    const csv = "Ticker,Side,Qty,Open Time,Open Price,Close Time,Close Price,Commission\nmsft,SELL,5,2026-01-02 10:00,400,2026-01-02 11:00,395,-1.25\n";
    const r = parseTradeCsv(csv);
    assert.equal(r.mapping.symbol, "ticker");
    const row = r.rows[0];
    assert.ok(row.ok);
    assert.equal(row.trade.symbol, "MSFT");
    assert.equal(row.trade.direction, "SHORT");
    assert.equal(row.trade.fees, "1.25");
  });

  it("reports missing required columns", () => {
    const r = parseTradeCsv("symbol,direction\nAAPL,long\n");
    assert.match(r.fileErrors[0], /quantity, entry_date, entry_price/);
  });

  it("reports row-level errors with line numbers", () => {
    const csv = [
      "symbol,direction,quantity,entry_date,entry_price,exit_date,exit_price",
      "AAPL,sideways,-1,03/02/2026,100,,",
      "AAPL,long,1,2026-03-02,100,2026-03-01,101",
      "AAPL,long,1,2026-03-02,100,,101",
    ].join("\n");
    const rows = parseTradeCsv(csv).rows;
    assert.equal(rows[0].line, 2);
    assert.ok(!rows[0].ok && rows[0].errors.length === 3);
    assert.ok(!rows[1].ok && rows[1].errors.includes("Exit date is before entry date."));
    assert.ok(!rows[2].ok && /both be filled in/.test(rows[2].errors[0]));
  });

  it("flags duplicate rows within a file and fingerprints deterministically", () => {
    const line = "AAPL,long,1,2026-03-02 10:00,100.0,2026-03-02 11:00,101";
    const csv = ["symbol,direction,quantity,entry_date,entry_price,exit_date,exit_price", line, line.replace("100.0", "100")].join("\n");
    const rows = parseTradeCsv(csv).rows;
    assert.ok(rows[0].ok);
    assert.ok(!rows[1].ok && rows[1].errors[0] === "Duplicate of line 2 in this file.");
  });
});
