"use client";

/** Renders a timestamp in the viewer's own time zone. */
export function LocalTime({ value, dateOnly = false }: { value: string | Date | null; dateOnly?: boolean }) {
  if (!value) return <span>—</span>;
  const d = new Date(value);
  const text = d.toLocaleString(undefined, dateOnly
    ? { year: "numeric", month: "short", day: "numeric" }
    : { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  return (
    <time dateTime={d.toISOString()} suppressHydrationWarning>
      {text}
    </time>
  );
}
