/**
 * Phase 10 — Community voting.
 *
 * A Vote is a typed, authenticated community signal on an Issue. It is a
 * signal, not authority: votes never mutate Issue.status, priority, SLA, or the
 * intelligence engine. Duplicate votes are prevented by a DB unique constraint
 * on (issueId, userId, type), and idempotent re-casts return the existing vote
 * rather than creating a second row.
 */
import { prisma } from '@/lib/db';
import { recordAudit } from '@/lib/server/audit';
import { ApiError, badRequest, notFound } from '@/lib/server/api';
import { applyKarmaEvent } from '@/lib/community/karma';
import { VoteType, type User } from '../../../generated/prisma/client';

export const VOTE_TYPES: VoteType[] = ['CONFIRM', 'DISPUTE', 'SUPPORT', 'DUPLICATE'];

export function isVoteType(value: unknown): value is VoteType {
  return typeof value === 'string' && (VOTE_TYPES as string[]).includes(value);
}

export interface VoteResult {
  id: string;
  issueId: string;
  type: VoteType;
  created: boolean;
}

/**
 * Record (or return the existing) typed vote for a user on an issue. Requires
 * an authenticated user. The `(issueId, userId, type)` unique constraint makes
 * duplicate creation impossible even under a race; a P2002 conflict is turned
 * into a benign idempotent return.
 */
export async function castVote(input: {
  issueId: string;
  actor: User;
  type: unknown;
}): Promise<VoteResult> {
  const { issueId, actor, type } = input;
  if (!isVoteType(type)) throw badRequest('A valid vote type is required.');

  const issue = await prisma.issue.findUnique({ where: { id: issueId }, select: { id: true } });
  if (!issue) throw notFound('Issue');

  // Prevent a user voting on their own report (avoids self-confirmation bias).
  // Ownership: a reporter's verification is handled by the /verify domain
  // action, not by community voting.
  const own = await prisma.issue.findFirst({
    where: { id: issueId, reporterId: actor.id },
    select: { id: true },
  });
  if (own) {
    throw new ApiError(403, 'FORBIDDEN', 'You cannot vote on your own report.');
  }

  try {
    const vote = await prisma.vote.create({ data: { issueId, userId: actor.id, type } });
    await recordAudit({
      actorId: actor.id,
      issueId,
      action: 'REPORT_UPDATED',
      entityType: 'Vote',
      entityId: vote.id,
      metadata: { type },
    });
    // A helpful, confirmed community signal earns the voter civic karma
    // (Phase 10, HELPFUL_CONFIRMATION). Only for freshly created votes; best-
    // effort + idempotent via dedupeKey so karma never corrupts the vote.
    if (vote.type === 'CONFIRM') {
      await applyKarmaEvent({ userId: actor.id, type: 'HELPFUL_CONFIRMATION', issueId }).catch(
        () => undefined,
      );
    }
    return { id: vote.id, issueId, type, created: true };
  } catch (err) {
    // Prisma P2002 = unique constraint (issueId, userId, type) — an existing
    // vote is returned idempotently instead of erroring.
    if (isUniqueViolation(err)) {
      const existing = await prisma.vote.findFirst({
        where: { issueId, userId: actor.id, type },
        select: { id: true },
      });
      if (existing) return { id: existing.id, issueId, type, created: false };
    }
    throw err;
  }
}

/** Verify a user has not already cast a vote of this type (pre-checks). */
export async function hasVoted(issueId: string, userId: string, type: VoteType): Promise<boolean> {
  const found = await prisma.vote.findFirst({
    where: { issueId, userId, type },
    select: { id: true },
  });
  return !!found;
}

/** Per-type vote counts for an issue — real counts from the database. */
export async function getVoteSummary(issueId: string): Promise<Record<VoteType, number>> {
  const rows = await prisma.vote.groupBy({
    by: ['type'],
    where: { issueId },
    _count: { _all: true },
  });
  const summary: Record<VoteType, number> = { CONFIRM: 0, DISPUTE: 0, SUPPORT: 0, DUPLICATE: 0 };
  for (const row of rows) summary[row.type] = row._count._all;
  return summary;
}

/** Best-effort detection of a Prisma unique-constraint violation (P2002). */
function isUniqueViolation(err: unknown): boolean {
  const anyErr = err as { code?: string };
  return anyErr?.code === 'P2002';
}
