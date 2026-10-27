-- AlterTable
ALTER TABLE "trade" ADD COLUMN     "maePrice" DECIMAL(24,8),
ADD COLUMN     "mfePrice" DECIMAL(24,8),
ADD COLUMN     "playbookId" TEXT;

-- CreateTable
CREATE TABLE "playbook" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playbook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playbook_rule" (
    "id" TEXT NOT NULL,
    "playbookId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "playbook_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PlaybookRuleToTrade" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PlaybookRuleToTrade_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "playbook_userId_name_key" ON "playbook"("userId", "name");

-- CreateIndex
CREATE INDEX "playbook_rule_playbookId_idx" ON "playbook_rule"("playbookId");

-- CreateIndex
CREATE INDEX "_PlaybookRuleToTrade_B_index" ON "_PlaybookRuleToTrade"("B");

-- AddForeignKey
ALTER TABLE "trade" ADD CONSTRAINT "trade_playbookId_fkey" FOREIGN KEY ("playbookId") REFERENCES "playbook"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playbook" ADD CONSTRAINT "playbook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playbook_rule" ADD CONSTRAINT "playbook_rule_playbookId_fkey" FOREIGN KEY ("playbookId") REFERENCES "playbook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PlaybookRuleToTrade" ADD CONSTRAINT "_PlaybookRuleToTrade_A_fkey" FOREIGN KEY ("A") REFERENCES "playbook_rule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PlaybookRuleToTrade" ADD CONSTRAINT "_PlaybookRuleToTrade_B_fkey" FOREIGN KEY ("B") REFERENCES "trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
