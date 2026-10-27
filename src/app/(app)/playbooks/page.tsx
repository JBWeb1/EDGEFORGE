import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardTitle, PageHeader, cn } from "@/components/ui";
import { breakdown, summarize } from "@/lib/analytics/metrics";
import { computeClosedResults } from "@/lib/analytics/trade-math";
import { prisma } from "@/lib/db";
import { TRADE_EXTRAS, toTradeInput } from "@/lib/data/trades";
import { money, percent, pnlClass, rMultiple } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { PlaybookCard } from "./playbook-card";
import { PlaybookForm } from "./playbook-form";

export const metadata: Metadata = { title: "Playbooks" };

export default async function PlaybooksPage() {
  const user = await requireUser();
  const [playbooks, trades] = await Promise.all([
    prisma.playbook.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
      include: { rules: { orderBy: { order: "asc" } } },
    }),
    prisma.trade.findMany({
      where: { userId: user.id, playbookId: { not: null }, exitPrice: { not: null } },
      include: { ...TRADE_EXTRAS, account: { select: { currency: true } } },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Playbooks"
        description="Write each strategy as a checklist. Tick the rules a trade met and EDGEFORGE grades it A–D, so you can see whether following your plan actually pays."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="flex flex-col gap-6">
          {playbooks.length === 0 && (
            <Card>
              <p className="text-sm text-navy-300">No playbooks yet. Create your first one, then pick it when you log a trade.</p>
            </Card>
          )}
          {playbooks.map((p) => {
            const own = trades.filter((t) => t.playbookId === p.id);
            // One currency per summary: use the most common currency among this playbook's trades.
            const counts = new Map<string, number>();
            for (const t of own) counts.set(t.account.currency, (counts.get(t.account.currency) ?? 0) + 1);
            const currency = [...counts.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? "USD";
            const results = computeClosedResults(own.filter((t) => t.account.currency === currency).map(toTradeInput));
            const s = summarize(results);
            const grades = breakdown(results, "grade");
            return (
              <PlaybookCard
                key={p.id}
                playbook={{ id: p.id, name: p.name, description: p.description, rules: p.rules.map((r) => r.text) }}
                stats={
                  results.length === 0 ? (
                    <p className="text-sm text-navy-400">No closed trades tagged with this playbook yet.</p>
                  ) : (
                    <div className="border-t border-navy-700 pt-3">
                      <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                        <span className="text-navy-300">Trades <span className="num text-white">{s.closedTrades}</span></span>
                        <span className="text-navy-300">Win rate <span className="num text-white">{percent(s.winRate)}</span></span>
                        <span className="text-navy-300">Net <span className={cn("num font-semibold", pnlClass(s.netPnl))}>{money(s.netPnl, currency, { signed: true })}</span></span>
                        <span className="text-navy-300">Avg R <span className="num text-white">{rMultiple(s.averageR)}</span></span>
                        <Link href={`/trades?playbook=${p.id}`} className="text-electric-soft hover:underline">View trades →</Link>
                      </div>
                      <table className="w-full table-fixed text-sm">
                        <thead className="text-left text-xs uppercase tracking-wider text-navy-400">
                          <tr><th className="pb-1 font-medium">Grade</th><th className="w-16 pb-1 text-right font-medium">#</th><th className="w-20 pb-1 text-right font-medium">Win</th><th className="w-28 pb-1 text-right font-medium">Avg</th></tr>
                        </thead>
                        <tbody className="divide-y divide-navy-700/60">
                          {grades.map((g) => (
                            <tr key={g.key}>
                              <td className="py-1.5 text-navy-200">{g.key}</td>
                              <td className="num py-1.5 text-right">{g.trades}</td>
                              <td className="num py-1.5 text-right">{percent(g.winRate, 0)}</td>
                              <td className={cn("num py-1.5 text-right", pnlClass(g.expectancy))}>{money(g.expectancy, currency, { signed: true })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                }
              />
            );
          })}
        </div>
        <Card className="h-fit lg:sticky lg:top-8">
          <CardTitle>New playbook</CardTitle>
          <PlaybookForm />
        </Card>
      </div>
    </>
  );
}
