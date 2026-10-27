"use client";

import { useState, type ReactNode } from "react";
import { Button, Card } from "@/components/ui";
import { deletePlaybook } from "./actions";
import { PlaybookForm } from "./playbook-form";

type Props = {
  playbook: { id: string; name: string; description: string | null; rules: string[] };
  stats: ReactNode;
};

export function PlaybookCard({ playbook, stats }: Props) {
  const [editing, setEditing] = useState(false);
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-white">{playbook.name}</h2>
          {playbook.description && <p className="mt-1 text-sm text-navy-300">{playbook.description}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditing((e) => !e)}>{editing ? "Close" : "Edit"}</Button>
          <form
            action={deletePlaybook}
            onSubmit={(e) => {
              if (!confirm(`Delete the "${playbook.name}" playbook? Its trades stay in your journal but lose their grade.`)) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={playbook.id} />
            <Button variant="danger" type="submit">Delete</Button>
          </form>
        </div>
      </div>
      {editing ? (
        <PlaybookForm playbook={playbook} onDone={() => setEditing(false)} />
      ) : (
        <>
          <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-navy-200">
            {playbook.rules.map((r) => <li key={r}>{r}</li>)}
          </ol>
          {stats}
        </>
      )}
    </Card>
  );
}
