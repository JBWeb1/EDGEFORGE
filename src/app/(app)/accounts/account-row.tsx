"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { money } from "@/lib/format";
import { AccountForm } from "./account-form";
import { deleteAccount } from "./actions";

type Props = {
  account: {
    id: string;
    name: string;
    broker: string | null;
    currency: string;
    startingBalance: string;
    trades: number;
    dailyLossLimit: string | null;
    maxTradesPerDay: number | null;
    maxRiskPerTrade: string | null;
  };
};

export function AccountRow({ account }: Props) {
  const [editing, setEditing] = useState(false);
  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium text-white">{account.name}</p>
          <p className="text-xs text-navy-400">
            {[
              account.broker,
              account.currency,
              `start ${money(account.startingBalance, account.currency)}`,
              `${account.trades} trades`,
              account.dailyLossLimit && `daily loss limit ${money(account.dailyLossLimit, account.currency)}`,
              account.maxTradesPerDay && `max ${account.maxTradesPerDay} trades/day`,
              account.maxRiskPerTrade && `max risk ${money(account.maxRiskPerTrade, account.currency)}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditing((e) => !e)}>{editing ? "Close" : "Edit"}</Button>
          <form
            action={deleteAccount}
            onSubmit={(e) => {
              if (!confirm(`Delete "${account.name}" and all ${account.trades} of its trades? This cannot be undone.`)) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={account.id} />
            <Button variant="danger" type="submit">Delete</Button>
          </form>
        </div>
      </div>
      {editing && (
        <div className="mt-4 rounded-lg border border-navy-700 bg-navy-900/60 p-4">
          <AccountForm account={account} onDone={() => setEditing(false)} />
        </div>
      )}
    </li>
  );
}
