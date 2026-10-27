import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { listAccounts } from "@/lib/data/accounts";
import { getTrade } from "@/lib/data/trades";
import { knownSetups, knownTags, playbookOptions, tradeToFormValues } from "@/lib/data/trade-form";
import { requireUser } from "@/lib/session";
import { TradeForm } from "../../trade-form";

export const metadata: Metadata = { title: "Edit trade" };

export default async function EditTradePage({ params }: PageProps<"/trades/[id]/edit">) {
  const user = await requireUser();
  const { id } = await params;
  const [trade, accounts, setups, tags, playbooks] = await Promise.all([
    getTrade(user.id, id),
    listAccounts(user.id),
    knownSetups(user.id),
    knownTags(user.id),
    playbookOptions(user.id),
  ]);
  if (!trade) notFound();

  return (
    <>
      <PageHeader title={`Edit ${trade.symbol} trade`} />
      <TradeForm
        accounts={accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency }))}
        initial={tradeToFormValues(trade)}
        setups={setups}
        tags={tags}
        playbooks={playbooks}
      />
    </>
  );
}
