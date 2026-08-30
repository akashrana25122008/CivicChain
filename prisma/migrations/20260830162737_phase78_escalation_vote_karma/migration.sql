-- CreateEnum
CREATE TYPE "EscalationLevel" AS ENUM ('LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'LEVEL_4');

-- CreateEnum
CREATE TYPE "VoteType" AS ENUM ('CONFIRM', 'DISPUTE', 'SUPPORT', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "KarmaEventType" AS ENUM ('REPORT_VERIFIED', 'EVIDENCE_VERIFIED', 'HELPFUL_CONFIRMATION', 'VALID_DUPLICATE', 'FALSE_REPORT', 'ABUSIVE_VOTE');

-- CreateTable
CREATE TABLE "EscalationRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "fromLevel" INTEGER NOT NULL DEFAULT 0,
    "targetLevel" INTEGER NOT NULL DEFAULT 1,
    "minSeverity" "Severity",
    "minPriority" INTEGER,
    "conditions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EscalationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KarmaEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "KarmaEventType" NOT NULL,
    "points" INTEGER NOT NULL,
    "issueId" TEXT,
    "dedupeKey" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KarmaEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EscalationRule_enabled_priority_idx" ON "EscalationRule"("enabled", "priority");

-- CreateIndex
CREATE INDEX "Vote_issueId_idx" ON "Vote"("issueId");

-- CreateIndex
CREATE INDEX "Vote_userId_idx" ON "Vote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_issueId_userId_type_key" ON "Vote"("issueId", "userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "KarmaEvent_dedupeKey_key" ON "KarmaEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "KarmaEvent_userId_idx" ON "KarmaEvent"("userId");

-- CreateIndex
CREATE INDEX "KarmaEvent_issueId_idx" ON "KarmaEvent"("issueId");

-- CreateIndex
CREATE INDEX "KarmaEvent_type_idx" ON "KarmaEvent"("type");

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KarmaEvent" ADD CONSTRAINT "KarmaEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KarmaEvent" ADD CONSTRAINT "KarmaEvent_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
