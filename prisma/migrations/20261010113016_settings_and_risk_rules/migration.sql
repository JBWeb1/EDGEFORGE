-- AlterTable
ALTER TABLE "trading_account" ADD COLUMN     "dailyLossLimit" DECIMAL(20,2),
ADD COLUMN     "maxRiskPerTrade" DECIMAL(20,2),
ADD COLUMN     "maxTradesPerDay" INTEGER;

-- CreateTable
CREATE TABLE "user_settings" (
    "userId" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'UTC',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
