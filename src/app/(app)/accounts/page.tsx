import type { Metadata } from "next";
import { Card, CardTitle, PageHeader } from "@/components/ui";
import { listAccounts } from "@/lib/data/accounts";
import { requireUser } from "@/lib/session";
import { AccountForm } from "./account-form";
import { AccountRow } from "./account-row";

export const metadata: Metadata = { title: "Accounts" };

export default async function AccountsPage({ searchParams }: PageProps<"/accounts">) {
  const user = await requireUser();
  const [accounts, { welcome }] = await Promise.all([listAccounts(user.id), searchParams]);

  return (
    <>
      <PageHeader title="Trading accounts" description="Each account keeps its own currency and starting balance. Statistics never mix currencies." />
      {welcome && accounts.length === 0 && (
        <Card className="mb-6 border-electric/40 bg-electric/5">
          <p className="text-sm text-white">Welcome to EDGEFORGE. Start by adding the account you trade from, then log or import your trades.</p>
        </Card>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardTitle>Your accounts</CardTitle>
          {accounts.length === 0 ? (
            <p className="text-sm text-navy-300">No accounts yet.</p>
          ) : (
            <ul className="divide-y divide-navy-700">
              {accounts.map((a) => (
                <AccountRow
                  key={a.id}
                  account={{
                    id: a.id,
                    name: a.name,
                    broker: a.broker,
                    currency: a.currency,
                    startingBalance: a.startingBalance.toString(),
                    trades: a._count.trades,
                    dailyLossLimit: a.dailyLossLimit?.toString() ?? null,
                    maxTradesPerDay: a.maxTradesPerDay,
                    maxRiskPerTrade: a.maxRiskPerTrade?.toString() ?? null,
                  }}
                />
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardTitle>Add an account</CardTitle>
          <AccountForm />
        </Card>
      </div>
    </>
  );
}
