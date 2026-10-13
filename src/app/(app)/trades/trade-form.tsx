"use client";

import Decimal from "decimal.js";
import { useActionState, useMemo, useState } from "react";
import { DateTimeInput } from "@/components/datetime-input";
import { Button, ButtonLink, Card, CardTitle, Field, FormMessage, Input, Select, Textarea, cn } from "@/components/ui";
import { computeTradeResult, type Direction } from "@/lib/analytics/trade-math";
import { money, pnlClass, rMultiple, ratio } from "@/lib/format";
import { EMOTIONS, type FormState } from "@/lib/validation";
import { saveTrade } from "./actions";

export type TradeFormValues = Record<string, string>;

const isPositive = (v: string | undefined) => !!v && /^\d+(\.\d+)?$/.test(v.trim()) && Number(v) > 0;

function Preview({ v, currency }: { v: TradeFormValues; currency: string }) {
  const result = useMemo(() => {
    if (!isPositive(v.quantity) || !isPositive(v.entryPrice) || !isPositive(v.exitPrice)) return null;
    const opt = (x?: string) => (isPositive(x) ? x!.trim() : null);
    return computeTradeResult({
      id: "preview",
      symbol: v.symbol || "",
      direction: (v.direction as Direction) || "LONG",
      quantity: v.quantity.trim(),
      multiplier: opt(v.multiplier) ?? "1",
      entryPrice: v.entryPrice.trim(),
      exitPrice: v.exitPrice.trim(),
      entryAt: new Date(0),
      exitAt: new Date(0),
      stopLoss: opt(v.stopLoss),
      takeProfit: opt(v.takeProfit),
      fees: /^\d+(\.\d+)?$/.test(v.fees?.trim() ?? "") ? v.fees.trim() : "0",
    });
  }, [v]);

  const planned = useMemo(() => {
    if (!isPositive(v.entryPrice) || !isPositive(v.stopLoss) || !isPositive(v.quantity)) return null;
    const dist = new Decimal(v.entryPrice).minus(v.stopLoss).abs();
    if (dist.isZero()) return null;
    const risk = dist.mul(v.quantity).mul(isPositive(v.multiplier) ? v.multiplier : 1);
    const rr = isPositive(v.takeProfit) ? new Decimal(v.takeProfit).minus(v.entryPrice).abs().div(dist).toNumber() : null;
    return { risk, rr };
  }, [v]);

  return (
    <Card className="lg:sticky lg:top-8">
      <CardTitle>Calculated automatically</CardTitle>
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-xs text-navy-400">Risk at stop</dt>
          <dd className="num mt-1 text-white">{planned ? money(planned.risk, currency) : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-navy-400">Planned reward : risk</dt>
          <dd className="num mt-1 text-white">{planned?.rr ? `${ratio(planned.rr)} : 1` : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-navy-400">Gross P&amp;L</dt>
          <dd className={cn("num mt-1", pnlClass(result?.grossPnl))}>{result ? money(result.grossPnl, currency, { signed: true }) : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-navy-400">Net P&amp;L (after fees)</dt>
          <dd className={cn("num mt-1 text-lg font-semibold", pnlClass(result?.netPnl))}>
            {result ? money(result.netPnl, currency, { signed: true }) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-navy-400">R multiple</dt>
          <dd className={cn("num mt-1", pnlClass(result?.rMultiple))}>{rMultiple(result?.rMultiple)}</dd>
        </div>
      </dl>
      <p className="mt-4 text-xs text-navy-400">
        Net P&amp;L = (exit − entry) × quantity × multiplier, reversed for shorts, minus fees. Leave the exit empty while the trade is open.
      </p>
    </Card>
  );
}

export function TradeForm({
  accounts,
  initial,
  setups = [],
  tags = [],
}: {
  accounts: { id: string; name: string; currency: string }[];
  initial: TradeFormValues;
  setups?: string[];
  tags?: string[];
}) {
  const [state, action, pending] = useActionState(saveTrade, {} as FormState);
  const base = state.values ?? initial;
  const [live, setLive] = useState<TradeFormValues>(base);
  const e = state.errors ?? {};
  const currency = accounts.find((a) => a.id === live.accountId)?.currency ?? accounts[0]?.currency ?? "USD";

  return (
    <form
      // React resets a form after its action runs; remounting after each failed
      // attempt makes the submitted values the new defaults.
      key={state.attempt ?? 0}
      action={action}
      onChange={(ev) => {
        const t = ev.target;
        if ((t instanceof HTMLInputElement || t instanceof HTMLSelectElement) && t.name) {
          setLive((prev) => ({ ...prev, [t.name]: t.value }));
        }
      }}
      className="grid gap-6 lg:grid-cols-[1fr_20rem]"
    >
      {base.id && <input type="hidden" name="id" value={base.id} />}
      <div className="flex flex-col gap-6">
        <Card>
          <CardTitle>Position</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Account" htmlFor="accountId" errors={e.accountId}>
              <Select id="accountId" name="accountId" defaultValue={base.accountId}>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
              </Select>
            </Field>
            <Field label="Symbol" htmlFor="symbol" errors={e.symbol}>
              <Input id="symbol" name="symbol" defaultValue={base.symbol} placeholder="AAPL, EURUSD, ES…" required autoCapitalize="characters" />
            </Field>
            <Field label="Direction" htmlFor="direction" errors={e.direction}>
              <Select id="direction" name="direction" defaultValue={base.direction || "LONG"}>
                <option value="LONG">Long</option>
                <option value="SHORT">Short</option>
              </Select>
            </Field>
            <Field label="Quantity" htmlFor="quantity" errors={e.quantity} hint="Shares, units, lots or contracts.">
              <Input id="quantity" name="quantity" inputMode="decimal" defaultValue={base.quantity} required />
            </Field>
            <Field label="Multiplier" htmlFor="multiplier" errors={e.multiplier} hint="Value of a 1.0 price move per unit. 1 for stocks & crypto.">
              <Input id="multiplier" name="multiplier" inputMode="decimal" defaultValue={base.multiplier || "1"} />
            </Field>
            <Field label="Fees & commissions" htmlFor="fees" errors={e.fees} hint={`Round trip, in ${currency}.`}>
              <Input id="fees" name="fees" inputMode="decimal" defaultValue={base.fees} placeholder="0.00" />
            </Field>
          </div>
        </Card>

        <Card>
          <CardTitle>Execution</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Entry price" htmlFor="entryPrice" errors={e.entryPrice}>
              <Input id="entryPrice" name="entryPrice" inputMode="decimal" defaultValue={base.entryPrice} required />
            </Field>
            <Field label="Entry time" htmlFor="entryAt" errors={e.entryAt}>
              <DateTimeInput id="entryAt" name="entryAt" defaultValue={base.entryAt} required />
            </Field>
            <Field label="Exit price" htmlFor="exitPrice" errors={e.exitPrice}>
              <Input id="exitPrice" name="exitPrice" inputMode="decimal" defaultValue={base.exitPrice} placeholder="Empty while open" />
            </Field>
            <Field label="Exit time" htmlFor="exitAt" errors={e.exitAt}>
              <DateTimeInput id="exitAt" name="exitAt" defaultValue={base.exitAt} />
            </Field>
            <Field label="Stop loss" htmlFor="stopLoss" errors={e.stopLoss} hint="Needed for risk and R multiple.">
              <Input id="stopLoss" name="stopLoss" inputMode="decimal" defaultValue={base.stopLoss} />
            </Field>
            <Field label="Take profit" htmlFor="takeProfit" errors={e.takeProfit}>
              <Input id="takeProfit" name="takeProfit" inputMode="decimal" defaultValue={base.takeProfit} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardTitle>Context &amp; psychology</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Setup" htmlFor="setup" errors={e.setup} hint="e.g. Opening range breakout">
              <Input id="setup" name="setup" defaultValue={base.setup} list="setup-suggestions" />
              <datalist id="setup-suggestions">
                {setups.map((s) => <option key={s} value={s} />)}
              </datalist>
            </Field>
            <Field label="Strategy" htmlFor="strategy" errors={e.strategy}>
              <Input id="strategy" name="strategy" defaultValue={base.strategy} />
            </Field>
            <Field label="Emotional state" htmlFor="emotion" errors={e.emotion}>
              <Select id="emotion" name="emotion" defaultValue={base.emotion}>
                <option value="">Not recorded</option>
                {EMOTIONS.map((em) => <option key={em} value={em}>{em.charAt(0) + em.slice(1).toLowerCase()}</option>)}
              </Select>
            </Field>
            <Field label="Followed my rules?" htmlFor="followedRules" errors={e.followedRules}>
              <Select id="followedRules" name="followedRules" defaultValue={base.followedRules}>
                <option value="">Not recorded</option>
                <option value="yes">Yes</option>
                <option value="no">No — rule broken</option>
              </Select>
            </Field>
            <Field label="Confidence (1–5)" htmlFor="confidence" errors={e.confidence}>
              <Select id="confidence" name="confidence" defaultValue={base.confidence}>
                <option value="">Not recorded</option>
                {[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}
              </Select>
            </Field>
            <Field label="Screenshot link" htmlFor="screenshotUrl" errors={e.screenshotUrl} hint="https:// link to a chart image.">
              <Input id="screenshotUrl" name="screenshotUrl" type="url" defaultValue={base.screenshotUrl} />
            </Field>
            <Field
              label="Tags"
              htmlFor="tags"
              errors={e.tags}
              className="sm:col-span-2"
              hint={tags.length ? `Comma-separated. Yours: ${tags.slice(0, 12).join(", ")}${tags.length > 12 ? "…" : ""}` : "Comma-separated, e.g. news, a+ setup, late entry"}
            >
              <Input id="tags" name="tags" defaultValue={base.tags} placeholder="news, a+ setup" />
            </Field>
            <Field label="Notes" htmlFor="notes" errors={e.notes} className="sm:col-span-2">
              <Textarea id="notes" name="notes" defaultValue={base.notes} placeholder="Why did you take it? What would you do differently?" />
            </Field>
          </div>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : base.id ? "Save trade" : "Add trade"}</Button>
          <ButtonLink href={base.id ? `/trades/${base.id}` : "/trades"} variant="ghost">Cancel</ButtonLink>
          <FormMessage state={state} />
        </div>
      </div>
      <Preview v={live} currency={currency} />
    </form>
  );
}
