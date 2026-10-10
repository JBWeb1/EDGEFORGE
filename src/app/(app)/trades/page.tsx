import type { Metadata } from "next";
import Link from "next/link";
import { LocalTime } from "@/components/local-time";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, Select, cn } from "@/components/ui";
import { computeTradeResult, isClosed } from "@/lib/analytics/trade-math";
import { listAccounts } from "@/lib/data/accounts";
import { listTrades, toTradeInput } from "@/lib/data/trades";
import { money, plain, pnlClass, rMultiple } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Journal" };

export default async function TradesPage({ searchParams }: PageProps<"/trades">) {
  const user = await requireUser();
  const sp = await searchParams;
  const accountId = typeof sp.account === "string" ? sp.account : undefined;
  const status = sp.status === "open" || sp.status === "closed" ? sp.status : undefined;
  const [accounts, trades] = await Promise.all([listAccounts(user.id), listTrades(user.id, { accountId, status })]);

  return (
    <>
      <PageHeader
        title="Trade journal"
        description={`${trades.length} trade${trades.length === 1 ? "" : "s"}`}
        actions={
          <>
            <ButtonLink href="/import" variant="secondary">Import CSV</ButtonLink>
            <ButtonLink href="/trades/new">Log trade</ButtonLink>
          </>
        }
      />

      <form className="mb-4 flex flex-wrap gap-3">
        <Select name="account" defaultValue={accountId ?? ""} className="w-auto">
          <option value="">All accounts</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
        <Select name="status" defaultValue={status ?? ""} className="w-auto">
          <option value="">Open &amp; closed</option>
          <option value="closed">Closed</option>
          <option value="open">Open</option>
        </Select>
        <button type="submit" className="rounded-lg border border-navy-600 px-3 text-sm text-navy-200 hover:text-white">Filter</button>
      </form>

      {trades.length === 0 ? (
        <EmptyState
          title="No trades yet"
          action={<div className="flex gap-2"><ButtonLink href="/trades/new">Log your first trade</ButtonLink><ButtonLink href="/import" variant="secondary">Import CSV</ButtonLink></div>}
        >
          Every statistic in EDGEFORGE is calculated from the trades you record here.
        </EmptyState>
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-sm">
              <thead className="border-b border-navy-700 text-left text-xs uppercase tracking-wider text-navy-400">
                <tr>
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
                {trades.map((t) => {
                  const input = toTradeInput(t);
                  const r = isClosed(input) ? computeTradeResult(input) : null;
                  return (
                    <tr key={t.id} className="hover:bg-navy-800/50">
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
                      <td className="px-4 py-3 text-navy-300">{t.setup ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
