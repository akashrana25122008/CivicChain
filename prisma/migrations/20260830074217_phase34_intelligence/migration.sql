-- Phase 4 — text similarity is computed server-side in TypeScript (trigram
-- overlap over the geographically/time-bounded candidate set), so no pg_trigram
-- extension is required. geoLocation already has GIST "issue_geoLocation_idx".

-- CreateEnum
CREATE TYPE "AICategory" AS ENUM ('ROAD_DAMAGE', 'STREET_LIGHT', 'GARBAGE', 'WATER_LEAKAGE', 'DRAINAGE', 'TRAFFIC_SIGNAL', 'PUBLIC_INFRASTRUCTURE', 'OTHER');

-- CreateEnum
CREATE TYPE "AISeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SafetyRisk" AS ENUM ('NONE', 'LOW', 'MODERATE', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "InfrastructureType" AS ENUM ('ROAD', 'SIDEWALK', 'BRIDGE', 'STREET_LIGHT', 'TRAFFIC_SIGNAL', 'DRAINAGE_SYSTEM', 'WATER_SUPPLY', 'PUBLIC_BUILDING', 'PARK', 'NONE', 'OTHER');

-- CreateEnum
CREATE TYPE "AIAnalysisStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PriorityLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'AI_ANALYSIS_COMPLETED';
ALTER TYPE "AuditAction" ADD VALUE 'AI_ANALYSIS_FAILED';
ALTER TYPE "AuditAction" ADD VALUE 'INCIDENT_ASSIGNED';

-- AlterTable
ALTER TABLE "Evidence" ADD COLUMN     "perceptualHash" TEXT;

-- AlterTable
ALTER TABLE "Issue" ADD COLUMN     "incidentId" TEXT,
ADD COLUMN     "incidentMatch" JSONB,
ADD COLUMN     "priorityLevel" "PriorityLevel";

-- CreateTable
CREATE TABLE "AIAnalysis" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "status" "AIAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "category" "AICategory",
    "severity" "AISeverity",
    "confidence" DOUBLE PRECISION,
    "safetyRisk" "SafetyRisk",
    "infrastructureType" "InfrastructureType",
    "reasoningSummary" TEXT,
    "modelName" TEXT,
    "modelVersion" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "IssueCategory" NOT NULL,
    "status" "IssueStatus" NOT NULL DEFAULT 'SUBMITTED',
    "severity" "Severity",
    "priority" INTEGER,
    "priorityLevel" "PriorityLevel",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AIAnalysis_issueId_key" ON "AIAnalysis"("issueId");

-- CreateIndex
CREATE INDEX "AIAnalysis_status_idx" ON "AIAnalysis"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Incident_publicId_key" ON "Incident"("publicId");

-- CreateIndex
CREATE INDEX "Incident_status_idx" ON "Incident"("status");

-- CreateIndex
CREATE INDEX "Incident_category_idx" ON "Incident"("category");

-- CreateIndex
CREATE INDEX "Incident_priorityLevel_idx" ON "Incident"("priorityLevel");

-- CreateIndex
CREATE INDEX "Issue_incidentId_idx" ON "Issue"("incidentId");

-- CreateIndex
CREATE INDEX "Issue_priority_idx" ON "Issue"("priority");

-- CreateIndex
CREATE INDEX "Issue_priorityLevel_idx" ON "Issue"("priorityLevel");

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAnalysis" ADD CONSTRAINT "AIAnalysis_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
