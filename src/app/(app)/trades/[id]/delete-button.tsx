"use client";

import type { ReactNode } from "react";

export function DeleteTradeButton({ id, action, children }: { id: string; action: (fd: FormData) => Promise<void>; children: ReactNode }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Delete this trade? This cannot be undone.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      {children}
    </form>
  );
}
