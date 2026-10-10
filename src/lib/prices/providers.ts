import "server-only";

export type Quote = {
  symbol: string;
  price: string;
  /** When the provider says the price was observed (ms since epoch). */
  asOf: number;
  provider: "binance" | "finnhub";
};

type Fetch = typeof fetch;
const TIMEOUT_MS = 5000;

/** Binance public spot prices. No API key needed. */
export async function fetchBinance(symbols: string[], f: Fetch = fetch): Promise<Map<string, Quote>> {
  const out = new Map<string, Quote>();
  if (!symbols.length) return out;
  const url = new URL("https://api.binance.com/api/v3/ticker/price");
  url.searchParams.set("symbols", JSON.stringify(symbols));
  const res = await f(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  if (!res.ok) {
    // An unknown symbol fails the whole batch; retry one by one.
    if (res.status === 400 && symbols.length > 1) {
      const singles = await Promise.allSettled(symbols.map((s) => fetchBinance([s], f)));
      for (const r of singles) if (r.status === "fulfilled") r.value.forEach((q, k) => out.set(k, q));
    }
    return out;
  }
  const body = (await res.json()) as { symbol: string; price: string }[];
  const now = Date.now();
  for (const row of body) {
    if (typeof row.price === "string" && Number(row.price) > 0) {
      out.set(row.symbol, { symbol: row.symbol, price: row.price, asOf: now, provider: "binance" });
    }
  }
  return out;
}

/** Finnhub quotes for stocks (and forex where the plan allows). Needs FINNHUB_API_KEY. */
export async function fetchFinnhub(symbols: string[], apiKey: string, f: Fetch = fetch): Promise<Map<string, Quote>> {
  const out = new Map<string, Quote>();
  const results = await Promise.allSettled(
    symbols.map(async (symbol) => {
      const url = new URL("https://finnhub.io/api/v1/quote");
      url.searchParams.set("symbol", symbol);
      const res = await f(url, {
        headers: { "X-Finnhub-Token": apiKey },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      if (!res.ok) return null;
      const q = (await res.json()) as { c?: number; t?: number };
      // Finnhub answers unknown symbols with c = 0.
      if (typeof q.c !== "number" || !(q.c > 0)) return null;
      return { symbol, price: String(q.c), asOf: q.t ? q.t * 1000 : Date.now(), provider: "finnhub" as const };
    }),
  );
  for (const r of results) if (r.status === "fulfilled" && r.value) out.set(r.value.symbol, r.value);
  return out;
}
