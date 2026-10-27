/**
 * Creates (or resets) a demo account filled with the sample trades, a
 * playbook, risk rules and a journal entry, so the app can be explored
 * straight away.
 *
 *   npm run seed:demo        # login: demo@edgeforge.local / edgeforge-demo
 *
 * Only ever touches the demo user. Refuses to run in production unless
 * ALLOW_DEMO_SEED=1 is set.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import { parseTradeCsv } from "../src/lib/import/csv";

export const DEMO_EMAIL = "demo@edgeforge.local";
export const DEMO_PASSWORD = "edgeforge-demo";

const RULES = [
  "Price breaks the first 15-minute range",
  "Volume above the 20-day average",
  "Stop below the range on the other side",
  "Risk 1% of the account or less",
  "Target at least 2R",
];
const EMOTIONS = ["CALM", "CONFIDENT", "FOMO", "CALM", "FRUSTRATED", "CALM", "REVENGE", "CONFIDENT"] as const;

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "1") {
    throw new Error("Refusing to seed demo data in production. Set ALLOW_DEMO_SEED=1 to override.");
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } }); // cascades to all demo data

    const userId = randomUUID();
    await prisma.user.create({
      data: {
        id: userId,
        name: "Demo Trader",
        email: DEMO_EMAIL,
        emailVerified: true,
        accounts: {
          create: { id: randomUUID(), accountId: userId, providerId: "credential", password: await hashPassword(DEMO_PASSWORD) },
        },
        settings: { create: { timeZone: "UTC" } },
      },
    });

    const account = await prisma.tradingAccount.create({
      data: {
        userId,
        name: "Demo account",
        broker: "Paper trading",
        currency: "USD",
        startingBalance: "25000",
        dailyLossLimit: "600",
        maxTradesPerDay: 3,
        maxRiskPerTrade: "1000",
      },
    });

    const playbook = await prisma.playbook.create({
      data: {
        userId,
        name: "Opening range breakout",
        description: "Trade the break of the first 15 minutes on above-average volume.",
        rules: { create: RULES.map((text, order) => ({ text, order })) },
      },
      include: { rules: { orderBy: { order: "asc" } } },
    });

    const parsed = parseTradeCsv(readFileSync(new URL("../samples/sample-trades.csv", import.meta.url), "utf8"));
    let i = 0;
    for (const row of parsed.rows) {
      if (!row.ok) continue;
      i += 1;
      const { tags, ...t } = row.trade;
      void tags;
      const isOrb = t.setup === "Opening range breakout";
      // Deterministic variety: winners tend to meet more rules than losers.
      const won = t.exitPrice !== null && (t.direction === "LONG" ? +t.exitPrice > +t.entryPrice : +t.exitPrice < +t.entryPrice);
      const rulesMet = isOrb ? playbook.rules.slice(0, won ? 5 - (i % 2) : 2 + (i % 3)).map((r) => ({ id: r.id })) : [];
      await prisma.trade.create({
        data: {
          ...t,
          userId,
          accountId: account.id,
          emotion: EMOTIONS[i % EMOTIONS.length],
          followedRules: won ? i % 5 !== 0 : i % 3 === 0,
          confidence: (i % 5) + 1,
          playbookId: isOrb ? playbook.id : null,
          rulesMet: { connect: rulesMet },
          tags: i % 4 === 0
            ? { connectOrCreate: [{ where: { userId_name: { userId, name: "news" } }, create: { userId, name: "news" } }] }
            : undefined,
        },
      });
    }

    await prisma.dailyNote.create({
      data: {
        userId,
        date: "2026-08-12",
        premarket: "Bias long above VWAP. Only A+ breakouts; max 3 trades.",
        review: "Followed the plan on the first trade, chased the second. Wait for the retest.",
        mood: 4,
      },
    });

    console.log(`Demo ready: ${i} trades. Sign in with ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
