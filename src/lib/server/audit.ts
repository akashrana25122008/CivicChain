import {
  AuditAction,
  type Prisma,
  type PrismaClient,
} from '../../../generated/prisma/client';
import { prisma as prismaClient } from '@/lib/db';
import { appendLedgerEntry } from '@/lib/server/ledger';

export type AuditTx =
  | PrismaClient
  | Prisma.TransactionClient;

export interface RecordAuditInput {
  actorId?: string | null;
  issueId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  ipAddress?: string | null;
  createdAt?: Date;
  tx?: AuditTx;
}

/**
 * Server-side audit logging. All important business actions are recorded here
 * with the actor derived from the authenticated session — never from the
 * client. Accepts a transaction client so a log entry can join report
 * creation atomically.
 *
 * Phase 18: every entry is appended to the append-only tamper-evident hash
 * chain (see src/lib/server/ledger.ts) — each row stores its SHA-256 hash
 * chained onto the previous row's hash, so history cannot be rewritten
 * undetected. `createdAt` is pinned here so the hashed payload is deterministic.
 */
export async function recordAudit(input: RecordAuditInput): Promise<void> {
  const db: AuditTx = input.tx ?? prismaClient;
  await appendLedgerEntry(db, {
    actorId: input.actorId,
    issueId: input.issueId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: input.metadata,
    ipAddress: input.ipAddress,
    createdAt: input.createdAt,
  });
}