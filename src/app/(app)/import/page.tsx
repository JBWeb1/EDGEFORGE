import type { Metadata } from "next";
import { ButtonLink, Card, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import { listAccounts } from "@/lib/data/accounts";
import { getSettings } from "@/lib/data/settings";
import { TEMPLATE_HEADERS } from "@/lib/import/csv";
import { requireUser } from "@/lib/session";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Import trades" };

export default async function ImportPage() {
  const user = await requireUser();
  const [accounts, { timeZone }] = await Promise.all([listAccounts(user.id), getSettings(user.id)]);

  if (accounts.length === 0) {
    return (
      <EmptyState title="Add an account first" action={<ButtonLink href="/accounts">Add account</ButtonLink>}>
        Imported trades are added to one of your trading accounts.
      </EmptyState>
    );
  }

  return (
    <>
      <PageHeader
        title="Import trades"
        description="Upload a CSV, review every row, then import. Nothing is saved until you confirm."
        actions={<ButtonLink href="/import-template" variant="secondary" prefetch={false}>Download template</ButtonLink>}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <ImportForm accounts={accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency }))} />
        <Card className="h-fit text-sm text-navy-300">
          <CardTitle>File format</CardTitle>
          <p className="mb-2">Required columns: <code className="text-navy-200">symbol, direction, quantity, entry_date, entry_price</code>.</p>
          <p className="mb-2">Optional: {TEMPLATE_HEADERS.slice(5).join(", ")}. Common broker column names (e.g. “Ticker”, “Side”, “Qty”, “Commission”) are recognised.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Dates must be ISO 8601, e.g. <code className="text-navy-200">2026-03-02 14:30</code>. Times without an offset are read in your time zone ({timeZone.replace(/_/g, " ")}, change it in Settings). Formats like 03/02/2026 are rejected, never guessed.</li>
            <li>Use “.” for decimals.</li>
            <li>Leave exit price and exit date empty for open trades.</li>
            <li>Fees are always treated as a cost.</li>
            <li>Re-importing the same file is safe: identical trades are detected and skipped.</li>
          </ul>
        </Card>
      </div>
    </>
  );
}
