import "server-only";
import { prisma } from "@/lib/db";
import { buildMonth, parseMonth, type DayStat } from "@/lib/analytics/calendar";
import { dailyEquityCurve } from "@/lib/analytics/metrics";
import { zonedParts } from "@/lib/analytics/timezone";
import { computeClosedResults } from "@/lib/analytics/trade-math";
import { resolveScope } from "@/lib/data/dashboard";
import { getSettings } from "@/lib/data/settings";
import { toTradeInput } from "@/lib/data/trades";

export async function getCalendarData(userId: string, opts: { accountId?: string; month?: string }) {
  const [accounts, { timeZone }] = await Promise.all([
    prisma.tradingAccount.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    getSettings(userId),
  ]);
  if (accounts.length === 0) return null;
  const { canCombine, selected, scope, currency } = resolveScope(accounts, opts.accountId);

  const today = zonedParts(new Date(), timeZone);
  const { year, month } = parseMonth(opts.month, new Date(Date.UTC(today.year, today.month - 1, 1)));

  const trades = await prisma.trade.findMany({
    where: { userId, accountId: { in: scope.map((a) => a.id) }, exitPrice: { not: null } },
  });
  const days = new Map<string, DayStat>(
    dailyEquityCurve(computeClosedResults(trades.map(toTradeInput)), 0, timeZone).map((p) => [
      p.date,
      { pnl: p.pnl, trades: p.trades },
    ]),
  );

  return {
    accounts: accounts.map((a) => ({ id: a.id, name: a.name })),
    canCombine,
    selectedAccountId: selected?.id ?? null,
    currency,
    timeZone,
    today: today.date,
    year,
    month,
    ...buildMonth(year, month, days),
  };
}
