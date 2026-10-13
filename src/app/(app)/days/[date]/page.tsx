import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LocalTime } from "@/components/local-time";
import { Badge, ButtonLink, Card, CardTitle, PageHeader, cn } from "@/components/ui";
import { zonedParts } from "@/lib/analytics/timezone";
import { DATE_RE, getDay, shiftDay } from "@/lib/data/days";
import { getSettings } from "@/lib/data/settings";
import { money, plain, pnlClass, rMultiple } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { NoteForm } from "../note-form";

export const metadata: Metadata = { title: "Daily journal" };

export default async function DayPage({ params }: PageProps<"/days/[date]">) {
  const user = await requireUser();
  const { date } = await params;
  if (date === "today") {
    const { timeZone } = await getSettings(user.id);
    redirect(`/days/${zonedParts(new Date(), timeZone).date}`);
  }
  if (!DATE_RE.test(date) || Number.isNaN(Date.parse(date))) notFound();

  const day = await getDay(user.id, date);
  const label = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <>
      <PageHeader
        title={label}
        description={`Daily journal · trading day in ${day.timeZone.replace(/_/g, " ")}`}
        actions={
          <>
            <ButtonLink href={`/days/${shiftDay(date, -1)}`} variant="secondary" aria-label="Previous day">←</ButtonLink>
            <ButtonLink href="/days/today" variant="secondary">Today</ButtonLink>
            <ButtonLink href={`/days/${shiftDay(date, 1)}`} variant="secondary" aria-label="Next day">→</ButtonLink>
            <ButtonLink href={`/calendar?month=${date.slice(0, 7)}`} variant="ghost">Calendar</ButtonLink>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardTitle>Journal</CardTitle>
          <NoteForm key={date} date={date} note={day.note} />
        </Card>
        <Card>
          <CardTitle
            action={
              <span className="num text-sm">
                {day.realised.length === 0
                  ? <span className="text-navy-400">Nothing closed</span>
                  : day.realised.map(([cur, v]) => <span key={cur} className={cn("ml-2 font-semibold", pnlClass(v))}>{money(v, cur, { signed: true })}</span>)}
              </span>
            }
          >
            Trades this day
          </CardTitle>
          {day.rows.length === 0 ? (
            <p className="text-sm text-navy-300">No trades entered or closed on this day.</p>
          ) : (
            <ul className="divide-y divide-navy-700/60">
              {day.rows.map(({ trade: t, result, closedToday }) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <Link href={`/trades/${t.id}`} className="font-medium text-white hover:text-electric-soft">{t.symbol}</Link>{" "}
                    <span className="text-xs text-navy-400">
                      {t.direction === "LONG" ? "Long" : "Short"} {plain(t.quantity)} @ {plain(t.entryPrice)} · <LocalTime value={t.entryAt} />
                    </span>
                    <div className="mt-0.5 flex flex-wrap gap-1 text-xs text-navy-400">
                      {t.setup && <span>{t.setup}</span>}
                      {t.tags.map((x) => <span key={x.name} className="text-electric-soft">#{x.name}</span>)}
                      {result && !closedToday && <span>· closed another day</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    {result ? (
                      <>
                        <div className={cn("num font-semibold", pnlClass(result.netPnl))}>{money(result.netPnl, t.account.currency, { signed: true })}</div>
                        <div className={cn("num text-xs", pnlClass(result.rMultiple))}>{rMultiple(result.rMultiple)}</div>
                      </>
                    ) : (
                      <Badge tone="info">open</Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <ButtonLink href="/trades/new" variant="secondary" className="mt-4">Log a trade</ButtonLink>
        </Card>
      </div>
    </>
  );
}
