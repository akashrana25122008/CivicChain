import { prisma } from '@/lib/db';
import { recordAudit } from '@/lib/server/audit';
import { createNotification } from '@/lib/server/notify';
import { ApiError, badRequest, forbidden, notFound } from '@/lib/server/api';
import { transitionIssue } from '@/lib/issues/transition';
import { getOwnAuthority } from '@/lib/server/dept';
import { evaluateEscalations } from '@/lib/escalation/engine';
import {
  IssueStatus,
  type Prisma,
  type User,
} from '../../../generated/prisma/client';

/**
 * Canonical Issue domain actions (Phase 2/3).
 *
 * Lifecycle-affecting operations live HERE, not in route handlers. Each action
 * owns its validation + actor rules and delegates any state change to the
 * single transition authority (`transitionIssue`). Route handlers under
 * /api/issues/:id/... are thin: parse → validate → call an action → respond.
 */

export async function assertIssueExists(issueId: string): Promise<void> {
  const issue = await prisma.issue.findUnique({ where: { id: issueId }, select: { id: true } });
  if (!issue) throw notFound('Issue');
}

/** Is this user the authority currently assigned to the issue? */
async function isAssignedAuthority(actor: User, authorityId: string | null): Promise<boolean> {
  if (actor.role === 'ADMIN') return true;
  if (actor.role !== 'AUTHORITY') return false;
  const authority = await getOwnAuthority(actor);
  return !!authority && authority.id === authorityId;
}

const RESOLUTION_PRECONDITIONS: readonly IssueStatus[] = [
  IssueStatus.IN_PROGRESS,
  IssueStatus.ASSIGNED,
  IssueStatus.VERIFIED,
];

/**
 * resolveIssue — mark an issue as resolved. Authorized staff only. This is the
 * "Resolution Submitted" domain action: it validates state + actor, then moves
 * the lifecycle through the state machine. Repeated resolution of an already-
 * resolved issue is a safe no-op (idempotent).
 */
export async function resolveIssue(input: {
  issueId: string;
  actor: User;
  note?: string | null;
}): Promise<{ changed: boolean; issueId: string }> {
  const { issueId, actor, note } = input;

  const issue = await prisma.issue.findUnique({ where: { id: issueId } });
  if (!issue) throw notFound('Issue');

  if (!(await isAssignedAuthority(actor, issue.authorityId))) throw forbidden();

  if (issue.status === IssueStatus.RESOLVED) {
    return { changed: false, issueId };
  }
  if (!RESOLUTION_PRECONDITIONS.includes(issue.status)) {
    throw new ApiError(
      400,
      'INVALID_STATE_TRANSITION',
      `Issue cannot be resolved from state ${issue.status}.`,
    );
  }

  await transitionIssue({ issueId, actor, nextStatus: IssueStatus.RESOLVED, note });

  if (issue.reporterId !== actor.id) {
    await createNotification({
      userId: issue.reporterId,
      issueId,
      type: 'STATUS_CHANGED',
      title: `Report ${issue.publicId} has been resolved`,
      message: 'You can verify whether the problem is actually fixed.',
    });
  }

  return { changed: true, issueId };
}

const REOPEN_SOURCES: readonly IssueStatus[] = [IssueStatus.RESOLVED, IssueStatus.REJECTED];

/**
 * reopenIssue — the "Citizen Disputed → Reopened" domain action. Authorized
 * staff, or the original citizen reporter, may reopen a resolved (or rejected)
 * issue. Reopening a non-terminal issue is a no-op/failed precondition.
 */
export async function reopenIssue(input: {
  issueId: string;
  actor: User;
  note?: string | null;
}): Promise<{ changed: boolean; issueId: string }> {
  const { issueId, actor, note } = input;

  const issue = await prisma.issue.findUnique({ where: { id: issueId } });
  if (!issue) throw notFound('Issue');

  const isStaff = await isAssignedAuthority(actor, issue.authorityId);
  const isOwner = actor.role === 'CITIZEN' && issue.reporterId === actor.id;
  if (!isStaff && !isOwner) throw forbidden();

  const target =
    issue.status === IssueStatus.REJECTED ? IssueStatus.UNDER_REVIEW : IssueStatus.IN_PROGRESS;

  if (!REOPEN_SOURCES.includes(issue.status)) {
    throw new ApiError(
      400,
      'INVALID_STATE_TRANSITION',
      `Issue in state ${issue.status} cannot be reopened.`,
    );
  }

  await transitionIssue({ issueId, actor, nextStatus: target, note });
  return { changed: true, issueId };
}

export interface EvidenceUpload {
  url: string;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
}

/**
 * addIssueEvidence — persist validated evidence files for an issue. Uploaded by
 * the reporter, assigned authority, or admin. Files must already be stored
 * (caller handles storage + failure cleanup); this persists the metadata rows
 * atomically with an audit entry.
 */
export async function addIssueEvidence(input: {
  issueId: string;
  actor: User;
  files: EvidenceUpload[];
}): Promise<{ count: number; issueId: string }> {
  const { issueId, actor, files } = input;

  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    select: { id: true, reporterId: true, authorityId: true, publicId: true },
  });
  if (!issue) throw notFound('Issue');

  const isOwner = actor.role === 'CITIZEN' && issue.reporterId === actor.id;
  const isStaff = await isAssignedAuthority(actor, issue.authorityId);
  if (!isOwner && !isStaff) throw forbidden();

  if (files.length === 0) throw badRequest('No evidence files provided.');

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.evidence.createMany({
      data: files.map((f) => ({
        issueId,
        type: (f.mimeType?.startsWith('video') ? 'VIDEO' : 'IMAGE') as 'IMAGE' | 'VIDEO',
        url: f.url,
        fileName: f.fileName ?? null,
        mimeType: f.mimeType ?? null,
        sizeBytes: f.sizeBytes ?? null,
        uploadedById: actor.id,
      })),
    });
    await recordAudit({
      tx,
      actorId: actor.id,
      issueId,
      action: 'EVIDENCE_ADDED',
      entityType: 'Issue',
      entityId: issueId,
      metadata: { count: files.length },
    });
  });

  // Evidence added is a signal the issue should advance to review if it's still
  // freshly submitted (staff or owner attaching supporting material).
  if (issue.reporterId !== actor.id) {
    await createNotification({
      userId: issue.reporterId,
      issueId,
      type: 'EVIDENCE_ADDED',
      title: `Evidence added to ${issue.publicId}`,
      message: 'New evidence was attached to your report.',
    });
  }

  return { count: files.length, issueId };
}

/**
 * verifyIssue — the citizen verification action. The citizen confirms their
 * resolved issue is actually fixed, advancing the lifecycle to VERIFIED (only
 * meaningful when the resolution flow uses VERIFIED as citizen confirmation).
 * Ownership enforced: only the reporter may confirm.
 */
export async function verifyIssue(input: {
  issueId: string;
  actor: User;
  outcome: 'VERIFIED' | 'DISPUTED';
  feedback?: string | null;
}): Promise<{ changed: boolean; issueId: string; dispute: boolean }> {
  const { issueId, actor, outcome, feedback } = input;

  const issue = await prisma.issue.findUnique({ where: { id: issueId } });
  if (!issue) throw notFound('Issue');
  if (issue.reporterId !== actor.id) throw forbidden();
  if (issue.status !== IssueStatus.RESOLVED) {
    throw new ApiError(400, 'INVALID_STATE_TRANSITION', 'Only resolved issues can be verified by the reporter.');
  }
  if (outcome === 'DISPUTED') {
    // Disputing reopens the issue through the state machine.
    await transitionIssue({ issueId, actor, nextStatus: IssueStatus.IN_PROGRESS, note: feedback });
    // A citizen dispute is a strong accountability signal — evaluate escalation
    // rules (idempotent; a failure here must not corrupt the reopen above).
    await evaluateEscalations(issueId).catch(() => undefined);
    return { changed: true, issueId, dispute: true };
  }
  await transitionIssue({ issueId, actor, nextStatus: IssueStatus.VERIFIED, note: feedback });
  return { changed: true, issueId, dispute: false };
}

/**
 * analyzeIssue — kick off (or report on) the existing intelligence pipeline.
 * The pipeline already persists its results (AI analysis, duplicates, priority)
 * and is launched asynchronously by the route layer (existing `after()` /
 * resume-on-read mechanism; Phase 5 moves this onto a real queue). This action
 * only verifies the issue exists and returns the current analysis status.
 */
export async function analyzeIssue(input: {
  issueId: string;
}): Promise<{ issueId: string; analysisStatus: string }> {
  const { issueId } = input;
  const issue = await prisma.issue.findUnique({ where: { id: issueId } });
  if (!issue) throw notFound('Issue');

  const analysis = await prisma.aIAnalysis.findUnique({ where: { issueId } });
  return { issueId, analysisStatus: analysis?.status ?? 'PENDING' };
}

