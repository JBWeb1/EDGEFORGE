"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button, Field, FormMessage, Input, Select } from "@/components/ui";
import { CURRENCIES, type FormState } from "@/lib/validation";
import { saveAccount } from "./actions";

type AccountValues = {
  id: string;
  name: string;
  broker: string | null;
  currency: string;
  startingBalance: string;
  dailyLossLimit: string | null;
  maxTradesPerDay: number | null;
  maxRiskPerTrade: string | null;
};

export function AccountForm({ account, onDone }: { account?: AccountValues; onDone?: () => void }) {
  const [state, action, pending] = useActionState(saveAccount, {} as FormState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      if (!account) formRef.current?.reset();
      onDone?.();
    }
  }, [state, account, onDone]);

  return (
    <form ref={formRef} action={action} className="grid gap-4 sm:grid-cols-2">
      {account && <input type="hidden" name="id" value={account.id} />}
      <Field label="Account name" htmlFor={`name-${account?.id ?? "new"}`} errors={state.errors?.name}>
        <Input id={`name-${account?.id ?? "new"}`} name="name" defaultValue={account?.name} placeholder="e.g. Main futures account" required />
      </Field>
      <Field label="Broker / exchange" htmlFor={`broker-${account?.id ?? "new"}`} errors={state.errors?.broker}>
        <Input id={`broker-${account?.id ?? "new"}`} name="broker" defaultValue={account?.broker ?? ""} placeholder="Optional" />
      </Field>
      <Field label="Currency" htmlFor={`currency-${account?.id ?? "new"}`} errors={state.errors?.currency}>
        <Select id={`currency-${account?.id ?? "new"}`} name="currency" defaultValue={account?.currency ?? "USD"}>
          {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
        </Select>
      </Field>
      <Field
        label="Starting balance"
        htmlFor={`balance-${account?.id ?? "new"}`}
        hint="Used for the equity curve, return % and drawdown %."
        errors={state.errors?.startingBalance}
      >
        <Input id={`balance-${account?.id ?? "new"}`} name="startingBalance" inputMode="decimal" defaultValue={account?.startingBalance ?? ""} placeholder="0.00" />
      </Field>
      <fieldset className="grid gap-4 border-t border-navy-700 pt-4 sm:col-span-2 sm:grid-cols-3">
        <legend className="mb-2 pt-4 text-xs font-semibold uppercase tracking-wider text-navy-300">Risk rules (optional)</legend>
        <Field label="Daily loss limit" htmlFor={`dll-${account?.id ?? "new"}`} errors={state.errors?.dailyLossLimit}>
          <Input id={`dll-${account?.id ?? "new"}`} name="dailyLossLimit" inputMode="decimal" defaultValue={account?.dailyLossLimit ?? ""} placeholder="e.g. 500" />
        </Field>
        <Field label="Max trades per day" htmlFor={`mtd-${account?.id ?? "new"}`} errors={state.errors?.maxTradesPerDay}>
          <Input id={`mtd-${account?.id ?? "new"}`} name="maxTradesPerDay" inputMode="numeric" defaultValue={account?.maxTradesPerDay ?? ""} placeholder="e.g. 4" />
        </Field>
        <Field label="Max risk per trade" htmlFor={`mrt-${account?.id ?? "new"}`} errors={state.errors?.maxRiskPerTrade}>
          <Input id={`mrt-${account?.id ?? "new"}`} name="maxRiskPerTrade" inputMode="decimal" defaultValue={account?.maxRiskPerTrade ?? ""} placeholder="e.g. 250" />
        </Field>
        <p className="text-xs text-navy-400 sm:col-span-3">
          EDGEFORGE flags trades that break these rules and shows a live guardrail for today on the dashboard.
        </p>
      </fieldset>
      <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : account ? "Save changes" : "Add account"}</Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
