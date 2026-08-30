import {
  AuditAction,
  type Prisma,
  type PrismaClient,
} from '../../../generated/prisma/client';
import { prisma as prismaClient } from '@/lib/db';

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
  tx?: AuditTx;
}

/**
 * Server-side audit logging. All important business actions are recorded here
 * with the actor derived from the authenticated session — never from the
 * client. Accepts a transaction client so a log entry can join report
 * creation atomically.
 */
export async function recordAudit(input: RecordAuditInput): Promise<void> {
  const db: AuditTx = input.tx ?? prismaClient;
  await db.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      issueId: input.issueId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? undefined,
      ipAddress: input.ipAddress ?? null,
    },
  });
}