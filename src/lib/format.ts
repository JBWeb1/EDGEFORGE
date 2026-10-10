import Decimal from "decimal.js";

type Num = Decimal | number | string | null | undefined;

const toNumber = (v: Num) => (v === null || v === undefined ? null : new Decimal(v).toNumber());

export function money(v: Num, currency = "USD", { signed = false } = {}) {
  const n = toNumber(v);
  if (n === null) return "—";
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency === "USDT" ? "USD" : currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
  const sign = n < 0 ? "-" : signed && n > 0 ? "+" : "";
  return `${sign}${formatted}${currency === "USDT" ? " USDT" : ""}`;
}

export function percent(v: number | null | undefined, digits = 1) {
  return v === null || v === undefined ? "—" : `${v.toFixed(digits)}%`;
}

export function ratio(v: number | null | undefined, digits = 2) {
  return v === null || v === undefined ? "—" : v.toFixed(digits);
}

export function rMultiple(v: Num) {
  const n = toNumber(v);
  return n === null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(2)}R`;
}

/** Trims trailing zeros from stored decimals (e.g. 182.40000000 → 182.4). */
export function plain(v: Num) {
  return v === null || v === undefined ? "—" : new Decimal(v).toString();
}

export function pnlClass(v: Num) {
  const n = toNumber(v);
  if (n === null || n === 0) return "text-navy-200";
  return n > 0 ? "text-profit" : "text-loss";
}

export function formatDuration(ms: number | null) {
  if (ms === null) return "—";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}
