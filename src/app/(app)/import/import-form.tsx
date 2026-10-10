"use client";

import Link from "next/link";
import { useActionState } from "react";
import { LocalTime } from "@/components/local-time";
import { Badge, Button, Card, CardTitle, Field, Input, Select } from "@/components/ui";
import { importCsv, type ImportState } from "./actions";

export function ImportForm({ accounts }: { accounts: { id: string; name: string; currency: string }[] }) {
  const [state, action, pending] = useActionState(importCsv, { stage: "idle" } as ImportState);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardTitle>1 · Upload</CardTitle>
        <form action={action} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <input type="hidden" name="intent" value="preview" />
          <Field label="Import into account" htmlFor="accountId">
            <Select id="accountId" name="accountId" defaultValue={state.stage === "preview" ? state.accountId : accounts[0]?.id}>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
            </Select>
          </Field>
          <Field label="CSV file (max 2 MB, 5,000 rows)" htmlFor="file">
            <Input id="file" name="file" type="file" accept=".csv,text/csv" required className="file:mr-3 file:rounded file:border-0 file:bg-navy-700 file:px-2 file:py-1 file:text-navy-200" />
          </Field>
          <Button type="submit" variant="secondary" disabled={pending}>{pending ? "Checking…" : "Check file"}</Button>
        </form>
        {state.stage === "error" && <p className="mt-4 text-sm text-loss">{state.message}</p>}
      </Card>

      {state.stage === "preview" && (
        <Card>
          <CardTitle>2 · Review “{state.fileName}”</CardTitle>
          {state.fileErrors.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-loss">
              {state.fileErrors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap gap-2">
                <Badge tone="profit">{state.valid} ready to import</Badge>
                <Badge tone="neutral">{state.duplicatesInDb} already in this account</Badge>
                <Badge tone={state.invalid.length ? "loss" : "neutral"}>{state.invalid.length} with errors (skipped)</Badge>
              </div>
              <p className="mb-2 text-xs text-navy-400">
                Column mapping: {Object.entries(state.mapping).map(([field, col]) => `${field} ← ${col}`).join(" · ")}
              </p>
              {state.sample.length > 0 && (
                <div className="mb-4 overflow-x-auto">
                  <table className="w-full min-w-[36rem] text-sm">
                    <thead className="text-left text-xs uppercase tracking-wider text-navy-400">
                      <tr><th className="py-2">Line</th><th>Symbol</th><th>Side</th><th>Entry</th><th>Exit</th><th></th></tr>
                    </thead>
                    <tbody className="divide-y divide-navy-700/60">
                      {state.sample.map((r) => (
                        <tr key={r.line}>
                          <td className="py-2 text-navy-400">{r.line}</td>
                          <td className="text-white">{r.symbol}</td>
                          <td>{r.direction === "LONG" ? "Long" : "Short"}</td>
                          <td><LocalTime value={r.entryAt} /></td>
                          <td>{r.exitAt ? <LocalTime value={r.exitAt} /> : <Badge tone="info">open</Badge>}</td>
                          <td>{r.duplicate && <Badge>duplicate</Badge>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {state.valid + state.duplicatesInDb > state.sample.length && (
                    <p className="mt-2 text-xs text-navy-400">Showing the first {state.sample.length} valid rows.</p>
                  )}
                </div>
              )}
              {state.invalid.length > 0 && (
                <details className="mb-4 rounded-lg border border-loss/30 bg-loss/5 p-3 text-sm">
                  <summary className="cursor-pointer text-loss">Rows with errors</summary>
                  <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto text-navy-200">
                    {state.invalid.slice(0, 200).map((r) => (
                      <li key={r.line}><span className="text-navy-400">Line {r.line}:</span> {r.errors.join(" ")}</li>
                    ))}
                  </ul>
                </details>
              )}
              <form action={action}>
                <input type="hidden" name="intent" value="commit" />
                <input type="hidden" name="accountId" value={state.accountId} />
                <Button type="submit" disabled={pending || state.valid === 0}>
                  {pending ? "Importing…" : `Import ${state.valid} trade${state.valid === 1 ? "" : "s"}`}
                </Button>
              </form>
            </>
          )}
        </Card>
      )}

      {state.stage === "done" && (
        <Card className="border-profit/40">
          <CardTitle>Import complete</CardTitle>
          <p className="text-sm text-navy-200">
            Imported <strong className="text-white">{state.imported}</strong> trades. Skipped {state.duplicates} duplicate
            {state.duplicates === 1 ? "" : "s"} and {state.invalid} invalid row{state.invalid === 1 ? "" : "s"}.
          </p>
          <div className="mt-4 flex gap-2">
            <Link href="/trades" className="text-sm text-electric-soft hover:underline">View journal →</Link>
            <Link href="/dashboard" className="text-sm text-electric-soft hover:underline">View dashboard →</Link>
          </div>
        </Card>
      )}
    </div>
  );
}
