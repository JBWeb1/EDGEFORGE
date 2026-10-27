"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button, Field, FormMessage, Input, Textarea } from "@/components/ui";
import type { FormState } from "@/lib/validation";
import { savePlaybook } from "./actions";

type Values = { id: string; name: string; description: string | null; rules: string[] };

export function PlaybookForm({ playbook, onDone }: { playbook?: Values; onDone?: () => void }) {
  const [state, action, pending] = useActionState(savePlaybook, {} as FormState);
  const ref = useRef<HTMLFormElement>(null);
  const key = playbook?.id ?? "new";

  useEffect(() => {
    if (state.ok) {
      if (!playbook) ref.current?.reset();
      onDone?.();
    }
  }, [state, playbook, onDone]);

  return (
    <form ref={ref} action={action} className="flex flex-col gap-4">
      {playbook && <input type="hidden" name="id" value={playbook.id} />}
      <Field label="Name" htmlFor={`pb-name-${key}`} errors={state.errors?.name}>
        <Input id={`pb-name-${key}`} name="name" defaultValue={playbook?.name} placeholder="e.g. Opening range breakout" required />
      </Field>
      <Field label="What is it?" htmlFor={`pb-desc-${key}`} hint="Optional: market conditions, timeframe, instruments." errors={state.errors?.description}>
        <Textarea id={`pb-desc-${key}`} name="description" defaultValue={playbook?.description ?? ""} className="min-h-16" />
      </Field>
      <Field
        label="Rules — one per line"
        htmlFor={`pb-rules-${key}`}
        hint="Write them as checks you can tick: entry trigger, confirmation, stop placement, size, target."
        errors={state.errors?.rules}
      >
        <Textarea
          id={`pb-rules-${key}`}
          name="rules"
          defaultValue={playbook?.rules.join("\n") ?? ""}
          className="min-h-36 font-mono text-[13px]"
          placeholder={"Price breaks the first 15-minute range\nVolume above the 20-day average\nStop below the range low\nRisk ≤ 1% of the account\nTarget at least 2R"}
          required
        />
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : playbook ? "Save playbook" : "Create playbook"}</Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
