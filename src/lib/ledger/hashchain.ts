import { createHash } from 'node:crypto';

/**
 * Phase 18 — Audit/Trust Ledger pure helpers.
 *
 * The AuditLog is an append-only, tamper-evident hash chain. Each row stores:
 *   - `seq`:        monotonic chain position (genesis = 1)
 *   - `prevHash`:   the `hash` of the immediately-preceding row (null only for
 *                   genesis)
 *   - `hash`:       SHA-256 over this row's canonical payload, which embeds
 *                   `prevHash`, so rewriting any earlier history breaks every
 *                   downstream link.
 *
 * Canonical hash format (single source of truth, shared with the SQL
 * back-fill migration so old + new records verify identically):
 *
 *   canonicalJSON({ createdAt: <epoch ms number>,
 *                   action, entityType, entityId, prevHash })
 *   hash = sha256hex(canonicalJSON)
 *
 * `createdAt` is canonicalized as integer epoch milliseconds so the SQL
 * back-fill (extract(epoch)*1000) and the runtime (Date#getTime) agree.
 */

export interface LedgerPayload {
  createdAt: number | Date | string;
  action: string;
  entityType: string;
  entityId?: string | null;
  prevHash?: string | null;
}

export interface LedgerRow {
  seq: number;
  prevHash: string | null;
  hash: string;
  createdAt: Date | number | string;
  action: string;
  entityType: string;
  entityId?: string | null;
}

function toEpochMs(value: number | Date | string): number {
  if (value instanceof Date) return Math.floor(value.getTime());
  if (typeof value === 'number') return Math.floor(value);
  return Math.floor(new Date(value).getTime());
}

/** Deterministic compact JSON — key order fixed, no spaces. */
export function canonicalLedgerJson(input: LedgerPayload): string {
  return JSON.stringify({
    createdAt: toEpochMs(input.createdAt),
    action: String(input.action),
    entityType: String(input.entityType),
    entityId: input.entityId ?? null,
    prevHash: input.prevHash ?? null,
  });
}

/** SHA-256 (hex) of a single row's canonical payload. */
export function computeLedgerHash(input: LedgerPayload): string {
  return createHash('sha256').update(canonicalLedgerJson(input)).digest('hex');
}

export interface LedgerEntryCheck {
  seq: number;
  prevOk: boolean;
  hashOk: boolean;
  prevHash: string | null;
  expectedPrevHash: string | null;
  actualHash: string;
  expectedHash: string;
}

export interface LedgerVerification {
  valid: boolean;
  count: number;
  genesisOk: boolean;
  gaps: number; // seq discontinuities
  tampered: number; // rows whose stored hash != recomputed hash
  brokenLinks: number; // rows whose prevHash != predecessor hash
  firstInvalidSeq: number | null;
  checks: LedgerEntryCheck[];
}

/**
 * Verify an ordered (by seq asc) slice of the ledger. Each row's stored hash
 * must equal its recomputed hash, and each row's prevHash must equal the
 * previous row's hash. A gap in seq is reported but does not, by itself, prove
 * tampering — it signals missing context (paged verification).
 */
export function verifyLedgerChain(rows: LedgerRow[]): LedgerVerification {
  const sorted = [...rows].sort((a, b) => a.seq - b.seq);
  const checks: LedgerEntryCheck[] = [];
  let tampered = 0;
  let brokenLinks = 0;
  let gaps = 0;
  let firstInvalidSeq: number | null = null;

  sorted.forEach((row, idx) => {
    const expectedHash = computeLedgerHash({
      createdAt: row.createdAt,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      prevHash: row.prevHash,
    });
    const hashOk = row.hash === expectedHash;

    let expectedPrevHash: string | null = null;
    let prevOk = true;
    if (row.seq === 1) {
      prevOk = row.prevHash == null;
    } else if (idx > 0) {
      expectedPrevHash = sorted[idx - 1].hash;
      prevOk = row.prevHash === expectedPrevHash;
      if (row.seq !== sorted[idx - 1].seq + 1) gaps += 1;
    } else if (idx === 0 && row.seq !== 1) {
      // Slice starts mid-chain: cannot judge the link to its unseen
      // predecessor — mark the link as unconsumed but not failed.
      prevOk = true;
    }

    if (!hashOk) tampered += 1;
    if (!prevOk && row.seq !== 1) brokenLinks += 1;

    const invalid = !hashOk || (row.seq !== 1 && !prevOk) || (row.seq === 1 && !prevOk);
    if (invalid && firstInvalidSeq === null) firstInvalidSeq = row.seq;

    checks.push({
      seq: row.seq,
      prevOk,
      hashOk,
      prevHash: row.prevHash,
      expectedPrevHash,
      actualHash: row.hash,
      expectedHash,
    });
  });

  const genesisOk = sorted.every((r) => r.seq !== 1 || r.prevHash == null);
  const valid =
    genesisOk &&
    tampered === 0 &&
    brokenLinks === 0 &&
    (gaps === 0 || sorted.length === 0);

  return {
    valid,
    count: sorted.length,
    genesisOk,
    gaps,
    tampered,
    brokenLinks,
    firstInvalidSeq,
    checks,
  };
}
