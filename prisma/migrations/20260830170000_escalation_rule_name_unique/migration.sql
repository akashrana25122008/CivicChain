-- Add a unique constraint on EscalationRule.name so rule configuration can be
-- upserted idempotently by name (Phase 7 seeded ladder).
ALTER TABLE "EscalationRule" ADD CONSTRAINT "EscalationRule_name_key" UNIQUE ("name");
