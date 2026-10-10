import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

type Client = Prisma.TransactionClient | typeof prisma;

/** Records that this user's journal data changed, so open tabs refresh. */
export async function bumpDataVersion(userId: string, client: Client = prisma) {
  await client.syncState.upsert({
    where: { userId },
    create: { userId, version: 1 },
    update: { version: { increment: 1 } },
  });
}

export async function getDataVersion(userId: string): Promise<number> {
  const state = await prisma.syncState.findUnique({ where: { userId }, select: { version: true } });
  return state?.version ?? 0;
}
