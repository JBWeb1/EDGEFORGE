import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink, Card, CardTitle, PageHeader } from "@/components/ui";
import { getSettings } from "@/lib/data/settings";
import { requireUser } from "@/lib/session";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const settings = await getSettings(user.id);
  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Trading day</CardTitle>
          <SettingsForm timeZone={settings.timeZone} />
        </Card>
        <Card>
          <CardTitle>Your data</CardTitle>
          <p className="mb-4 text-sm text-navy-300">
            Download every trade as a CSV. The file uses EDGEFORGE&apos;s import format plus calculated columns, so you can
            re-import it or open it in a spreadsheet.
          </p>
          <ButtonLink href="/export" variant="secondary" prefetch={false}>Export all trades (CSV)</ButtonLink>
          <p className="mt-6 text-sm text-navy-300">
            Risk rules (daily loss limit, max trades per day, max risk per trade) are set per account on the{" "}
            <Link href="/accounts" className="text-electric-soft hover:underline">Accounts</Link> page.
          </p>
        </Card>
      </div>
    </>
  );
}
