import { prisma } from '@/lib/db';
import { recordAudit } from '@/lib/server/audit';
import { createNotification } from '@/lib/server/notify';
import { ApiError, forbidden, notFound } from '@/lib/server/api';
import { STATUS_LABELS } from '@/lib/issues/mapping';
import {
  IssueStatus,
  type Issue,
  type Prisma,
  type User,
} from '../../../generated/prisma/client';

/**
 * Single authority for civic-issue lifecycle transitions (Phase 3).
 *
 * There is exactly ONE place in the whole application that may change an
 * issue's `status`: `transitionIssue()`. Every HTTP surface — POST/PATCH on
 * /api/reports AND /api/issues — delegates here. Status is never mutated by a
 * raw `prisma.issue.update({ data: { status } })` anywhere else.
 *
 * A transition is only legal if BOTH of these hold:
 *   1. the requested next status is in the transition graph for the current
 *      status (no arbitrary jumps), and
 *   2. the actor is authorized staff for this issue (an ADMIN, or the
 *      AUTHORITY account of the department the issue is assigned to).
 *
 * Each accepted transition is written atomically with its audit entry and
 * reporter notification, so an issue can never move into a state without a
 * trace of who moved it and why.
 */

export const TRANSITION_NOT_ALLOWED = 'INVALID_TRANSITION';

/**
 * Authoritative transition graph. `from -> allowed next statuses`.
 * A rejected/reopened issue returns to UNDER_REVIEW; a resolved issue may be
 * reopened back into IN_PROGRESS. Every arrow is an audited staff action.
 */
export const ISSUE_TRANSITIONS: Readonly<Record<IssueStatus, readonly IssueStatus[]>> = {
  [IssueStatus.SUBMITTED]: [IssueStatus.UNDER_REVIEW, IssueStatus.REJECTED],
  [IssueStatus.UNDER_REVIEW]: [IssueStatus.VERIFIED, IssueStatus.REJECTED],
  [IssueStatus.VERIFIED]: [IssueStatus.ASSIGNED, IssueStatus.REJECTED, IssueStatus.UNDER_REVIEW],
  [IssueStatus.ASSIGNED]: [IssueStatus.IN_PROGRESS, IssueStatus.REJECTED],
  [IssueStatus.IN_PROGRESS]: [IssueStatus.RESOLVED, IssueStatus.REJECTED],
  [IssueStatus.RESOLVED]: [IssueStatus.VERIFIED, IssueStatus.IN_PROGRESS],
  [IssueStatus.REJECTED]: [IssueStatus.UNDER_REVIEW],
};

/** Human-readable description of a single edge, used in error messages. */
function describeStatus(status: IssueStatus): string {
  return STATUS_LABELS[status] ?? status;
}

/** The statuses reachable directly from `from` per the authoritative graph. */
export function nextStatuses(from: IssueStatus): readonly IssueStatus[] {
  return ISSUE_TRANSITIONS[from] ?? [];
}

/** True when `to` is a legal next status from `from`. Pure — no DB access. */
export function isValidTransition(from: IssueStatus, to: IssueStatus): boolean {
  return nextStatuses(from).includes(to);
}

/**
 * Is this actor allowed to run a lifecycle transition on this issue?
 * Staff surfaces only — citizens may never change lifecycle status, EXCEPT for
 * the single, narrowly-scoped citizen verification action (`verifyIssue`):
 * the issue's own reporter may move a RESOLVED issue to VERIFIED (yes) or back
 * to IN_PROGRESS (no/dispute). Nothing else is open to citizens.
 */
async function assertTransitionActor(
  actor: User,
  issue: Pick<Issue, 'authorityId' | 'reporterId'>,
  opts: { citizenVerify?: boolean } = {},
): Promise<void> {
  if (actor.role === 'ADMIN') return;

  if (actor.role === 'AUTHORITY') {
    const authority = await prisma.authority.findFirst({
      where: { userId: actor.id },
      select: { id: true },
    });
    if (!authority || authority.id !== issue.authorityId) throw forbidden();
    return;
  }

  if (actor.role === 'CITIZEN' && opts.citizenVerify && issue.reporterId === actor.id) {
    return;
  }

  throw forbidden();
}

/**
 * The next statuses the given actor is permitted to request for the issue,
 * derived from the transition graph AND the actor's authorization. Empty for
 * citizens and for staff outside this issue's department — those surfaces
 * render no transition control.
 */
export async function allowedTransitionsFor(
  actor: User,
  issue: Pick<Issue, 'status' | 'authorityId'>,
): Promise<IssueStatus[]> {
  if (actor.role === 'ADMIN') {
    return [...ISSUE_TRANSITIONS[issue.status]];
  }
  if (actor.role === 'AUTHORITY') {
    const authority = await prisma.authority.findFirst({
      where: { userId: actor.id },
      select: { id: true },
    });
    if (!authority || authority.id !== issue.authorityId) return [];
    return [...ISSUE_TRANSITIONS[issue.status]];
  }
  return [];
}

export interface TransitionIssueInput {
  issueId: string;
  actor: User;
  nextStatus: IssueStatus;
  /** Optional note/justification recorded on the audit entry. */
  note?: string | null;
  /**
   * Grant the reporting citizen a narrow verification transition (Phase 9).
   * ONLY `verifyIssue` sets this. When true, the actor must be the issue's
   * reporter and the transition must be one of the two verification outcomes
   * (RESOLVED -> VERIFIED for "yes", RESOLVED -> IN_PROGRESS for "no/dispute").
   * It is an error to combine this with any other lifecycle path.
   */
  citizenVerify?: boolean;
}

export interface TransitionIssueResult {
  issue: Issue;
  /** True when the requested status already equals the current status. */
  unchanged: boolean;
}

/**
 * Apply `nextStatus` to the issue — the one and only status mutation point.
 * Throws ApiError(400, INVALID_TRANSITION) for an illegal jump and
 * ApiError(403, FORBIDDEN) for an unauthorized actor.
 */
export async function transitionIssue(input: TransitionIssueInput): Promise<TransitionIssueResult> {
  const { issueId, actor, nextStatus, note, citizenVerify } = input;

  const issue = await prisma.issue.findUnique({ where: { id: issueId } });
  if (!issue) throw notFound('Report');

  await assertTransitionActor(actor, issue, { citizenVerify });

  if (issue.status === nextStatus) {
    return { issue, unchanged: true };
  }

  const allowed = ISSUE_TRANSITIONS[issue.status] ?? [];
  if (!allowed.includes(nextStatus)) {
    throw new ApiError(
      400,
      TRANSITION_NOT_ALLOWED,
      `Cannot move a report from ${describeStatus(issue.status)} to ${describeStatus(nextStatus)}.`,
    );
  }

  // The narrow citizen-verification capability is only ever valid for the two
  // verification outcomes on a RESOLVED issue. Reject anything else to prevent
  // a citizen (or a buggy caller) from using it to jump elsewhere.
  if (citizenVerify) {
    const valid =
      issue.status === IssueStatus.RESOLVED &&
      (nextStatus === IssueStatus.VERIFIED || nextStatus === IssueStatus.IN_PROGRESS);
    if (!valid) {
      throw new ApiError(
        400,
        TRANSITION_NOT_ALLOWED,
        'Citizens may only verify or dispute a resolved issue.',
      );
    }
  }

  const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const result = await tx.issue.update({
      where: { id: issueId },
      data: { status: nextStatus },
    });

    await recordAudit({
      tx,
      actorId: actor.id,
      issueId: issue.id,
      action: 'STATUS_CHANGED',
      entityType: 'Issue',
      entityId: issue.id,
      metadata: {
        from: issue.status,
        to: nextStatus,
        ...(note ? { note } : {}),
      },
    });

    if (issue.reporterId !== actor.id) {
      await createNotification({
        tx,
        userId: issue.reporterId,
        issueId: issue.id,
        type: 'STATUS_CHANGED',
        title: `Report ${issue.publicId} is now ${describeStatus(nextStatus)}`,
        message: `Status changed from ${describeStatus(issue.status)} to ${describeStatus(nextStatus)}.`,
      });
    }

    return result;
  });

  return { issue: updated, unchanged: false };
}
