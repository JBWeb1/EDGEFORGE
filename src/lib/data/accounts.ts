import "server-only";
import { prisma } from "@/lib/db";

export function listAccounts(userId: string) {
  return prisma.tradingAccount.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { trades: true } } },
  });
}

export function getAccount(userId: string, id: string) {
  return prisma.tradingAccount.findFirst({ where: { id, userId } });
}
