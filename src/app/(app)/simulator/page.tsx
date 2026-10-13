import type { Metadata } from "next";
import Link from "next/link";
import { MoneyFanChart } from "@/components/money-fan-chart";
import { ButtonLink, Card, CardTitle, EmptyState, PageHeader, Select, Stat, cn } from "@/components/ui";
import { simulate } from "@/lib/analytics/monte-carlo";
import { computeClosedResults } from "@/lib/analytics/trade-math";
import { prisma } from "@/lib/db";
import { resolveScope } from "@/lib/data/dashboard";
import { toTradeInput } from "@/lib/data/trades";
import { money, percent } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Monte Carlo simulator" };

const MIN_TRADES = 20;
const HORIZONS = [50, 100, 250, 500];

export default async function SimulatorPage({ searchParams }: PageProps<"/simulator">) {
  const user = await requireUser();
  const sp = await searchParams;
  const accounts = await prisma.tradingAccount.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
  if (accounts.length === 0) return <EmptyState title="Add an account first" action={<ButtonLink href="/accounts">Add account</ButtonLink>} />;

  const { canCombine, selected, scope, currency } = resolveScope(accounts, typeof sp.account === "string" ? sp.account : undefined);
  const mode = sp.mode === "r" ? "r" : "money";
  const horizon = HORIZONS.includes(Number(sp.trades)) ? Number(sp.trades) : 100;
  const ddParam = Number(sp.dd);
  const trades = await prisma.trade.findMany({ where: { userId: user.id, accountId: { in: scope.map((a) => a.id) }, exitPrice: { not: null } } });
  const results = computeClosedResults(trades.map(toTradeInput));
  const outcomes = mode === "r"
    ? results.flatMap((r) => (r.rMultiple ? [r.rMultiple.toNumber()] : []))
    : results.map((r) => r.netPnl.toNumber());
  const balance = results.reduce((acc, r) => acc + r.netPnl.toNumber(), scope.reduce((a, s) => a + Number(s.startingBalance), 0));
  const usePct = mode === "money" && balance > 0;
  const threshold = ddParam > 0 ? ddParam : usePct ? 20 : 10;

  const fmt = (n: number) => (mode === "r" ? `${n > 0 ? "+" : ""}${n.toFixed(1)}R` : money(n, currency, { signed: true }));
  const ddFmt = (n: number) => (usePct ? percent(n) : mode === "r" ? `${n.toFixed(1)}R` : money(n, currency));

  const href = (patch: Record<string, string | number | null>) => {
    const q = new URLSearchParams();
    const next = { account: selected?.id ?? null, mode, trades: horizon, dd: ddParam > 0 ? ddParam : null, ...patch };
    for (const [k, v] of Object.entries(next)) if (v !== null && v !== undefined) q.set(k, String(v));
    return `/simulator?${q}`;
  };
  const tab = (active: boolean) => cn("rounded-md px-3 py-1.5 text-sm", active ? "bg-electric text-white" : "text-navy-300 hover:text-white");

  const sim = outcomes.length >= MIN_TRADES
    ? simulate({ outcomes, trades: horizon, runs: 5000, startBalance: usePct ? balance : 0, drawdownThreshold: threshold, seed: 20261012 })
    : null;

  return (
    <>
      <PageHeader
        title="Monte Carlo simulator"
        description="5,000 possible futures, each built by drawing trades at random from your own closed results."
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {(canCombine || accounts.length > 1) && (
          <div className="flex flex-wrap gap-1 rounded-lg border border-navy-700 bg-navy-850 p-1">
            {canCombine && <Link href={href({ account: null })} className={tab(!selected)}>All accounts</Link>}
            {accounts.map((a) => <Link key={a.id} href={href({ account: a.id })} className={tab(selected?.id === a.id)}>{a.name}</Link>)}
          </div>
        )}
        <div className="flex gap-1 rounded-lg border border-navy-700 bg-navy-850 p-1">
          <Link href={href({ mode: "money" })} className={tab(mode === "money")}>{currency}</Link>
          <Link href={href({ mode: "r" })} className={tab(mode === "r")}>R multiples</Link>
        </div>
        <div className="flex gap-1 rounded-lg border border-navy-700 bg-navy-850 p-1">
          {HORIZONS.map((n) => <Link key={n} href={href({ trades: n })} className={tab(horizon === n)}>{n} trades</Link>)}
        </div>
        <form className="flex items-center gap-2 text-sm text-navy-300">
          {selected && <input type="hidden" name="account" value={selected.id} />}
          <input type="hidden" name="mode" value={mode} />
          <input type="hidden" name="trades" value={horizon} />
          <label htmlFor="dd">Drawdown alarm</label>
          <Select id="dd" name="dd" defaultValue={String(threshold)} className="w-auto py-1.5">
            {(usePct ? [5, 10, 15, 20, 30, 50] : mode === "r" ? [5, 10, 15, 20] : [threshold]).map((v) => (
              <option key={v} value={v}>{usePct ? `${v}%` : mode === "r" ? `${v}R` : money(v, currency)}</option>
            ))}
          </Select>
          <button type="submit" className="rounded-lg border border-navy-600 px-3 py-1.5 hover:text-white">Apply</button>
        </form>
      </div>

      {!sim ? (
        <EmptyState title={`Needs at least ${MIN_TRADES} closed trades`}>
          {mode === "r"
            ? `You have ${outcomes.length} closed trades with a stop loss (R needs a stop). Switch to ${currency} or log more trades.`
            : `You have ${outcomes.length}. Fewer than ${MIN_TRADES} trades can't represent your edge well enough to simulate.`}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Median outcome" value={fmt(sim.final.p50)} valueClass={sim.final.p50 >= 0 ? "text-profit" : "text-loss"} hint={`after ${horizon} trades`} />
            <Stat label="Chance of profit" value={percent(sim.probProfit * 100, 0)} hint={`90% range ${fmt(sim.final.p5)} to ${fmt(sim.final.p95)}`} />
            <Stat label="Typical max drawdown" value={ddFmt(sim.maxDrawdown.p50)} hint={`1 in 20 futures: ${ddFmt(sim.maxDrawdown.p95)} or worse`} />
            <Stat
              label={`Drawdown ≥ ${usePct ? `${threshold}%` : mode === "r" ? `${threshold}R` : money(threshold, currency)}`}
              value={percent(sim.probDrawdownAbove * 100, 0)}
              valueClass={sim.probDrawdownAbove >= 0.25 ? "text-loss" : undefined}
              hint="of simulated futures hit it"
            />
          </div>
          <Card>
            <CardTitle>Range of outcomes over the next {horizon} trades</CardTitle>
            <MoneyFanChart bands={sim.bands} currency={currency} mode={mode} />
          </Card>
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardTitle>Losing streaks to prepare for</CardTitle>
              <p className="text-sm text-navy-300">
                In half of the simulated futures your longest losing streak is <span className="num font-semibold text-white">{sim.longestLosingStreak.p50}</span> trades or more,
                and in 1 in 20 it reaches <span className="num font-semibold text-white">{sim.longestLosingStreak.p95}</span>. Size positions so a streak that long is survivable.
              </p>
            </Card>
            <Card>
              <CardTitle>How to read this</CardTitle>
              <ul className="list-disc space-y-1 pl-5 text-sm text-navy-300">
                <li>Based on {sim.sampleSize} of your closed trades{mode === "r" ? " that had a stop loss" : ", after fees"}.</li>
                <li>It assumes future trades resemble past ones and don&apos;t depend on each other. Changing markets or behaviour change the picture.</li>
                <li>It shows how much luck alone can move results with the same edge. It is not a forecast or financial advice.</li>
              </ul>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
