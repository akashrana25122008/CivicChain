-- Phase 18 — Audit/Trust Ledger
-- Turns the plain AuditLog into an append-only, tamper-evident hash chain.
--
-- New columns:
--   seq      Int     monotonic chain position (first record = 1)
--   prevHash String  SHA-256 of the immediately-preceding record's `hash`;
--                    null only for the genesis record
--   hash     String  SHA-256 of this record's canonical payload, which embeds
--                    prevHash so any edit to earlier history breaks every
--                    downstream link
--
-- Integrity guarantees:
--   - UNIQUE(seq)      : a chain position can be claimed once.
--   - UNIQUE(prevHash) : two records can never name the same predecessor, so a
--                        concurrent fork is rejected by the database rather
--                        than silently creating two "next" links.
--
-- Existing rows are back-filled in order (oldest -> newest) producing a
-- self-consistent chain. Back-fill and application writes share ONE canonical
-- hashing format (see src/lib/ledger/hashchain.ts) so the whole ledger — old
-- and new — verifies with a single algorithm:
--
--   canonicalJSON({ createdAt: <epoch ms number>,
--                   action: <string>,
--                   entityType: <string>,
--                   entityId: <string|null>,
--                   prevHash: <string|null> })
--   hash = sha256hex(canonicalJSON)

-- AlterTable
ALTER TABLE "AuditLog"
    ADD COLUMN "seq"      INTEGER,
    ADD COLUMN "prevHash" TEXT,
    ADD COLUMN "hash"     TEXT;

-- Back-fill a valid chain over the existing rows, ordered by creation time
-- (stable tie-break on id). createdAt is canonicalized as epoch milliseconds
-- (integer), matching Date.prototype.getTime() used by the application.
-- Controlled enum/entity-type strings never contain double quotes, so the
-- inline JSON emitter is exact for them; escaping guards accidental outliers.
CREATE OR REPLACE FUNCTION fn_cc_ledger_backfill()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  r RECORD;
  v_seq        INTEGER := 0;
  v_prevHash   TEXT    := NULL;
  v_created    BIGINT;
  v_canonical  TEXT;
  v_hash       TEXT;
BEGIN
  FOR r IN
    SELECT "id", "action", "entityType", "entityId", "createdAt"
    FROM "AuditLog"
    ORDER BY "createdAt" ASC, "id" ASC
  LOOP
    v_seq        := v_seq + 1;
    v_created    := floor(extract(epoch FROM r."createdAt") * 1000)::BIGINT;
    v_canonical  := '{"createdAt":'||v_created::TEXT||
      ',"action":"'||replace(replace(r."action"::text,'\','\\'),'"','\"')||
      '","entityType":"'||replace(replace(r."entityType",'\','\\'),'"','\"')||
      '","entityId":'||COALESCE(to_json(r."entityId"),'null')||
      ',"prevHash":'||COALESCE(to_json(v_prevHash),'null')||'}';
    v_hash       := encode(sha256(v_canonical::bytea), 'hex');
    UPDATE "AuditLog"
       SET "seq" = v_seq, "prevHash" = v_prevHash, "hash" = v_hash
     WHERE "id" = r."id";
    v_prevHash   := v_hash;
  END LOOP;
END $$;

SELECT fn_cc_ledger_backfill();
DROP FUNCTION fn_cc_ledger_backfill();

-- Not-null now that every row is either genesis (prevHash null) or chained.
ALTER TABLE "AuditLog"
    ALTER COLUMN "seq" SET NOT NULL,
    ALTER COLUMN "hash" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "AuditLog_seq_key" ON "AuditLog"("seq");
CREATE UNIQUE INDEX "AuditLog_prevHash_key" ON "AuditLog"("prevHash");
