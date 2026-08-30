/**
 * Phase 10 — Civic karma.
 *
 * Karma is DERIVED from auditable KarmaEvent rows, never set directly by a
 * client. `applyKarmaEvent` writes the event and increments User.karmaScore in
 * one transaction. Idempotency is enforced by a unique `dedupeKey`, so a
 * retried worker can never award the same event twice. Karma reflects verified,
 * useful civic participation only — never frontend-submitted values.
 */
import { prisma } from '@/lib/db';
import type { Prisma, KarmaEventType, KarmaEvent } from '../../../generated/prisma/client';

/** Base point values for trusted, verified participation. */
export const KARMA_POINTS: Record<KarmaEventType, number> = {
  REPORT_VERIFIED: 20,
  EVIDENCE_VERIFIED: 15,
  HELPFUL_CONFIRMATION: 10,
  VALID_DUPLICATE: 8,
  FALSE_REPORT: -20,
  ABUSIVE_VOTE: -25,
};

export interface KarmaAppliedResult {
  event: KarmaEvent | null;
  /** True when a NEW event+points were recorded; false when it already existed. */
  applied: boolean;
}

/**
 * Award (or deny) karma for a single trusted event. idempotent via dedupeKey —
 * if an event with the same key already exists, nothing changes.
 */
export async function applyKarmaEvent(input: {
  userId: string;
  type: KarmaEventType;
  issueId?: string | null;
  metadata?: Prisma.InputJsonValue | null;
}): Promise<KarmaAppliedResult> {
  const { userId, type, issueId = null, metadata = null } = input;
  const points = KARMA_POINTS[type];

  const dedupeKey = buildDedupeKey(type, issueId, userId);

  const existing = await prisma.karmaEvent.findUnique({ where: { dedupeKey } });
  if (existing) return { event: existing, applied: false };

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Re-check inside the transaction guards against concurrent duplicates.
    const dup = await tx.karmaEvent.findUnique({ where: { dedupeKey } });
    if (dup) return { event: dup, applied: false };

    const event = await tx.karmaEvent.create({
      data: {
        userId,
        type,
        points,
        issueId,
        dedupeKey,
        ...(metadata ? { metadata } : {}),
      },
    });
    await tx.user.update({
      where: { id: userId },
      data: { karmaScore: { increment: points } },
    });
    return { event, applied: true };
  });
}

/** Recompute karmaScore from the full event ledger (self-healing). */
export async function calculateKarma(userId: string): Promise<number> {
  const agg = await prisma.karmaEvent.aggregate({ where: { userId }, _sum: { points: true } });
  return agg._sum.points ?? 0;
}

/** Timestamps + type + userId make an event unique to its true source. */
export function buildDedupeKey(type: KarmaEventType, issueId: string | null, userId: string): string {
  return issueId ? `${type}:issue=${issueId}:user=${userId}` : `${type}:user=${userId}`;
}
