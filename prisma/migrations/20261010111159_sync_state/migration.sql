-- CreateTable
CREATE TABLE "sync_state" (
    "userId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_state_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "sync_state" ADD CONSTRAINT "sync_state_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
