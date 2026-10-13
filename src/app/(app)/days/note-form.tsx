"use client";

import { useActionState } from "react";
import { Button, Field, FormMessage, Textarea, cn } from "@/components/ui";
import type { FormState } from "@/lib/validation";
import { saveDailyNote } from "./actions";

const MOODS = ["Rough", "Off", "Okay", "Good", "Great"];

export function NoteForm({
  date,
  note,
}: {
  date: string;
  note: { premarket: string | null; review: string | null; mood: number | null } | null;
}) {
  const [state, action, pending] = useActionState(saveDailyNote, {} as FormState);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="date" value={date} />
      <Field
        label="Pre-market plan"
        htmlFor="premarket"
        hint="Bias, key levels, setups you're watching, news, what would make you sit out."
        errors={state.errors?.premarket}
      >
        <Textarea id="premarket" name="premarket" defaultValue={note?.premarket ?? ""} className="min-h-32" />
      </Field>
      <Field label="Post-session review" htmlFor="review" hint="Did you follow the plan? What went well, what will you change tomorrow?" errors={state.errors?.review}>
        <Textarea id="review" name="review" defaultValue={note?.review ?? ""} className="min-h-32" />
      </Field>
      <fieldset>
        <legend className="mb-1.5 text-xs font-medium text-navy-300">How did you trade today?</legend>
        <div className="flex flex-wrap gap-2">
          {MOODS.map((label, i) => (
            <label key={label} className="cursor-pointer">
              <input type="radio" name="mood" value={i + 1} defaultChecked={note?.mood === i + 1} className="peer sr-only" />
              <span className={cn("block rounded-lg border border-navy-600 px-3 py-1.5 text-sm text-navy-300", "peer-checked:border-electric peer-checked:bg-electric/15 peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-electric")}>
                {i + 1} · {label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save journal"}</Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
