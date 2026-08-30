import {
  NotificationType,
  type Prisma,
  type PrismaClient,
} from '../../../generated/prisma/client';
import { prisma as prismaClient } from '@/lib/db';

export type NotifyTx = PrismaClient | Prisma.TransactionClient;

export interface CreateNotificationInput {
  userId: string;
  issueId?: string | null;
  type: NotificationType;
  title: string;
  message?: string | null;
  tx?: NotifyTx;
}

/**
 * Database-backed notification persistence (Phase 1). Push/webhook delivery
 * is intentionally NOT implemented yet.
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  const db: NotifyTx = input.tx ?? prismaClient;
  await db.notification.create({
    data: {
      userId: input.userId,
      issueId: input.issueId ?? null,
      type: input.type,
      title: input.title,
      message: input.message ?? null,
    },
  });
}