-- Phase 23 remainder (manual completion of the partially-applied migration
-- 20260901090000_phase23_model_finalization)

ALTER TABLE "Issue" ADD COLUMN "departmentId" TEXT;

UPDATE "Issue" i
SET "departmentId" = a."departmentId"
FROM "Authority" a
WHERE a."id" = i."authorityId";

ALTER TABLE "Issue"
    ADD CONSTRAINT "Issue_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Issue_departmentId_idx" ON "Issue"("departmentId");

ALTER TABLE "Promise" ADD COLUMN "departmentId" TEXT;

UPDATE "Promise" p
SET "departmentId" = a."departmentId"
FROM "Authority" a
WHERE a."id" = p."authorityId";

ALTER TABLE "Promise"
    ADD CONSTRAINT "Promise_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Promise_departmentId_idx" ON "Promise"("departmentId");

ALTER TABLE "Issue" ADD CONSTRAINT "Issue_priority_range"
    CHECK ("priority" IS NULL OR ("priority" >= 0 AND "priority" <= 100));

ALTER TABLE "Issue" ADD CONSTRAINT "Issue_latitude_range"
    CHECK ("latitude" IS NULL OR ("latitude" >= -90 AND "latitude" <= 90));
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_longitude_range"
    CHECK ("longitude" IS NULL OR ("longitude" >= -180 AND "longitude" <= 180));

ALTER TABLE "AIAnalysis" ADD CONSTRAINT "AIAnalysis_confidence_range"
    CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1));

ALTER TABLE "Escalation" ADD CONSTRAINT "Escalation_level_range"
    CHECK ("level" >= 1 AND "level" <= 4);

ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_seq_positive"
    CHECK ("seq" > 0);