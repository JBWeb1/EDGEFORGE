import { createHash } from "node:crypto";
import Decimal from "decimal.js";
import Papa from "papaparse";
import { zonedTimeToUtc } from "@/lib/analytics/timezone";
import { parseTags } from "@/lib/tags";

/**
 * Parses and validates a trade CSV. Nothing is written to the database here:
 * the caller previews the result and imports only the valid rows.
 *
 * Rules (also documented on the import page):
 * - Dates must be ISO 8601 (2026-03-02, 2026-03-02 14:30, 2026-03-02T14:30:00Z,
 *   2026-03-02T14:30:00+02:00). Without an offset, times are read in the
 *   trader's time zone (UTC unless set in Settings).
 *   Ambiguous formats such as 03/02/2026 are rejected rather than guessed.
 * - Numbers use "." as the decimal separator. Currency symbols and thousands
 *   separators ("1,234.50") are tolerated.
 * - Fees are always treated as a cost, whatever their sign in the file.
 * - A row without exit price and exit date is imported as an open trade.
 */

export const MAX_ROWS = 5000;

export const TEMPLATE_HEADERS = [
  "symbol",
  "direction",
  "quantity",
  "entry_date",
  "entry_price",
  "exit_date",
  "exit_price",
  "stop_loss",
  "take_profit",
  "fees",
  "multiplier",
  "setup",
  "strategy",
  "notes",
  "tags",
  "mae_price",
  "mfe_price",
] as const;

type Field = (typeof TEMPLATE_HEADERS)[number];

const ALIASES: Record<Field, string[]> = {
  symbol: ["symbol", "ticker", "instrument", "market", "pair", "asset"],
  direction: ["direction", "side", "type", "position", "long_short"],
  quantity: ["quantity", "qty", "size", "volume", "lots", "shares", "contracts", "units", "amount"],
  entry_date: ["entry_date", "entry_time", "open_date", "open_time", "opened", "entry_datetime", "date_opened"],
  entry_price: ["entry_price", "open_price", "entry", "avg_entry_price", "buy_price"],
  exit_date: ["exit_date", "exit_time", "close_date", "close_time", "closed", "exit_datetime", "date_closed"],
  exit_price: ["exit_price", "close_price", "exit", "avg_exit_price", "sell_price"],
  stop_loss: ["stop_loss", "sl", "stop", "stop_price"],
  take_profit: ["take_profit", "tp", "target", "target_price"],
  fees: ["fees", "fee", "commission", "commissions", "costs"],
  multiplier: ["multiplier", "point_value", "contract_size", "tick_value_per_point"],
  setup: ["setup", "pattern"],
  strategy: ["strategy", "playbook"],
  notes: ["notes", "note", "comment", "comments", "description"],
  tags: ["tags", "tag", "labels"],
  mae_price: ["mae_price", "mae", "worst_price", "max_adverse_price"],
  mfe_price: ["mfe_price", "mfe", "best_price", "max_favorable_price"],
};

const normalizeHeader = (h: string) =>
  h.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

export type ImportedTrade = {
  symbol: string;
  direction: "LONG" | "SHORT";
  quantity: string;
  multiplier: string;
  entryPrice: string;
  entryAt: Date;
  exitPrice: string | null;
  exitAt: Date | null;
  stopLoss: string | null;
  takeProfit: string | null;
  fees: string;
  setup: string | null;
  strategy: string | null;
  notes: string | null;
  tags: string[];
  maePrice: string | null;
  mfePrice: string | null;
  fingerprint: string;
};

export type RowResult =
  | { line: number; ok: true; trade: ImportedTrade }
  | { line: number; ok: false; errors: string[]; raw: Record<string, string> };

export type ParseResult = {
  /** Fatal problems with the file itself (missing columns, too many rows...). */
  fileErrors: string[];
  /** Which file column was mapped to each EDGEFORGE field. */
  mapping: Partial<Record<Field, string>>;
  rows: RowResult[];
};

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(\.\d{1,9})?)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i;

export function parseIsoDate(value: string, timeZone = "UTC"): Date | null {
  const m = DATE_RE.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h = "00", mi = "00", s = "00", frac = "", tz] = m;
  const [year, month, day, hour, minute, second] = [y, mo, d, h, mi, s].map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
  // Reject impossible calendar dates such as 2026-02-30.
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  const ms = frac ? Math.round(Number(frac) * 1000) : 0;
  if (!tz) return zonedTimeToUtc(year, month, day, hour, minute, second, ms, timeZone);
  let offsetMinutes = 0;
  if (tz.toUpperCase() !== "Z") {
    const digits = tz.replace(":", "");
    const sign = digits[0] === "-" ? -1 : 1;
    offsetMinutes = sign * (Number(digits.slice(1, 3)) * 60 + Number(digits.slice(3, 5)));
  }
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second, ms) - offsetMinutes * 60_000);
}

export function parseNumber(value: string): Decimal | null {
  let v = value.trim().replace(/^[$€£¥R]\s?/, "").replace(/\s/g, "");
  let negative = false;
  if (/^\(.*\)$/.test(v)) {
    negative = true;
    v = v.slice(1, -1);
  }
  if (/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(v)) v = v.replace(/,/g, "");
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(v)) return null;
  const d = new Decimal(v);
  return negative ? d.neg() : d;
}

function parseDirection(value: string): "LONG" | "SHORT" | null {
  const v = value.trim().toLowerCase();
  if (["long", "buy", "l", "b", "bought"].includes(v)) return "LONG";
  if (["short", "sell", "s", "sold", "sell short", "short sell"].includes(v)) return "SHORT";
  return null;
}

export function tradeFingerprint(
  t: Omit<ImportedTrade, "fingerprint" | "setup" | "strategy" | "notes" | "tags" | "maePrice" | "mfePrice">,
): string {
  const parts = [
    t.symbol,
    t.direction,
    t.entryAt.toISOString(),
    new Decimal(t.entryPrice).toString(),
    new Decimal(t.quantity).toString(),
    t.exitAt?.toISOString() ?? "",
    t.exitPrice === null ? "" : new Decimal(t.exitPrice).toString(),
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

export function parseTradeCsv(text: string, { timeZone = "UTC" }: { timeZone?: string } = {}): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normalizeHeader,
  });

  const headers = parsed.meta.fields ?? [];
  const mapping: Partial<Record<Field, string>> = {};
  for (const field of TEMPLATE_HEADERS) {
    const match = ALIASES[field].find((alias) => headers.includes(alias));
    if (match) mapping[field] = match;
  }

  const fileErrors: string[] = [];
  const required: Field[] = ["symbol", "direction", "quantity", "entry_date", "entry_price"];
  const missing = required.filter((f) => !mapping[f]);
  if (missing.length) fileErrors.push(`Missing required column(s): ${missing.join(", ")}.`);
  if (parsed.data.length === 0) fileErrors.push("The file contains no data rows.");
  if (parsed.data.length > MAX_ROWS) fileErrors.push(`The file has ${parsed.data.length} rows; the limit is ${MAX_ROWS} per import.`);
  if (fileErrors.length) return { fileErrors, mapping, rows: [] };

  const rows = parsed.data.map((raw, i): RowResult => {
    const line = i + 2; // header is line 1
    const get = (f: Field) => (mapping[f] ? (raw[mapping[f]!] ?? "").trim() : "");
    const errors: string[] = [];

    const symbol = get("symbol").toUpperCase();
    if (!symbol) errors.push("Symbol is required.");
    else if (symbol.length > 32) errors.push("Symbol is longer than 32 characters.");

    const direction = parseDirection(get("direction"));
    if (!direction) errors.push(`Direction "${get("direction")}" is not long/short or buy/sell.`);

    const positive = (f: Field, label: string, optional: boolean) => {
      const v = get(f);
      if (!v) {
        if (!optional) errors.push(`${label} is required.`);
        return null;
      }
      const n = parseNumber(v);
      if (!n || !n.gt(0)) {
        errors.push(`${label} "${v}" must be a positive number.`);
        return null;
      }
      return n.toString();
    };

    const quantity = positive("quantity", "Quantity", false);
    const entryPrice = positive("entry_price", "Entry price", false);
    const exitPrice = positive("exit_price", "Exit price", true);
    const stopLoss = positive("stop_loss", "Stop loss", true);
    const takeProfit = positive("take_profit", "Take profit", true);
    const multiplier = positive("multiplier", "Multiplier", true) ?? "1";
    const maePrice = positive("mae_price", "Worst price (MAE)", true);
    const mfePrice = positive("mfe_price", "Best price (MFE)", true);

    let fees = "0";
    if (get("fees")) {
      const n = parseNumber(get("fees"));
      if (!n) errors.push(`Fees "${get("fees")}" is not a number.`);
      else fees = n.abs().toString();
    }

    const date = (f: Field, label: string) => {
      const v = get(f);
      if (!v) return null;
      const d = parseIsoDate(v, timeZone);
      if (!d) errors.push(`${label} "${v}" is not an ISO 8601 date (e.g. 2026-03-02 14:30).`);
      return d;
    };
    const entryAt = date("entry_date", "Entry date");
    if (!get("entry_date")) errors.push("Entry date is required.");
    const exitAt = date("exit_date", "Exit date");

    if (!!get("exit_price") !== !!get("exit_date")) {
      errors.push("Exit price and exit date must both be filled in (closed trade) or both left empty (open trade).");
    }
    if (entryAt && exitAt && exitAt < entryAt) errors.push("Exit date is before entry date.");
    if (direction && entryPrice) {
      const long = direction === "LONG";
      const worse = (a: number, b: number) => (long ? a <= b : a >= b);
      const e = Number(entryPrice);
      const x = exitPrice ? Number(exitPrice) : null;
      if (maePrice && (!worse(Number(maePrice), e) || (x !== null && !worse(Number(maePrice), x)))) {
        errors.push(`Worst price ${maePrice} is on the wrong side of the entry/exit for a ${direction.toLowerCase()} trade.`);
      }
      if (mfePrice && (!worse(e, Number(mfePrice)) || (x !== null && !worse(x, Number(mfePrice))))) {
        errors.push(`Best price ${mfePrice} is on the wrong side of the entry/exit for a ${direction.toLowerCase()} trade.`);
      }
    }
    const tagResult = parseTags(get("tags"));
    if (tagResult.error) errors.push(tagResult.error);

    if (errors.length || !direction || !quantity || !entryPrice || !entryAt) {
      return { line, ok: false, errors, raw };
    }

    const base = {
      symbol,
      direction,
      quantity,
      multiplier,
      entryPrice,
      entryAt,
      exitPrice: exitPrice && exitAt ? exitPrice : null,
      exitAt: exitPrice && exitAt ? exitAt : null,
      stopLoss,
      takeProfit,
      fees,
    };
    const text = (f: Field, max: number) => get(f).slice(0, max) || null;
    return {
      line,
      ok: true,
      trade: {
        ...base,
        setup: text("setup", 80),
        strategy: text("strategy", 80),
        notes: text("notes", 5000),
        tags: tagResult.tags,
        maePrice,
        mfePrice,
        fingerprint: tradeFingerprint(base),
      },
    };
  });

  // Duplicate rows within the same file.
  const seen = new Map<string, number>();
  const deduped = rows.map((r): RowResult => {
    if (!r.ok) return r;
    const first = seen.get(r.trade.fingerprint);
    if (first !== undefined) {
      return { line: r.line, ok: false, errors: [`Duplicate of line ${first} in this file.`], raw: {} };
    }
    seen.set(r.trade.fingerprint, r.line);
    return r;
  });

  return { fileErrors, mapping, rows: deduped };
}

export function templateCsv(): string {
  return [
    TEMPLATE_HEADERS.join(","),
    'AAPL,long,50,2026-03-02 14:35,182.40,2026-03-02 15:50,184.10,181.50,185.00,1.00,1,Opening range breakout,Momentum,Clean break of OR high,"a+ setup; news",181.80,185.20',
    "EURUSD,short,10000,2026-03-03T08:15:00Z,1.0852,2026-03-03T10:40:00Z,1.0831,1.0870,1.0815,0.70,1,London reversal,Mean reversion,,,,",
    "ES,long,1,2026-03-04 15:00,5012.25,,,5004.00,5030.00,2.10,50,Pullback,Trend,Still open,,,",
  ].join("\n");
}
