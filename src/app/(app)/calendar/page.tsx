import type Decimal from "decimal.js";
import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink, Card, EmptyState, PageHeader, cn } from "@/components/ui";
import { shiftMonth } from "@/lib/analytics/calendar";
import { getCalendarData } from "@/lib/data/calendar";
import { compactNumber, money, pnlClass } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Calendar" };

/** Rounded to whole units for compact cells (the tooltip keeps cents). */
const wholeMoney = (v: Decimal, currency: string) =>
  money(v.toDecimalPlaces(0), currency, { signed: true }).replace(/\.00$/, "");

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const user = await requireUser();
  const sp = await searchParams;
  const data = await getCalendarData(user.id, {
    accountId: typeof sp.account === "string" ? sp.account : undefined,
    month: typeof sp.month === "string" ? sp.month : undefined,
  });
  if (!data) {
    return <EmptyState title="Add an account first" action={<ButtonLink href="/accounts">Add account</ButtonLink>} />;
  }

  const href = (patch: { month?: string; account?: string | null }) => {
    const q = new URLSearchParams();
    const account = patch.account === undefined ? data.selectedAccountId : patch.account;
    if (account) q.set("account", account);
    q.set("month", patch.month ?? `${data.year}-${String(data.month).padStart(2, "0")}`);
    return `/calendar?${q}`;
  };
  const title = new Date(Date.UTC(data.year, data.month - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const maxAbs = Math.max(1, ...data.weeks.flatMap((w) => w.cells.map((c) => (c.stat ? Math.abs(c.stat.pnl.toNumber()) : 0))));

  return (
    <>
      <PageHeader title="P&L calendar" description={`Net P&L per trading day, by exit time in ${data.timeZone.replace(/_/g, " ")}. ${data.currency}.`} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(data.canCombine || data.accounts.length > 1) && (
          <div className="flex flex-wrap gap-1 rounded-lg border border-navy-700 bg-navy-850 p-1">
            {data.canCombine && (
              <Link href={href({ account: null })} className={cn("rounded-md px-3 py-1.5 text-sm", !data.selectedAccountId ? "bg-electric text-white" : "text-navy-300 hover:text-white")}>All accounts</Link>
            )}
            {data.accounts.map((a) => (
              <Link key={a.id} href={href({ account: a.id })} className={cn("rounded-md px-3 py-1.5 text-sm", data.selectedAccountId === a.id ? "bg-electric text-white" : "text-navy-300 hover:text-white")}>{a.name}</Link>
            ))}
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Link href={href({ month: shiftMonth(data.year, data.month, -1) })} className="rounded-lg border border-navy-600 px-3 py-1.5 text-sm text-navy-200 hover:text-white" aria-label="Previous month">←</Link>
          <span className="min-w-36 text-center font-semibold text-white">{title}</span>
          <Link href={href({ month: shiftMonth(data.year, data.month, 1) })} className="rounded-lg border border-navy-600 px-3 py-1.5 text-sm text-navy-200 hover:text-white" aria-label="Next month">→</Link>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-4 text-sm">
        <span>Month: <span className={cn("num font-semibold", pnlClass(data.monthPnl))}>{money(data.monthPnl, data.currency, { signed: true })}</span></span>
        <span className="text-navy-300">{data.monthTrades} trades</span>
        <span className="text-navy-300">{data.greenDays} green · {data.redDays} red days</span>
      </div>

      <Card className="p-2 sm:p-4">
        <div className="grid grid-cols-7 gap-1 sm:grid-cols-8 sm:gap-2">
          {WEEKDAYS.map((d) => <div key={d} className="pb-1 text-center text-xs font-medium uppercase tracking-wider text-navy-400">{d}</div>)}
          <div className="hidden pb-1 text-center text-xs font-medium uppercase tracking-wider text-navy-400 sm:block">Week</div>
          {data.weeks.map((w, i) => (
            <div key={i} className="contents">
              {w.cells.map((c) => {
                const pnl = c.stat?.pnl.toNumber() ?? 0;
                // Tint strength scales with the day's size; sign and text carry the meaning.
                const alpha = c.stat ? 0.12 + 0.4 * Math.min(1, Math.abs(pnl) / maxAbs) : 0;
                return (
                  <Link
                    href={`/days/${c.date}`}
                    key={c.date}
                    title={c.stat ? `${c.date}: ${money(c.stat.pnl, data.currency, { signed: true })} · ${c.stat.trades} trades` : c.date}
                    className={cn(
                      "flex min-h-14 flex-col rounded-lg border p-1 transition-colors hover:border-electric sm:min-h-20 sm:p-2",
                      c.inMonth ? "border-navy-700" : "border-transparent opacity-30",
                      c.date === data.today && "ring-1 ring-electric",
                    )}
                    style={c.stat ? { backgroundColor: pnl >= 0 ? `rgba(34,197,94,${alpha})` : `rgba(244,63,94,${alpha})` } : undefined}
                  >
                    <span className="text-[10px] text-navy-400 sm:text-xs">{c.day}</span>
                    {c.stat && (
                      <>
                        <span className="num mt-auto truncate text-[11px] font-semibold text-white sm:hidden">{compactNumber(c.stat.pnl)}</span>
                        <span className="num mt-auto hidden truncate text-sm font-semibold text-white sm:block">{wholeMoney(c.stat.pnl, data.currency)}</span>
                        <span className="hidden text-[10px] text-navy-300 sm:block">{c.stat.trades} trade{c.stat.trades === 1 ? "" : "s"}</span>
                      </>
                    )}
                  </Link>
                );
              })}
              <div className="hidden flex-col justify-center rounded-lg bg-navy-900/60 p-2 text-right sm:flex">
                {w.trades > 0 ? (
                  <>
                    <span className={cn("num text-sm font-semibold", pnlClass(w.pnl))}>{wholeMoney(w.pnl, data.currency)}</span>
                    <span className="text-[10px] text-navy-400">{w.trades} trades</span>
                  </>
                ) : (
                  <span className="text-xs text-navy-500">—</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
