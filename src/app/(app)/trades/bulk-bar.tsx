"use client";

import { useActionState, useEffect, useState } from "react";
import { Button, FormMessage, Input, Select } from "@/components/ui";
import type { FormState } from "@/lib/validation";
import { bulkEditTrades } from "./actions";

export const BULK_FORM_ID = "bulk-trades";

const selector = `input[type=checkbox][name=ids][form=${BULK_FORM_ID}]`;

/**
 * Bulk actions for the journal table. Row checkboxes are rendered by the
 * server table and join this form through the `form` attribute.
 */
export function BulkBar({ playbooks }: { playbooks: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(bulkEditTrades, {} as FormState);
  const [selected, setSelected] = useState(0);
  const [kind, setKind] = useState("tag");

  useEffect(() => {
    const count = () => setSelected(document.querySelectorAll<HTMLInputElement>(`${selector}:checked`).length);
    // Recount on ticks, and when rows change after an edit (e.g. deleted trades disappear).
    document.addEventListener("change", count);
    const observer = new MutationObserver(count);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      document.removeEventListener("change", count);
      observer.disconnect();
    };
  }, []);

  const toggleAll = (on: boolean) => {
    document.querySelectorAll<HTMLInputElement>(selector).forEach((c) => (c.checked = on));
    setSelected(on ? document.querySelectorAll(selector).length : 0);
  };

  return (
    <form
      id={BULK_FORM_ID}
      action={action}
      onSubmit={(e) => {
        if (kind === "delete" && !confirm(`Delete ${selected} trade${selected === 1 ? "" : "s"}? This cannot be undone.`)) e.preventDefault();
      }}
      className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-navy-700 bg-navy-850/60 px-3 py-2 text-sm"
    >
      <label className="flex items-center gap-2 text-navy-300">
        <input type="checkbox" onChange={(e) => toggleAll(e.target.checked)} className="h-4 w-4 accent-electric" aria-label="Select all trades on this page" />
        {selected > 0 ? `${selected} selected` : "Select trades to edit them together"}
      </label>
      {selected > 0 && (
        <>
          <Select name="bulkAction" value={kind} onChange={(e) => setKind(e.target.value)} className="w-auto py-1.5" aria-label="Bulk action">
            <option value="tag">Add tags</option>
            <option value="playbook">Set playbook</option>
            <option value="setup">Set setup</option>
            <option value="delete">Delete</option>
          </Select>
          {kind === "tag" && <Input name="bulkValue" placeholder="news, a+ setup" className="w-48 py-1.5" aria-label="Tags to add" required />}
          {kind === "setup" && <Input name="bulkValue" placeholder="Setup name (empty clears it)" className="w-56 py-1.5" aria-label="Setup" />}
          {kind === "playbook" && (
            <Select name="bulkValue" className="w-auto py-1.5" aria-label="Playbook">
              <option value="">No playbook</option>
              {playbooks.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          )}
          <Button type="submit" variant={kind === "delete" ? "danger" : "primary"} disabled={pending} className="py-1.5">
            {pending ? "Applying…" : "Apply"}
          </Button>
        </>
      )}
      <FormMessage state={state} />
    </form>
  );
}
