import "server-only";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db";
import { zonedTimeToUtc } from "@/lib/analytics/timezone";
import { computeTradeResult, isClosed } from "@/lib/analytics/trade-math";
import { getSettings } from "@/lib/data/settings";
import { TAG_SELECT, toTradeInput } from "@/lib/data/trades";

export const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function shiftDay(date: string, by: number) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + by)).toISOString().slice(0, 10);
}

/** Trades entered or closed on a local trading day, plus that day's journal note. */
export async function getDay(userId: string, date: string) {
  const { timeZone } = await getSettings(userId);
  const [y, m, d] = date.split("-").map(Number);
  const start = zonedTimeToUtc(y, m, d, 0, 0, 0, 0, timeZone);
  const end = zonedTimeToUtc(y, m, d + 1, 0, 0, 0, 0, timeZone);

  const [trades, note] = await Promise.all([
    prisma.trade.findMany({
      where: {
        userId,
        OR: [{ entryAt: { gte: start, lt: end } }, { exitAt: { gte: start, lt: end } }],
      },
      orderBy: { entryAt: "asc" },
      include: { account: { select: { name: true, currency: true } }, tags: TAG_SELECT },
    }),
    prisma.dailyNote.findUnique({ where: { userId_date: { userId, date } } }),
  ]);

  const rows = trades.map((t) => {
    const input = toTradeInput(t);
    const result = isClosed(input) ? computeTradeResult(input) : null;
    const closedToday = !!t.exitAt && t.exitAt >= start && t.exitAt < end;
    return { trade: t, result, closedToday };
  });

  // Realised P&L per currency for trades closed on this day.
  const realised = new Map<string, Decimal>();
  for (const r of rows) {
    if (r.result && r.closedToday) {
      const cur = r.trade.account.currency;
      realised.set(cur, (realised.get(cur) ?? new Decimal(0)).plus(r.result.netPnl));
    }
  }
  return { timeZone, rows, note, realised: [...realised.entries()] };
}
