"use client";

import { FanChart, type Band } from "./fan-chart";

/** Fan chart with a formatter chosen on the client (functions can't cross from the server). */
export function MoneyFanChart({ bands, currency, mode }: { bands: Band[]; currency: string; mode: "money" | "r" }) {
  const format =
    mode === "r"
      ? (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}R`
      : (n: number) =>
          `${n < 0 ? "-" : n > 0 ? "+" : ""}${new Intl.NumberFormat("en-US", { style: "currency", currency: currency === "USDT" ? "USD" : currency, maximumFractionDigits: 0 }).format(Math.abs(n))}`;
  return <FanChart bands={bands} format={format} unitLabel={mode === "r" ? "R" : "P&L"} />;
}
