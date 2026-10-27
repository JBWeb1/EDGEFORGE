import Papa from "papaparse";
import { computeTradeResult, isClosed, type TradeInput } from "@/lib/analytics/trade-math";
import { TEMPLATE_HEADERS } from "@/lib/import/csv";

export type ExportRow = TradeInput & {
  accountName: string;
  currency: string;
  notes: string | null;
  emotion: string | null;
  followedRules: boolean | null;
};

/**
 * Spreadsheet apps execute cells starting with these characters as formulas.
 * Text fields get a leading apostrophe; numbers are left alone.
 */
export function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** CSV in the import template's columns plus account and calculated fields. */
export function tradesToCsv(rows: ExportRow[]): string {
  const headers = [...TEMPLATE_HEADERS, "account", "currency", "emotion", "followed_rules", "gross_pnl", "net_pnl", "r_multiple"];
  const text = (v: string | null | undefined) => (v ? neutralizeFormula(v) : "");
  const num = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  const data = rows.map((t) => {
    const r = isClosed(t) ? computeTradeResult(t) : null;
    return [
      text(t.symbol),
      t.direction.toLowerCase(),
      num(t.quantity),
      t.entryAt.toISOString(),
      num(t.entryPrice),
      t.exitAt?.toISOString() ?? "",
      num(t.exitPrice),
      num(t.stopLoss),
      num(t.takeProfit),
      num(t.fees),
      num(t.multiplier),
      text(t.setup),
      text(t.strategy),
      text(t.notes),
      text((t.tags ?? []).join("; ")),
      num(t.maePrice),
      num(t.mfePrice),
      text(t.accountName),
      t.currency,
      t.emotion?.toLowerCase() ?? "",
      t.followedRules === null ? "" : t.followedRules ? "yes" : "no",
      r ? r.grossPnl.toString() : "",
      r ? r.netPnl.toString() : "",
      r?.rMultiple ? r.rMultiple.toDecimalPlaces(4).toString() : "",
    ];
  });
  return Papa.unparse({ fields: headers, data }, { newline: "\n" });
}
