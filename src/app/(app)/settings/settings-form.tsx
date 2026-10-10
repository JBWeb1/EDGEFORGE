"use client";

import { useActionState, useMemo, useState, useSyncExternalStore } from "react";
import { Button, Field, FormMessage, Select } from "@/components/ui";
import type { FormState } from "@/lib/validation";
import { saveSettings } from "./actions";

const noop = () => () => {};

export function SettingsForm({ timeZone }: { timeZone: string }) {
  const [state, action, pending] = useActionState(saveSettings, {} as FormState);
  const [value, setValue] = useState(timeZone);
  const zones = useMemo(() => {
    const all = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
    return all.includes("UTC") ? all : ["UTC", ...all];
  }, []);
  const browserZone = useSyncExternalStore(noop, () => Intl.DateTimeFormat().resolvedOptions().timeZone, () => null);

  return (
    <form action={action} className="flex max-w-lg flex-col gap-4">
      <Field
        label="Time zone"
        htmlFor="timeZone"
        hint="Defines your trading day for the calendar, daily P&L, risk rules and weekday/hour statistics. CSV times without an offset are read in this zone."
        errors={state.errors?.timeZone}
      >
        <Select id="timeZone" name="timeZone" value={value} onChange={(e) => setValue(e.target.value)}>
          {(zones.includes(value) ? zones : [value, ...zones]).map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
        </Select>
      </Field>
      {browserZone && browserZone !== value && (
        <button type="button" onClick={() => setValue(browserZone)} className="self-start text-sm text-electric-soft hover:underline">
          Use this device&apos;s time zone ({browserZone.replace(/_/g, " ")})
        </button>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save settings"}</Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
