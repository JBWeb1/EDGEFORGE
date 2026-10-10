import { prisma } from "@/lib/db";
import { getPrices, priceProvidersStatus } from "@/lib/prices";
import { getCurrentUser } from "@/lib/session";

const MAX_SYMBOLS = 30;

/**
 * Latest prices for the symbols of the signed-in user's open trades. Only
 * symbols the user actually holds are looked up, so this can't be used as a
 * general market-data proxy.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const open = await prisma.trade.findMany({
    where: { userId: user.id, exitPrice: null },
    select: { symbol: true, multiplier: true },
  });
  // A multiplier other than 1 means a futures/derivative contract (e.g. "ES"),
  // which must never be priced as a same-named stock ticker.
  const contracts = new Set(open.filter((t) => !t.multiplier.equals(1)).map((t) => t.symbol));
  const symbols = [...new Set(open.map((t) => t.symbol))].filter((s) => !contracts.has(s)).slice(0, MAX_SYMBOLS);
  const prices = await getPrices(symbols);
  return Response.json(
    {
      providers: priceProvidersStatus(),
      prices: Object.fromEntries([
        ...prices.map((p) => [p.symbol, { quote: p.quote, reason: p.reason ?? null }]),
        ...[...contracts].map((s) => [s, { quote: null, reason: "Live prices for futures contracts aren't supported yet" }]),
      ]),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
