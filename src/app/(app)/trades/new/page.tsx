import type { Metadata } from "next";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { listAccounts } from "@/lib/data/accounts";
import { knownSetups, knownTags } from "@/lib/data/trade-form";
import { requireUser } from "@/lib/session";
import { TradeForm } from "../trade-form";

export const metadata: Metadata = { title: "New trade" };

export default async function NewTradePage({ searchParams }: PageProps<"/trades/new">) {
  const user = await requireUser();
  const [accounts, setups, { account }, tags] = await Promise.all([
    listAccounts(user.id),
    knownSetups(user.id),
    searchParams,
    knownTags(user.id),
  ]);

  if (accounts.length === 0) {
    return (
      <EmptyState title="Add an account first" action={<ButtonLink href="/accounts">Add account</ButtonLink>}>
        Trades belong to a trading account so they can use its currency and starting balance.
      </EmptyState>
    );
  }

  const accountId = accounts.some((a) => a.id === account) ? String(account) : accounts[0].id;
  return (
    <>
      <PageHeader title="Log a trade" description="Enter what happened. EDGEFORGE calculates the results." />
      <TradeForm
        accounts={accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency }))}
        initial={{ accountId, direction: "LONG", multiplier: "1" }}
        setups={setups}
        tags={tags}
      />
    </>
  );
}
