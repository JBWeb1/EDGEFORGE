import Decimal from "decimal.js";

/** Month grid for a P&L calendar. Weeks start on Monday. */

export type DayStat = { pnl: Decimal; trades: number };
export type CalendarCell = { date: string; day: number; inMonth: boolean; stat: DayStat | null };
export type CalendarWeek = { cells: CalendarCell[]; pnl: Decimal; trades: number };

const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

export function parseMonth(value: string | undefined, fallback: Date): { year: number; month: number } {
  const m = value && /^(\d{4})-(\d{2})$/.exec(value);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return { year: Number(m[1]), month: Number(m[2]) };
  return { year: fallback.getUTCFullYear(), month: fallback.getUTCMonth() + 1 };
}

export function shiftMonth(year: number, month: number, by: number) {
  const d = new Date(Date.UTC(year, month - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function buildMonth(year: number, month: number, days: Map<string, DayStat>) {
  const first = Date.UTC(year, month - 1, 1);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lead = (new Date(first).getUTCDay() + 6) % 7; // Monday = 0
  const start = first - lead * 86_400_000;
  const total = Math.ceil((lead + daysInMonth) / 7) * 7;

  const weeks: CalendarWeek[] = [];
  let monthPnl = new Decimal(0);
  let monthTrades = 0;
  let green = 0;
  let red = 0;
  for (let i = 0; i < total; i += 7) {
    const cells: CalendarCell[] = [];
    let pnl = new Decimal(0);
    let trades = 0;
    for (let j = 0; j < 7; j++) {
      const t = start + (i + j) * 86_400_000;
      const date = iso(t);
      const inMonth = new Date(t).getUTCMonth() === month - 1;
      const stat = inMonth ? days.get(date) ?? null : null;
      if (stat) {
        pnl = pnl.plus(stat.pnl);
        trades += stat.trades;
        if (stat.pnl.gt(0)) green++;
        else if (stat.pnl.lt(0)) red++;
      }
      cells.push({ date, day: new Date(t).getUTCDate(), inMonth, stat });
    }
    monthPnl = monthPnl.plus(pnl);
    monthTrades += trades;
    weeks.push({ cells, pnl, trades });
  }
  return { weeks, monthPnl, monthTrades, greenDays: green, redDays: red };
}
