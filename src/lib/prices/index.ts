import "server-only";
import { fetchBinance, fetchFinnhub, type Quote } from "./providers";
import { routeSymbol, type PriceRoute } from "./symbols";

const CACHE_MS = 15_000;
const cache = new Map<string, { at: number; quote: Quote | null }>();

export type PriceResult = {
  symbol: string;
  route: PriceRoute | null;
  quote: Quote | null;
  /** Why there is no quote, in words a trader understands. */
  reason?: string;
};

export function priceProvidersStatus() {
  return { binance: true, finnhub: Boolean(process.env.FINNHUB_API_KEY) };
}

/**
 * Latest prices for journal symbols. Results are cached per server instance for
 * 15 seconds so many open tabs don't multiply provider requests.
 */
export async function getPrices(symbols: string[], now = Date.now()): Promise<PriceResult[]> {
  const finnhubKey = process.env.FINNHUB_API_KEY;
  const routed = [...new Set(symbols)].map((symbol) => ({ symbol, route: routeSymbol(symbol) }));

  const stale = routed.filter(({ route }) => {
    if (!route) return false;
    const hit = cache.get(`${route.provider}:${route.providerSymbol}`);
    return !hit || now - hit.at > CACHE_MS;
  });
  const want = (p: PriceRoute["provider"]) => [
    ...new Set(stale.filter((r) => r.route!.provider === p).map((r) => r.route!.providerSymbol)),
  ];

  const [binance, finnhub] = await Promise.all([
    fetchBinance(want("binance")).catch(() => null),
    finnhubKey ? fetchFinnhub(want("finnhub"), finnhubKey).catch(() => null) : Promise.resolve(null),
  ]);
  for (const [provider, quotes] of [["binance", binance], ["finnhub", finnhub]] as const) {
    if (!quotes) continue; // provider unreachable: keep any older cached values
    for (const s of want(provider)) cache.set(`${provider}:${s}`, { at: now, quote: quotes.get(s) ?? null });
  }

  return routed.map(({ symbol, route }) => {
    if (!route) return { symbol, route, quote: null, reason: "No live data source for this instrument" };
    if (route.provider === "finnhub" && !finnhubKey) {
      return { symbol, route, quote: null, reason: "Add a Finnhub API key to enable stock & forex prices" };
    }
    const hit = cache.get(`${route.provider}:${route.providerSymbol}`);
    if (!hit) return { symbol, route, quote: null, reason: "Price source unreachable" };
    return hit.quote ? { symbol, route, quote: hit.quote } : { symbol, route, quote: null, reason: "Symbol not found at the price source" };
  });
}
