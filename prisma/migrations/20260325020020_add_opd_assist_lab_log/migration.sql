-- CreateTable
CREATE TABLE "OpdAssistLabLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "caseId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'analyze',
    "demoKey" TEXT,
    "mode" TEXT,
    "modeOverride" TEXT,
    "textLength" INTEGER NOT NULL,
    "textPreview" TEXT,
    "ok" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "cardIds" TEXT,
    "ruleVersion" TEXT,

    CONSTRAINT "OpdAssistLabLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpdAssistLabLog_userId_createdAt_idx" ON "OpdAssistLabLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "OpdAssistLabLog_createdAt_idx" ON "OpdAssistLabLog"("createdAt");

-- AddForeignKey
ALTER TABLE "OpdAssistLabLog" ADD CONSTRAINT "OpdAssistLabLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
