import type { Metadata } from "next";
import Link from "next/link";
import { LocalTime } from "@/components/local-time";
import { Badge, ButtonLink, Card, EmptyState, Input, PageHeader, Select, cn } from "@/components/ui";
import { summarize } from "@/lib/analytics/metrics";
import { zonedTimeToUtc } from "@/lib/analytics/timezone";
import { computeTradeResult, isClosed, type TradeResult } from "@/lib/analytics/trade-math";
import { listAccounts } from "@/lib/data/accounts";
import { getSettings } from "@/lib/data/settings";
import { knownSetups, knownTags, playbookOptions } from "@/lib/data/trade-form";
import { BULK_FORM_ID, BulkBar } from "./bulk-bar";
import { listTrades, toTradeInput } from "@/lib/data/trades";
import { money, percent, plain, pnlClass, rMultiple } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Journal" };

const PAGE_SIZE = 50;
const OUTCOMES = { win: "WIN", loss: "LOSS", breakeven: "BREAKEVEN" } as const;

const str = (v: string | string[] | undefined) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** Start of a local calendar day (YYYY-MM-DD) in the trader's time zone. */
function dayStart(value: string | undefined, timeZone: string, addDays = 0) {
  const m = value && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return undefined;
  return zonedTimeToUtc(Number(m[1]), Number(m[2]), Number(m[3]) + addDays, 0, 0, 0, 0, timeZone);
}

export default async function TradesPage({ searchParams }: PageProps<"/trades">) {
  const user = await requireUser();
  const sp = await searchParams;
  const filters = {
    account: str(sp.account),
    q: str(sp.q),
    setup: str(sp.setup),
    tag: str(sp.tag),
    playbook: str(sp.playbook),
    /** open | closed | win | loss | breakeven */
    outcome: str(sp.outcome),
    from: str(sp.from),
    to: str(sp.to),
  };
  const page = Math.max(1, Number(str(sp.page)) || 1);
  const { timeZone } = await getSettings(user.id);
  const outcome = filters.outcome && filters.outcome in OUTCOMES ? OUTCOMES[filters.outcome as keyof typeof OUTCOMES] : null;
  const status = filters.outcome === "open" ? "open" : filters.outcome === "closed" || outcome ? "closed" : undefined;

  const [accounts, setups, tags, playbooks, rows] = await Promise.all([
    listAccounts(user.id),
    knownSetups(user.id),
    knownTags(user.id),
    playbookOptions(user.id),
    listTrades(user.id, {
      accountId: filters.account,
      status,
      q: filters.q,
      setup: filters.setup,
      tag: filters.tag,
      playbookId: filters.playbook,
      from: dayStart(filters.from, timeZone),
      to: dayStart(filters.to, timeZone, 1),
    }),
  ]);

  // Outcome depends on calculated P&L, so it's filtered after the query.
  const withResults = rows
    .map((t) => {
      const input = toTradeInput(t);
      return { t, r: isClosed(input) ? computeTradeResult(input) : null };
    })
    .filter(({ r }) => !outcome || r?.outcome === outcome);

  const currencies = new Set(withResults.map(({ t }) => t.account.currency));
  const summary = currencies.size === 1 ? summarize(withResults.flatMap(({ r }) => (r ? [r as TradeResult] : []))) : null;
  const summaryCurrency = [...currencies][0];
  const pages = Math.max(1, Math.ceil(withResults.length / PAGE_SIZE));
  const visible = withResults.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const active = Object.values(filters).some(Boolean);

  const pageHref = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) q.set(k, v);
    if (p > 1) q.set("page", String(p));
    return `/trades?${q}`;
  };

  return (
    <>
      <PageHeader
        title="Trade journal"
        description={`${withResults.length} trade${withResults.length === 1 ? "" : "s"}${active ? " match your filters" : ""}`}
        actions={
          <>
            <ButtonLink href={filters.account ? `/export?account=${filters.account}` : "/export"} variant="secondary" prefetch={false}>Export CSV</ButtonLink>
            <ButtonLink href="/import" variant="secondary">Import CSV</ButtonLink>
            <ButtonLink href="/trades/new">Log trade</ButtonLink>
          </>
        }
      />

      <form className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <Input name="q" defaultValue={filters.q} placeholder="Search symbol, setup, notes…" className="xl:col-span-2" aria-label="Search" />
        <Select name="account" defaultValue={filters.account ?? ""} aria-label="Account">
          <option value="">All accounts</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
        <Select name="setup" defaultValue={filters.setup ?? ""} aria-label="Setup">
          <option value="">All setups</option>
          {setups.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
 {playbooks.length > 0 && (
          <Select name="playbook" defaultValue={filters.playbook ?? ""} aria-label="Playbook">
            <option value="">All playbooks</option>
            {playbooks.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        )}
        {tags.length > 0 && (
          <Select name="tag" defaultValue={filters.tag ?? ""} aria-label="Tag">
            <option value="">All tags</option>
            {tags.map((t) => <option key={t} value={t}>#{t}</option>)}
          </Select>
        )}
        <Select name="outcome" defaultValue={filters.outcome ?? ""} aria-label="Outcome">
          <option value="">Any status</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="win">Winners</option>
          <option value="loss">Losers</option>
          <option value="breakeven">Breakeven</option>
        </Select>
        <Input type="date" name="from" defaultValue={filters.from} aria-label="Entered from" />
        <Input type="date" name="to" defaultValue={filters.to} aria-label="Entered to" />
        <div className="flex gap-2">
          <button type="submit" className="flex-1 rounded-lg bg-electric px-3 py-2 text-sm font-medium text-white hover:bg-electric-soft">Filter</button>
          {active && <Link href="/trades" className="rounded-lg border border-navy-600 px-3 py-2 text-sm text-navy-300 hover:text-white">Clear</Link>}
        </div>
      </form>

      {summary && summary.closedTrades > 0 && (
        <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 rounded-lg border border-navy-700 bg-navy-850/60 px-4 py-2 text-sm">
          <span className="text-navy-300">Closed: <span className="num text-white">{summary.closedTrades}</span></span>
          <span className="text-navy-300">Net: <span className={cn("num font-semibold", pnlClass(summary.netPnl))}>{money(summary.netPnl, summaryCurrency, { signed: true })}</span></span>
          <span className="text-navy-300">Win rate: <span className="num text-white">{percent(summary.winRate)}</span></span>
          <span className="text-navy-300">Avg: <span className={cn("num", pnlClass(summary.expectancy))}>{money(summary.expectancy, summaryCurrency, { signed: true })}</span></span>
          <span className="text-navy-300">Avg R: <span className="num text-white">{rMultiple(summary.averageR)}</span></span>
        </div>
      )}

      {withResults.length === 0 ? (
        active ? (
          <EmptyState title="No trades match these filters" action={<ButtonLink href="/trades" variant="secondary">Clear filters</ButtonLink>} />
        ) : (
          <EmptyState
            title="No trades yet"
            action={<div className="flex gap-2"><ButtonLink href="/trades/new">Log your first trade</ButtonLink><ButtonLink href="/import" variant="secondary">Import CSV</ButtonLink></div>}
          >
            Every statistic in EDGEFORGE is calculated from the trades you record here.
          </EmptyState>
        )
      ) : (
        <>
        <BulkBar playbooks={playbooks.map((p) => ({ id: p.id, name: p.name }))} />
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-sm">
              <thead className="border-b border-navy-700 text-left text-xs uppercase tracking-wider text-navy-400">
                <tr>
                  <th className="w-10 py-3 pl-4"><span className="sr-only">Select</span></th>
                  <th className="px-4 py-3 font-medium">Entry</th>
                  <th className="px-4 py-3 font-medium">Symbol</th>
                  <th className="px-4 py-3 font-medium">Side</th>
                  <th className="px-4 py-3 text-right font-medium">Qty</th>
                  <th className="px-4 py-3 text-right font-medium">Entry</th>
                  <th className="px-4 py-3 text-right font-medium">Exit</th>
                  <th className="px-4 py-3 text-right font-medium">Net P&amp;L</th>
                  <th className="px-4 py-3 text-right font-medium">R</th>
                  <th className="px-4 py-3 font-medium">Setup</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-700/60">
                {visible.map(({ t, r }) => (
                  <tr key={t.id} className="hover:bg-navy-800/50">
                    <td className="py-3 pl-4">
                      <input type="checkbox" name="ids" value={t.id} form={BULK_FORM_ID} className="h-4 w-4 accent-electric" aria-label={`Select ${t.symbol} trade`} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-navy-300"><LocalTime value={t.entryAt} /></td>
                    <td className="px-4 py-3">
                      <Link href={`/trades/${t.id}`} className="font-medium text-white hover:text-electric-soft">{t.symbol}</Link>
                      {accounts.length > 1 && <span className="block text-xs text-navy-400">{t.account.name}</span>}
                    </td>
                    <td className="px-4 py-3"><Badge tone={t.direction === "LONG" ? "info" : "neutral"}>{t.direction === "LONG" ? "Long" : "Short"}</Badge></td>
                    <td className="num px-4 py-3 text-right">{plain(t.quantity)}</td>
                    <td className="num px-4 py-3 text-right">{plain(t.entryPrice)}</td>
                    <td className="num px-4 py-3 text-right">{t.exitPrice ? plain(t.exitPrice) : <Badge tone="info">open</Badge>}</td>
                    <td className={cn("num px-4 py-3 text-right font-medium", pnlClass(r?.netPnl))}>{r ? money(r.netPnl, t.account.currency, { signed: true }) : "—"}</td>
                    <td className={cn("num px-4 py-3 text-right", pnlClass(r?.rMultiple))}>{r ? rMultiple(r.rMultiple) : "—"}</td>
                    <td className="px-4 py-3 text-navy-300">
                      {t.setup ?? "—"}
                      {t.playbook && <span className="block text-xs text-navy-300">{t.playbook.name}</span>}
                      {t.tags.length > 0 && <span className="block text-xs text-electric-soft">{t.tags.map((x) => `#${x.name}`).join(" ")}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <nav className="flex items-center justify-between border-t border-navy-700 px-4 py-3 text-sm" aria-label="Pagination">
              {page > 1 ? <Link href={pageHref(page - 1)} className="text-electric-soft hover:underline">← Newer</Link> : <span />}
              <span className="text-navy-400">Page {page} of {pages}</span>
              {page < pages ? <Link href={pageHref(page + 1)} className="text-electric-soft hover:underline">Older →</Link> : <span />}
            </nav>
          )}
        </Card>
        </>
      )}
    </>
  );
}
