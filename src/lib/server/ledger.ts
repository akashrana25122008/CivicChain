import type { AuditAction, Prisma } from '../../../generated/prisma/client';
import { prisma } from '@/lib/db';
import {
  computeLedgerHash,
  verifyLedgerChain,
  type LedgerVerification,
} from '@/lib/ledger/hashchain';

export type LedgerDb = Prisma.TransactionClient | typeof prisma;

export interface LedgerInput {
  actorId?: string | null;
  issueId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  ipAddress?: string | null;
  createdAt?: Date;
}

function isUniqueViolation(err: unknown): boolean {
  const anyErr = err as { code?: string };
  return anyErr?.code === 'P2002';
}

async function latestRow(db: LedgerDb): Promise<{ seq: number; hash: string } | null> {
  const latest = await db.auditEvent.findFirst({
    orderBy: { seq: 'desc' },
    select: { seq: true, hash: true },
  });
  return latest ?? null;
}

/** Append one tamper-evident ledger row, chained onto the current tip. */
async function appendOnce(db: LedgerDb, input: LedgerInput): Promise<void> {
  const createdAt = input.createdAt ?? new Date();
  const tip = await latestRow(db);
  const seq = (tip?.seq ?? 0) + 1;
  const prevHash = tip?.hash ?? null;
  const hash = computeLedgerHash({
    createdAt,
    action: String(input.action),
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    prevHash,
  });

  await db.auditEvent.create({
    data: {
      actorId: input.actorId ?? null,
      issueId: input.issueId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? undefined,
      ipAddress: input.ipAddress ?? null,
      createdAt,
      seq,
      prevHash,
      hash,
    },
  });
}

/**
 * Chained append with a bounded retry on a unique-constraint race (two writers
 * claiming the same seq or prevHash). On the standalone client path the
 * conflict is simply retried against the fresh tip; inside an interactive
 * transaction a true race surfaces to the caller (rare, low-concurrency app).
 */
export async function appendLedgerEntry(
  db: LedgerDb,
  input: LedgerInput,
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await appendOnce(db, input);
      return;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Contended tip — re-read and retry once the competing row has landed.
    }
  }
  throw new Error('Ledger append failed after retries due to write contention.');
}

/** Verify the *entire* ledger (full scan, correct link continuity). */
export async function getLedgerVerification(): Promise<{
  verification: LedgerVerification;
  depth: number;
  tipAt: string | null;
}> {
  const rows = await prisma.auditEvent.findMany({
    orderBy: { seq: 'asc' },
    select: {
      id: true,
      seq: true,
      prevHash: true,
      hash: true,
      createdAt: true,
      action: true,
      entityType: true,
      entityId: true,
    },
  });
  const depth = rows.length;
  const tipAt = depth ? rows[rows.length - 1].createdAt.toISOString() : null;
  const verification = verifyLedgerChain(
    rows.map((r) => ({
      seq: r.seq,
      prevHash: r.prevHash,
      hash: r.hash,
      createdAt: r.createdAt,
      action: String(r.action),
      entityType: String(r.entityType),
      entityId: r.entityId,
    })),
  );
  return { verification, depth, tipAt };
}
