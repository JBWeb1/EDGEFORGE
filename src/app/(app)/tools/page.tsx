import type { Metadata } from "next";
import Decimal from "decimal.js";
import { PageHeader } from "@/components/ui";
import { computeClosedResults } from "@/lib/analytics/trade-math";
import { prisma } from "@/lib/db";
import { toTradeInput } from "@/lib/data/trades";
import { requireUser } from "@/lib/session";
import { PositionCalculator } from "./position-calculator";

export const metadata: Metadata = { title: "Position size calculator" };

export default async function ToolsPage() {
  const user = await requireUser();
  const accounts = await prisma.tradingAccount.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    include: { trades: { where: { exitPrice: { not: null } } } },
  });
  // Current balance = starting balance + realised net P&L.
  const withBalance = accounts.map((a) => {
    const realised = computeClosedResults(a.trades.map(toTradeInput)).reduce((acc, r) => acc.plus(r.netPnl), new Decimal(0));
    return {
      id: a.id,
      name: a.name,
      currency: a.currency,
      balance: realised.plus(a.startingBalance.toString()).toDecimalPlaces(2).toString(),
      maxRiskPerTrade: a.maxRiskPerTrade?.toString() ?? null,
    };
  });
  return (
    <>
      <PageHeader title="Position size calculator" description="Size every trade from your risk, not your gut." />
      <PositionCalculator accounts={withBalance} />
    </>
  );
}
