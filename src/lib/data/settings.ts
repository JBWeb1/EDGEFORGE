import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { isValidTimeZone } from "@/lib/analytics/timezone";

export type Settings = { timeZone: string };

/** The user's settings, with defaults. Deduplicated per request. */
export const getSettings = cache(async (userId: string): Promise<Settings> => {
  const row = await prisma.userSettings.findUnique({ where: { userId } });
  const timeZone = row && isValidTimeZone(row.timeZone) ? row.timeZone : "UTC";
  return { timeZone };
});
