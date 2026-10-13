import { prisma } from "@/lib/db";
import { TAG_SELECT, toTradeInput } from "@/lib/data/trades";
import { tradesToCsv } from "@/lib/export";
import { getCurrentUser } from "@/lib/session";

/** Downloads the signed-in user's trades as CSV. Optional ?account=<id>. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const accountId = new URL(request.url).searchParams.get("account") || undefined;

  const trades = await prisma.trade.findMany({
    where: { userId: user.id, ...(accountId ? { accountId } : {}) },
    orderBy: [{ entryAt: "asc" }, { id: "asc" }],
    include: { account: { select: { name: true, currency: true } }, tags: TAG_SELECT },
  });
  const csv = tradesToCsv(
    trades.map((t) => ({
      ...toTradeInput(t),
      accountName: t.account.name,
      currency: t.account.currency,
      notes: t.notes,
      emotion: t.emotion,
      followedRules: t.followedRules,
    })),
  );
  const date = new Date().toISOString().slice(0, 10);
  return new Response(`﻿${csv}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="edgeforge-trades-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
