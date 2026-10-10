"use client";

import { useState, useSyncExternalStore } from "react";
import { Input } from "@/components/ui";

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const noopSubscribe = () => () => {};

/**
 * A datetime-local picker in the viewer's time zone that submits an
 * unambiguous UTC ISO timestamp under `name`.
 */
export function DateTimeInput({
  id,
  name,
  defaultValue,
  required,
}: {
  id: string;
  name: string;
  defaultValue?: string | null;
  required?: boolean;
}) {
  // The server can't know the viewer's time zone, so the picker is filled on the client.
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  // Controlled: for a hidden input, React's defaultValue *is* its value, so an
  // uncontrolled one would be overwritten on every re-render.
  const [iso, setIso] = useState(defaultValue ?? "");

  return (
    <>
      <Input
        key={isClient ? "client" : "server"}
        id={id}
        type="datetime-local"
        required={required}
        defaultValue={isClient && defaultValue ? toLocalInput(defaultValue) : ""}
        onChange={(e) => {
          setIso(e.target.value ? new Date(e.target.value).toISOString() : "");
        }}
      />
      <input type="hidden" name={name} value={iso} />
    </>
  );
}
