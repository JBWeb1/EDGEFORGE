"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Card, CardTitle, cn } from "@/components/ui";
import { computeTradeResult, type Direction } from "@/lib/analytics/trade-math";
import { money, plain, pnlClass, rMultiple } from "@/lib/format";
import { useVisibleInterval } from "./use-visible-interval";

export type OpenPosition = {
  id: string;
  symbol: string;
  direction: Direction;
  quantity: string;
  multiplier: string;
  entryPrice: string;
  stopLoss: string | null;
  fees: string;
  entryAt: string;
};

type PriceInfo = { quote: { price: string; asOf: number; provider: string } | null; reason: string | null };

const REFRESH_MS = 20_000;

/** Open trades with unrealised P&L that updates from live market prices. */
export function OpenPositions({ positions, currency }: { positions: OpenPosition[]; currency: string }) {
  const [prices, setPrices] = useState<Record<string, PriceInfo>>({});
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/prices", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { prices: Record<string, PriceInfo> };
      setPrices(body.prices);
      setUpdatedAt(Date.now());
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useVisibleInterval(load, REFRESH_MS, { immediate: true });

  const rows = positions.map((p) => {
    const info = prices[p.symbol];
    const quote = info?.quote ?? null;
    const result = quote
      ? computeTradeResult({ ...p, entryAt: new Date(p.entryAt), exitPrice: quote.price, exitAt: new Date() })
      : null;
    return { p, info, quote, result };
  });
  const priced = rows.filter((r) => r.result);
  const total = priced.reduce((acc, r) => acc + r.result!.netPnl.toNumber(), 0);

  return (
    <Card>
      <CardTitle
        action={
          <span className="text-xs text-navy-400">
            {error ? "Prices unavailable — retrying" : updatedAt ? `Updated ${new Date(updatedAt).toLocaleTimeString()}` : "Loading prices…"}
          </span>
        }
      >
        Open positions
      </CardTitle>
      {priced.length > 0 && (
        <p className="mb-3 text-sm text-navy-300">
          Unrealised if closed now:{" "}
          <span className={cn("num font-semibold", pnlClass(total))}>{money(total, currency, { signed: true })}</span>
          {priced.length < rows.length && <span className="text-navy-400"> ({priced.length} of {rows.length} priced)</span>}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-navy-400">
            <tr>
              <th className="pb-2 font-medium">Symbol</th>
              <th className="pb-2 text-right font-medium">Entry</th>
              <th className="pb-2 text-right font-medium">Last</th>
              <th className="pb-2 text-right font-medium">Unrealised</th>
              <th className="pb-2 text-right font-medium">R</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-700/60">
            {rows.map(({ p, info, quote, result }) => (
              <tr key={p.id}>
                <td className="py-2">
                  <Link href={`/trades/${p.id}`} className="font-medium text-white hover:text-electric-soft">{p.symbol}</Link>
                  <span className="ml-2 text-xs text-navy-400">{p.direction === "LONG" ? "Long" : "Short"} {plain(p.quantity)}</span>
                </td>
                <td className="num py-2 text-right">{plain(p.entryPrice)}</td>
                <td className="num py-2 text-right">
                  {quote ? plain(quote.price) : <span className="text-xs text-navy-400">{info?.reason ?? "…"}</span>}
                </td>
                <td className={cn("num py-2 text-right font-medium", pnlClass(result?.netPnl))}>
                  {result ? money(result.netPnl, currency, { signed: true }) : "—"}
                </td>
                <td className={cn("num py-2 text-right", pnlClass(result?.rMultiple))}>{result ? rMultiple(result.rMultiple) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-navy-400">
        Unrealised P&amp;L is after the fees you entered. Prices come from public market-data feeds, may be delayed, and are for
        journaling only.
      </p>
    </Card>
  );
}
