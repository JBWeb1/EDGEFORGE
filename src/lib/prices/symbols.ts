/**
 * Decides which market-data source can price a journal symbol. Symbols that
 * can't be matched confidently (e.g. futures like "ES") get no live price
 * rather than a guessed one.
 */

export type Market = "crypto" | "forex" | "stock";
export type PriceRoute = { market: Market; provider: "binance" | "finnhub"; providerSymbol: string };

const CURRENCIES = new Set(["USD", "EUR", "GBP", "JPY", "CHF", "AUD", "NZD", "CAD", "ZAR", "SEK", "NOK", "DKK", "SGD", "HKD", "MXN", "TRY", "PLN", "CNH"]);
const CRYPTO_QUOTES = ["USDT", "USDC", "FDUSD", "BTC", "ETH"];

export function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/[\s/_-]/g, "");
}

export function routeSymbol(symbol: string): PriceRoute | null {
  const s = normalizeSymbol(symbol);
  if (!/^[A-Z0-9.]{1,20}$/.test(s)) return null;

  if (s.length === 6 && CURRENCIES.has(s.slice(0, 3)) && CURRENCIES.has(s.slice(3))) {
    return { market: "forex", provider: "finnhub", providerSymbol: `OANDA:${s.slice(0, 3)}_${s.slice(3)}` };
  }
  const quote = CRYPTO_QUOTES.find((q) => s.endsWith(q) && s.length > q.length + 1);
  if (quote) return { market: "crypto", provider: "binance", providerSymbol: s };

  // Plain tickers (letters, optional class suffix like BRK.B) are treated as stocks.
  if (/^[A-Z]{1,5}(\.[A-Z])?$/.test(s)) return { market: "stock", provider: "finnhub", providerSymbol: s };
  return null;
}
