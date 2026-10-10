"use client";

import { useMemo, useState } from "react";
import { Card, CardTitle, Field, Input, Select, cn } from "@/components/ui";
import { positionSize } from "@/lib/analytics/position-size";
import { money, ratio } from "@/lib/format";

type Account = { id: string; name: string; currency: string; balance: string; maxRiskPerTrade: string | null };

export function PositionCalculator({ accounts }: { accounts: Account[] }) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const account = accounts.find((a) => a.id === accountId);
  const currency = account?.currency ?? "USD";
  const [mode, setMode] = useState<"percent" | "amount">("percent");
  const [v, setV] = useState({
    balance: account?.balance ?? "",
    riskPercent: "1",
    riskAmount: "",
    entry: "",
    stop: "",
    target: "",
    multiplier: "1",
    step: "1",
  });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((p) => ({ ...p, [k]: e.target.value }));

  const result = useMemo(() => {
    if (!v.entry || !v.stop) return null;
    return positionSize({
      balance: v.balance || null,
      riskPercent: mode === "percent" ? v.riskPercent || null : null,
      riskAmount: mode === "amount" ? v.riskAmount || null : null,
      entry: v.entry,
      stop: v.stop,
      target: v.target || null,
      multiplier: v.multiplier || "1",
      step: v.step || "1",
    });
  }, [v, mode]);

  const overMax = result?.ok && account?.maxRiskPerTrade && result.actualRisk.gt(account.maxRiskPerTrade);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <Card>
        <CardTitle>Inputs</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          {accounts.length > 0 && (
            <Field label="Account" htmlFor="pc-account" hint="Pre-fills the current balance.">
              <Select
                id="pc-account"
                value={accountId}
                onChange={(e) => {
                  const next = accounts.find((a) => a.id === e.target.value);
                  setAccountId(e.target.value);
                  if (next) setV((p) => ({ ...p, balance: next.balance }));
                }}
              >
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
              </Select>
            </Field>
          )}
          <Field label={`Account balance (${currency})`} htmlFor="pc-balance">
            <Input id="pc-balance" inputMode="decimal" value={v.balance} onChange={set("balance")} />
          </Field>
          <Field label="Risk as" htmlFor="pc-mode">
            <Select id="pc-mode" value={mode} onChange={(e) => setMode(e.target.value as "percent" | "amount")}>
              <option value="percent">% of balance</option>
              <option value="amount">Fixed amount</option>
            </Select>
          </Field>
          {mode === "percent" ? (
            <Field label="Risk %" htmlFor="pc-pct" hint="Many traders risk 0.5–2% per trade.">
              <Input id="pc-pct" inputMode="decimal" value={v.riskPercent} onChange={set("riskPercent")} />
            </Field>
          ) : (
            <Field label={`Risk amount (${currency})`} htmlFor="pc-amt">
              <Input id="pc-amt" inputMode="decimal" value={v.riskAmount} onChange={set("riskAmount")} />
            </Field>
          )}
          <Field label="Entry price" htmlFor="pc-entry">
            <Input id="pc-entry" inputMode="decimal" value={v.entry} onChange={set("entry")} />
          </Field>
          <Field label="Stop loss" htmlFor="pc-stop" hint="Below entry = long, above = short.">
            <Input id="pc-stop" inputMode="decimal" value={v.stop} onChange={set("stop")} />
          </Field>
          <Field label="Target (optional)" htmlFor="pc-target">
            <Input id="pc-target" inputMode="decimal" value={v.target} onChange={set("target")} />
          </Field>
          <Field label="Multiplier" htmlFor="pc-mult" hint="Value of a 1.0 move per unit (50 for ES).">
            <Input id="pc-mult" inputMode="decimal" value={v.multiplier} onChange={set("multiplier")} />
          </Field>
          <Field label="Size step" htmlFor="pc-step" hint="Smallest tradable size: 1 share, 0.01 lots, 1000 units…">
            <Input id="pc-step" inputMode="decimal" value={v.step} onChange={set("step")} />
          </Field>
        </div>
      </Card>

      <Card className="h-fit lg:sticky lg:top-8">
        <CardTitle>Position size</CardTitle>
        {!result ? (
          <p className="text-sm text-navy-300">Enter an entry and a stop loss.</p>
        ) : !result.ok ? (
          <p className="text-sm text-loss">{result.error}</p>
        ) : (
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-navy-400">{result.direction === "LONG" ? "Buy" : "Sell short"}</dt>
              <dd className="num text-3xl font-semibold text-white">{result.quantity.toString()}</dd>
            </div>
            <div className="flex justify-between"><dt className="text-navy-400">Risk budget</dt><dd className="num text-white">{money(result.riskBudget, currency)}</dd></div>
            <div className="flex justify-between"><dt className="text-navy-400">Risk at this size</dt><dd className={cn("num", overMax ? "text-loss" : "text-white")}>{money(result.actualRisk, currency)}</dd></div>
            <div className="flex justify-between"><dt className="text-navy-400">Risk per unit</dt><dd className="num text-white">{money(result.riskPerUnit, currency)}</dd></div>
            <div className="flex justify-between"><dt className="text-navy-400">Position value</dt><dd className="num text-white">{money(result.positionValue, currency)}</dd></div>
            {result.reward && (
              <>
                <div className="flex justify-between"><dt className="text-navy-400">Reward at target</dt><dd className="num text-profit">{money(result.reward, currency, { signed: true })}</dd></div>
                <div className="flex justify-between"><dt className="text-navy-400">Reward : risk</dt><dd className="num text-white">{ratio(result.rewardRisk!.toNumber())} : 1</dd></div>
              </>
            )}
            {overMax && (
              <p className="rounded-lg border border-loss/40 bg-loss/10 p-2 text-xs text-loss">
                Above this account&apos;s max risk per trade ({money(account!.maxRiskPerTrade, currency)}).
              </p>
            )}
            <p className="text-xs text-navy-400">Size is rounded down so the loss at your stop never exceeds the budget. Excludes fees and slippage.</p>
          </dl>
        )}
      </Card>
    </div>
  );
}
