/**
 * Phase 6 — Promise formation + life-cycle reconciliation.
 *
 * CivicChain commits to a real resolution deadline for every issue that is
 * routed to an authority. `ensurePromiseForIssue` creates that Promise
 * deterministically from the central SLA policy (idempotent — a Promise exists
 * at most once per issue) and `reconcilePromiseStatus` keeps the persisted
 * PromiseStatus in step with the issue lifecycle:
 *   issue RESOLVED  -> COMPLETED (promise honoured)
 *   issue REJECTED  -> COMPLETED (no longer owed)
 *   SLA breached while still open -> BROKEN (promise not met)
 *
 * All computation flows through the shared, pure helpers in ./policy and
 * ./state — never duplicated inline in route handlers.
 */

import { prisma } from '@/lib/db';
import { recordAudit } from '@/lib/server/audit';
import { createNotification } from '@/lib/server/notify';
import { slaDeadlinesFor } from './policy';
import { calculateSlaState } from './state';
import {
  IssueStatus,
  PromiseStatus,
  type Severity,
} from '../../../generated/prisma/client';

/**
 * Ensure a resolution Promise exists for an issue that has been routed to an
 * authority. Creates the Promise (with deadline from policy) on first call;
 * subsequent calls leave an existing Promise untouched. Never mutates Issue
 * lifecycle status.
 */
export async function ensurePromiseForIssue(issueId: string): Promise<{ promiseId: string | null }> {
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    select: {
      id: true,
      publicId: true,
      authorityId: true,
      severity: true,
      status: true,
      reporterId: true,
      createdAt: true,
      promise: { select: { id: true, deadline: true } },
    },
  });
  if (!issue) return { promiseId: null };
  // A promise is owed only once the issue is with an authority.
  if (!issue.authorityId) return { promiseId: null };

  if (issue.promise) return { promiseId: issue.promise.id };

  const { resolutionMinutes } = slaDeadlinesFor(issue.severity as Severity | null);
  const deadline = new Date(issue.createdAt.getTime() + resolutionMinutes * 60_000);

  const promise = await prisma.promise.create({
    data: {
      issueId: issue.id,
      authorityId: issue.authorityId,
      deadline,
      status: PromiseStatus.OPEN,
      description: `Resolution committed for ${issue.publicId}`,
    },
  });

  await recordAudit({
    actorId: issue.reporterId,
    issueId: issue.id,
    action: 'STATUS_CHANGED',
    entityType: 'Promise',
    entityId: promise.id,
    metadata: { deadline: deadline.toISOString(), authorityId: issue.authorityId },
  });

  await createNotification({
    userId: issue.reporterId,
    issueId: issue.id,
    type: 'PROMISE_DEADLINE',
    title: `A resolution deadline was set for ${issue.publicId}`,
    message: `The assigned authority committed to resolve your report by ${deadline.toISOString()}.`,
  });

  return { promiseId: promise.id };
}

/**
 * Align a Promise's persisted status with the current Issue lifecycle + SLA.
 * Idempotent and safe to call on every transition / read.
 */
export async function reconcilePromiseStatus(issueId: string): Promise<void> {
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    select: { id: true, status: true, createdAt: true, promise: true },
  });
  if (!issue?.promise) return;

  const promise = issue.promise;

  let next: PromiseStatus | null = null;
  if (issue.status === IssueStatus.RESOLVED || issue.status === IssueStatus.REJECTED) {
    next = PromiseStatus.COMPLETED;
  } else {
    const { slaState } = calculateSlaState({
      deadline: promise.deadline,
      createdAt: issue.createdAt,
      resolved: false,
    });
    if (slaState === 'BREACHED') next = PromiseStatus.BROKEN;
    else if (slaState === 'AT_RISK' || slaState === 'ON_TRACK') next = PromiseStatus.IN_PROGRESS;
  }

  if (next === null || next === promise.status) return;

  await prisma.promise.update({ where: { id: promise.id }, data: { status: next } });
}

/**
 * Convenience: form the promise if due, then reconcile it in one call.
 */
export async function syncPromiseForIssue(issueId: string): Promise<void> {
  await ensurePromiseForIssue(issueId);
  await reconcilePromiseStatus(issueId);
}
