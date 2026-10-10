import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { routeSymbol } from "./symbols";
import { fetchBinance, fetchFinnhub } from "./providers";

describe("routeSymbol", () => {
  it("routes crypto pairs to Binance", () => {
    assert.deepEqual(routeSymbol("btc/usdt"), { market: "crypto", provider: "binance", providerSymbol: "BTCUSDT" });
    assert.equal(routeSymbol("ETHBTC")?.provider, "binance");
  });
  it("routes currency pairs to Finnhub forex", () => {
    assert.deepEqual(routeSymbol("EURUSD"), { market: "forex", provider: "finnhub", providerSymbol: "OANDA:EUR_USD" });
    assert.equal(routeSymbol("USD/ZAR")?.providerSymbol, "OANDA:USD_ZAR");
  });
  it("routes tickers to Finnhub stocks", () => {
    assert.equal(routeSymbol("AAPL")?.market, "stock");
    assert.equal(routeSymbol("BRK.B")?.providerSymbol, "BRK.B");
  });
  it("refuses to guess unknown formats", () => {
    assert.equal(routeSymbol("ESZ6 FUT"), null);
    assert.equal(routeSymbol("TOOLONGTICKER"), null);
    assert.equal(routeSymbol("ES1!"), null);
  });
});

const json = (body: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("fetchBinance", () => {
  it("parses prices", async () => {
    const q = await fetchBinance(["BTCUSDT"], json([{ symbol: "BTCUSDT", price: "64000.12000000" }]));
    assert.equal(q.get("BTCUSDT")?.price, "64000.12000000");
  });
  it("falls back to single requests when one symbol is invalid", async () => {
    const f = (async (url: URL) => {
      const symbols = JSON.parse(url.searchParams.get("symbols")!) as string[];
      if (symbols.includes("NOPEUSDT")) return new Response("{}", { status: 400 });
      return new Response(JSON.stringify(symbols.map((s) => ({ symbol: s, price: "1.5" }))));
    }) as unknown as typeof fetch;
    const q = await fetchBinance(["ETHUSDT", "NOPEUSDT"], f);
    assert.deepEqual([...q.keys()], ["ETHUSDT"]);
  });
});

describe("fetchFinnhub", () => {
  it("parses quotes and drops unknown symbols", async () => {
    const f = (async (url: URL, init?: RequestInit) => {
      assert.equal((init?.headers as Record<string, string>)["X-Finnhub-Token"], "key");
      const s = url.searchParams.get("symbol");
      return new Response(JSON.stringify(s === "AAPL" ? { c: 231.5, t: 1760000000 } : { c: 0, t: 0 }));
    }) as unknown as typeof fetch;
    const q = await fetchFinnhub(["AAPL", "ZZZZ"], "key", f);
    assert.equal(q.get("AAPL")?.price, "231.5");
    assert.equal(q.get("AAPL")?.asOf, 1760000000000);
    assert.equal(q.has("ZZZZ"), false);
  });
});
