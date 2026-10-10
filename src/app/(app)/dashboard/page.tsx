import type { Metadata } from "next";
import Link from "next/link";
import { DailyPnlChart, EquityChart } from "@/components/charts";
import { LocalTime } from "@/components/local-time";
import { ButtonLink, Card, CardTitle, EmptyState, PageHeader, Stat, cn } from "@/components/ui";
import type { Insight } from "@/lib/analytics/insights";
import type { BreakdownRow } from "@/lib/analytics/metrics";
import { getDashboardData, RANGES, type RangeKey } from "@/lib/data/dashboard";
import { money, percent, pnlClass, rMultiple, ratio } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Dashboard" };

function BreakdownTable({ title, rows, currency, note }: { title: string; rows: BreakdownRow[]; currency: string; note?: string }) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      {rows.length === 0 ? (
        <p className="text-sm text-navy-400">No closed trades in this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-sm">
            <thead className="whitespace-nowrap text-left text-xs uppercase tracking-wider text-navy-400">
              <tr>
                <th className="pb-2 font-medium" />
                <th className="w-10 pb-2 pl-2 text-right font-medium">#</th>
                <th className="w-14 pb-2 pl-2 text-right font-medium">Win</th>
                <th className="hidden w-24 pb-2 pl-2 text-right font-medium 2xl:table-cell">Avg</th>
                <th className="w-28 pb-2 pl-2 text-right font-medium">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-700/60">
              {rows.slice(0, 8).map((r) => (
                <tr key={r.key}>
                  <td className="truncate py-2 text-navy-200" title={r.key}>{r.key}</td>
                  <td className="num py-2 pl-2 text-right">{r.trades}</td>
                  <td className="num py-2 pl-2 text-right">{percent(r.winRate, 0)}</td>
                  <td className={cn("num hidden py-2 pl-2 text-right 2xl:table-cell", pnlClass(r.expectancy))}>{money(r.expectancy, currency, { signed: true })}</td>
                  <td className={cn("num whitespace-nowrap py-2 pl-2 text-right font-medium", pnlClass(r.netPnl))}>{money(r.netPnl, currency, { signed: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {note && <p className="mt-3 text-xs text-navy-400">{note}</p>}
    </Card>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const accent = { positive: "border-l-profit", negative: "border-l-loss", neutral: "border-l-electric" }[insight.tone];
  return (
    <div className={cn("rounded-lg border border-navy-700 border-l-4 bg-navy-900/60 p-4", accent)}>
      <p className="font-medium text-white">{insight.title}</p>
      <p className="mt-1 text-sm text-navy-300">{insight.detail}</p>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-electric-soft">Show the data behind this</summary>
        <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-xs">
          {insight.evidence.map((e) => (
            <div key={e.label} className="contents">
              <dt className="text-navy-400">{e.label}</dt>
              <dd className="num text-right text-navy-200">{e.value}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireUser();
  const sp = await searchParams;
  const range: RangeKey = typeof sp.range === "string" && sp.range in RANGES ? (sp.range as RangeKey) : "all";
  const accountId = typeof sp.account === "string" ? sp.account : undefined;
  const data = await getDashboardData(user.id, { accountId, range });

  if (data.kind === "no-accounts") {
    return (
      <EmptyState title="Set up your first trading account" action={<ButtonLink href="/accounts">Add account</ButtonLink>}>
        Your dashboard is calculated from your own trades. Add an account, then log or import trades to see your edge.
      </EmptyState>
    );
  }

  const { summary: s, currency } = data;
  const href = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams();
    const next = { account: data.selectedAccountId, range, ...patch };
    if (next.account) q.set("account", next.account);
    if (next.range && next.range !== "all") q.set("range", next.range);
    const str = q.toString();
    return `/dashboard${str ? `?${str}` : ""}`;
  };
  const points = data.curve.map((p) => ({ date: p.date, equity: p.equity.toNumber(), pnl: p.pnl.toNumber(), trades: p.trades }));

  return (
    <>
      <PageHeader
        title="Account overview"
        description={`${data.selectedAccountId ? data.accounts.find((a) => a.id === data.selectedAccountId)!.name : "All accounts"} · ${currency} · ${RANGES[range].label}`}
        actions={<ButtonLink href="/trades/new">Log trade</ButtonLink>}
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg border border-navy-700 bg-navy-850 p-1">
          {data.canCombine && (
            <Link href={href({ account: null })} className={cn("rounded-md px-3 py-1.5 text-sm", !data.selectedAccountId ? "bg-electric text-white" : "text-navy-300 hover:text-white")}>
              All accounts
            </Link>
          )}
          {data.accounts.map((a) => (
            <Link key={a.id} href={href({ account: a.id })} className={cn("rounded-md px-3 py-1.5 text-sm", data.selectedAccountId === a.id ? "bg-electric text-white" : "text-navy-300 hover:text-white")}>
              {a.name}
            </Link>
          ))}
        </div>
        <div className="flex gap-1 rounded-lg border border-navy-700 bg-navy-850 p-1">
          {(Object.keys(RANGES) as RangeKey[]).map((k) => (
            <Link key={k} href={href({ range: k })} className={cn("rounded-md px-3 py-1.5 text-sm", range === k ? "bg-navy-600 text-white" : "text-navy-300 hover:text-white")}>
              {RANGES[k].label}
            </Link>
          ))}
        </div>
      </div>
      {!data.canCombine && (
        <p className="mb-4 text-xs text-navy-400">Your accounts use different currencies, so statistics are shown one account at a time.</p>
      )}

      {s.closedTrades === 0 ? (
        <EmptyState
          title="No closed trades in this period"
          action={<div className="flex gap-2"><ButtonLink href="/trades/new">Log a trade</ButtonLink><ButtonLink href="/import" variant="secondary">Import CSV</ButtonLink></div>}
        >
          {data.openTrades > 0 ? `You have ${data.openTrades} open trade${data.openTrades === 1 ? "" : "s"}. ` : ""}
          Statistics appear once trades have an exit price and time.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Net P&L" value={money(s.netPnl, currency, { signed: true })} valueClass={pnlClass(s.netPnl)} hint={s.returnPct !== null ? `${s.returnPct >= 0 ? "+" : ""}${percent(s.returnPct)} return · after ${money(s.totalFees, currency)} fees` : `after ${money(s.totalFees, currency)} fees`} />
            <Stat label="Win rate" value={percent(s.winRate)} hint={`${s.wins}W · ${s.losses}L · ${s.breakevens} BE of ${s.closedTrades} closed`} />
            <Stat label="Profit factor" value={s.profitFactor === null ? "—" : ratio(s.profitFactor)} hint={s.profitFactor === null ? "No losing trades yet" : "Gross profit ÷ gross loss"} />
            <Stat label="Max drawdown" value={s.maxDrawdownPct !== null ? percent(s.maxDrawdownPct) : money(s.maxDrawdown, currency)} hint={s.maxDrawdownPct !== null ? `${money(s.maxDrawdown, currency)} peak to trough` : "Set a starting balance for %"} />
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Expectancy" value={money(s.expectancy, currency, { signed: true })} valueClass={pnlClass(s.expectancy)} hint="Average net P&L per trade" />
            <Stat label="Avg win / avg loss" value={s.payoffRatio === null ? "—" : ratio(s.payoffRatio)} hint={`${money(s.averageWin, currency)} / ${money(s.averageLoss, currency)}`} />
            <Stat label="Average R" value={rMultiple(s.averageR)} valueClass={pnlClass(s.averageR)} hint={`${s.tradesWithR} of ${s.closedTrades} trades had a stop`} />
            <Stat label="Planned R:R" value={s.averagePlannedRewardRisk === null ? "—" : `${ratio(s.averagePlannedRewardRisk)} : 1`} hint={`Streaks: ${s.longestWinStreak} wins · ${s.longestLossStreak} losses`} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
            <Card>
              <CardTitle action={<span className="num text-sm text-navy-300">{money(s.startingBalance, currency)} → <span className="text-white">{money(s.endingBalance, currency)}</span></span>}>
                Equity curve
              </CardTitle>
              <EquityChart points={points} startBalance={s.startingBalance.toNumber()} currency={currency} />
              <p className="mb-2 mt-5 text-xs font-medium uppercase tracking-wider text-navy-400">Daily net P&amp;L</p>
              <DailyPnlChart points={points} currency={currency} />
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-xs text-electric-soft">View as table</summary>
                <div className="mt-2 max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="text-left text-navy-400"><tr><th className="py-1">Day (UTC)</th><th className="text-right">Trades</th><th className="text-right">Day P&amp;L</th><th className="text-right">Equity</th></tr></thead>
                    <tbody>
                      {[...data.curve].reverse().map((p) => (
                        <tr key={p.date} className="border-t border-navy-700/60">
                          <td className="py-1">{p.date}</td>
                          <td className="num text-right">{p.trades}</td>
                          <td className={cn("num text-right", pnlClass(p.pnl))}>{money(p.pnl, currency, { signed: true })}</td>
                          <td className="num text-right">{money(p.equity, currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </Card>
            <Card>
              <CardTitle>Trading insights</CardTitle>
              <div className="flex flex-col gap-3">
                {data.insights.map((i) => <InsightCard key={i.id} insight={i} />)}
              </div>
              <p className="mt-4 text-xs text-navy-400">Insights are calculated from your journal only. They describe what happened, not what will happen.</p>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <BreakdownTable title="By setup" rows={data.bySetup} currency={currency} />
            <BreakdownTable title="By instrument" rows={data.bySymbol} currency={currency} />
            <BreakdownTable title="By weekday" rows={data.byWeekday} currency={currency} note="Based on entry time in UTC." />
            <BreakdownTable title="Rule discipline" rows={data.byRules} currency={currency} />
            <BreakdownTable title="Emotional state" rows={data.byEmotion} currency={currency} note="Correlations in your journal, not a diagnosis." />
            <Card>
              <CardTitle action={<Link href="/trades" className="text-xs text-electric-soft hover:underline">All trades →</Link>}>Recent closed trades</CardTitle>
              <ul className="divide-y divide-navy-700/60 text-sm">
                {data.recent.map((r) => (
                  <li key={r.trade.id} className="flex items-center justify-between gap-3 py-2">
                    <Link href={`/trades/${r.trade.id}`} className="min-w-0">
                      <span className="font-medium text-white">{r.trade.symbol}</span>{" "}
                      <span className="text-xs text-navy-400">{r.trade.direction === "LONG" ? "Long" : "Short"} · <LocalTime value={r.trade.exitAt} dateOnly /></span>
                    </Link>
                    <span className={cn("num font-medium", pnlClass(r.netPnl))}>{money(r.netPnl, currency, { signed: true })}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
