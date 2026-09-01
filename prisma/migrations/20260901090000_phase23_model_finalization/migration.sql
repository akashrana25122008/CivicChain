-- Phase 23 — Database Model Finalization
--
-- 1. First-class Department model (normalizes the former free-text
--    `Authority.department` string).
-- 2. Rename the append-only audit table AuditLog -> AuditEvent (data
--    preserved: ALTER TABLE RENAME keeps all 103 rows, the hash-chain
--    columns, and the unique seq/prevHash integrity guarantees).
-- 3. denormalized `departmentId` on Issue and Promise (hot lookup avoids a
--    join through Authority), consistent with the roadmap's direct
--    Issue/Incident/Promise <-> Department relations.
-- 4. DB-level CHECK constraints that back up application invariants.

-- ---------------------------------------------------------------------------
-- 1. Rename AuditLog -> AuditEvent (data-preserving)
-- ---------------------------------------------------------------------------

ALTER TABLE "AuditLog" RENAME TO "AuditEvent";

ALTER INDEX "AuditLog_pkey" RENAME TO "AuditEvent_pkey";
ALTER INDEX "AuditLog_actorId_idx" RENAME TO "AuditEvent_actorId_idx";
ALTER INDEX "AuditLog_issueId_idx" RENAME TO "AuditEvent_issueId_idx";
ALTER INDEX "AuditLog_action_idx" RENAME TO "AuditEvent_action_idx";
ALTER INDEX "AuditLog_entityType_entityId_idx" RENAME TO "AuditEvent_entityType_entityId_idx";
ALTER INDEX "AuditLog_createdAt_idx" RENAME TO "AuditEvent_createdAt_idx";
ALTER INDEX "AuditLog_seq_key" RENAME TO "AuditEvent_seq_key";
ALTER INDEX "AuditLog_prevHash_key" RENAME TO "AuditEvent_prevHash_key";

ALTER TABLE "AuditEvent" RENAME CONSTRAINT "AuditLog_actorId_fkey" TO "AuditEvent_actorId_fkey";
ALTER TABLE "AuditEvent" RENAME CONSTRAINT "AuditLog_issueId_fkey" TO "AuditEvent_issueId_fkey";

-- ---------------------------------------------------------------------------
-- 2. Department table
-- ---------------------------------------------------------------------------

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jurisdiction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE INDEX "Department_name_idx" ON "Department"("name");

-- ---------------------------------------------------------------------------
-- 3. Authority: department string -> departmentId FK
-- ---------------------------------------------------------------------------

-- Add the nullable FK column first.
ALTER TABLE "Authority" ADD COLUMN "departmentId" TEXT;

-- Back-fill Departments from the existing free-text `department` values
-- (currently 5 distinct names). Each unique name becomes one Department.
INSERT INTO "Department" ("id", "name", "jurisdiction", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text,
       "department",
       NULL,
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
FROM "Authority"
WHERE "department" IS NOT NULL
ON CONFLICT ("name") DO NOTHING;

-- Point each Authority at its Department by name.
UPDATE "Authority" a
SET "departmentId" = d."id"
FROM "Department" d
WHERE d."name" = a."department";

-- Add FK + index, then drop the now-redundant free-text column. Dropping the
-- column automatically drops its index (Authority_department_idx), so no
-- explicit DROP INDEX is needed here.
ALTER TABLE "Authority"
    ADD CONSTRAINT "Authority_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Authority_departmentId_idx" ON "Authority"("departmentId");

ALTER TABLE "Authority" DROP COLUMN "department";

-- ---------------------------------------------------------------------------
-- 4. Issue.departmentId (denormalized, back-filled from its Authority)
-- ---------------------------------------------------------------------------

ALTER TABLE "Issue" ADD COLUMN "departmentId" TEXT;

UPDATE "Issue" i
SET "departmentId" = a."departmentId"
FROM "Authority" a
WHERE a."id" = i."authorityId";

ALTER TABLE "Issue"
    ADD CONSTRAINT "Issue_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Issue_departmentId_idx" ON "Issue"("departmentId");

-- ---------------------------------------------------------------------------
-- 5. Promise.departmentId (denormalized, back-filled from its Authority)
-- ---------------------------------------------------------------------------

ALTER TABLE "Promise" ADD COLUMN "departmentId" TEXT;

UPDATE "Promise" p
SET "departmentId" = a."departmentId"
FROM "Authority" a
WHERE a."id" = p."authorityId";

ALTER TABLE "Promise"
    ADD CONSTRAINT "Promise_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Promise_departmentId_idx" ON "Promise"("departmentId");

-- ---------------------------------------------------------------------------
-- 6. DB-level CHECK constraints (back up application invariants)
-- ---------------------------------------------------------------------------

-- Issue.priority is a 0-100 engine score.
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_priority_range"
    CHECK ("priority" IS NULL OR ("priority" >= 0 AND "priority" <= 100));

-- Issue.latitude / longitude bounds (WGS84).
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_latitude_range"
    CHECK ("latitude" IS NULL OR ("latitude" >= -90 AND "latitude" <= 90));
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_longitude_range"
    CHECK ("longitude" IS NULL OR ("longitude" >= -180 AND "longitude" <= 180));

-- AIAnalysis.confidence is a 0..1 model confidence.
ALTER TABLE "AIAnalysis" ADD CONSTRAINT "AIAnalysis_confidence_range"
    CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1));

-- Escalation.level is the 1-4 ladder step (see EscalationLevel enum).
ALTER TABLE "Escalation" ADD CONSTRAINT "Escalation_level_range"
    CHECK ("level" >= 1 AND "level" <= 4);

-- AuditEvent.seq is a strictly positive chain position.
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_seq_positive"
    CHECK ("seq" > 0);