/**
 * Time-zone helpers built on Intl (no dependencies). A "trading day" is the
 * calendar day in the trader's own time zone.
 */

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string) {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export type ZonedParts = {
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday. */
  weekday: number;
};

export function zonedParts(d: Date, timeZone = "UTC"): ZonedParts {
  const parts: Record<string, string> = {};
  for (const p of formatter(timeZone).formatToParts(d)) parts[p.type] = p.value;
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    year,
    month,
    day,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAY_INDEX[parts.weekday],
  };
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Offset of `timeZone` from UTC at instant `d`, in minutes (e.g. +120 for UTC+2). */
export function offsetMinutes(d: Date, timeZone: string): number {
  const p = zonedParts(d, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(d.getTime() / 1000) * 1000) / 60_000);
}

/**
 * Converts a wall-clock time in `timeZone` to the UTC instant. For times that
 * occur twice (DST fall-back) the earlier one is used; for times skipped by a
 * DST jump the result moves forward by the gap.
 */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0,
  timeZone = "UTC",
): Date {
  const wall = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  // Two passes settle the offset around DST transitions.
  let guess = wall - offsetMinutes(new Date(wall), timeZone) * 60_000;
  guess = wall - offsetMinutes(new Date(guess), timeZone) * 60_000;
  const before = wall - offsetMinutes(new Date(guess - 3 * 3_600_000), timeZone) * 60_000;
  const after = wall - offsetMinutes(new Date(guess + 3 * 3_600_000), timeZone) * 60_000;
  const matches = [before, after, guess].filter((t) => zonedParts(new Date(t), timeZone).hour === hour);
  // Ambiguous: earliest match. Skipped (no match): the later candidate, i.e. forward by the gap.
  return new Date(matches.length ? Math.min(...matches) : Math.max(before, after));
}

/** Start of the local day containing `d`, as a UTC instant. */
export function startOfZonedDay(d: Date, timeZone = "UTC"): Date {
  const p = zonedParts(d, timeZone);
  return zonedTimeToUtc(p.year, p.month, p.day, 0, 0, 0, 0, timeZone);
}
