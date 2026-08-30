import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/session';
import { handleApiError } from '@/lib/server/api';
import { requireOwnAuthority } from '@/lib/server/dept';
import { avgResolutionMinutes, slaHealthForAuthority } from '@/lib/server/metrics';
import { formatRelativeTime } from '@/lib/utils';
import { prisma } from '@/lib/db';
import { IssueStatus } from '../../../../../generated/prisma/client';

const ACTIVE_STATUSES: IssueStatus[] = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'VERIFIED',
  'ASSIGNED',
  'IN_PROGRESS',
];
const OPEN_STATUSES: IssueStatus[] = ['SUBMITTED', 'UNDER_REVIEW', 'VERIFIED'];

/** Department (AUTHORITY) operations overview — own-authority scoped only. */
export async function GET() {
  try {
    const user = await requireUser();
    const authority = await requireOwnAuthority(user);

    const [assigned, active, open, inProgress, resolved, rejected, awaitingVerification, escalationsOpen, promisesActive, promisesBroken, overdue, avgMinutes, slaHealth] =
      await Promise.all([
        prisma.issue.count({ where: { authorityId: authority.id } }),
        prisma.issue.count({ where: { authorityId: authority.id, status: { in: ACTIVE_STATUSES } } }),
        prisma.issue.count({ where: { authorityId: authority.id, status: { in: OPEN_STATUSES } } }),
        prisma.issue.count({ where: { authorityId: authority.id, status: 'IN_PROGRESS' } }),
        prisma.issue.count({ where: { authorityId: authority.id, status: 'RESOLVED' } }),
        prisma.issue.count({ where: { authorityId: authority.id, status: 'REJECTED' } }),
        prisma.evidence.count({
          where: {
            issue: { authorityId: authority.id },
            verifications: { none: { status: 'VERIFIED' } },
          },
        }),
        prisma.escalation.count({
          where: { issue: { authorityId: authority.id }, status: { in: ['OPEN', 'IN_PROGRESS'] } },
        }),
        prisma.promise.count({
          where: { authorityId: authority.id, status: { in: ['OPEN', 'IN_PROGRESS'] } },
        }),
        prisma.promise.count({ where: { authorityId: authority.id, status: 'BROKEN' } }),
        // Overdue: active promises whose doorstep has passed (live-sourced).
        prisma.promise.count({
          where: {
            authorityId: authority.id,
            status: { in: ['OPEN', 'IN_PROGRESS'] },
            deadline: { lt: new Date() },
          },
        }),
        avgResolutionMinutes({ authorityId: authority.id }),
        slaHealthForAuthority({ authorityId: authority.id }),
      ]);

    const activity = await prisma.auditLog.findMany({
      where: { issue: { authorityId: authority.id } },
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: {
        actor: { select: { name: true, email: true } },
        issue: { select: { publicId: true } },
      },
    });

    return NextResponse.json({
      authority: {
        name: authority.name,
        department: authority.department,
        jurisdiction: authority.jurisdiction,
      },
      stats: {
        assigned,
        active,
        open,
        inProgress,
        resolved,
        rejected,
        awaitingVerification,
        escalationsOpen,
        promisesActive,
        promisesBroken,
        overdue,
        avgResolutionMinutes: avgMinutes,
        slaOnTrack: slaHealth.onTrack,
        slaAtRisk: slaHealth.atRisk,
        slaBreached: slaHealth.breached,
      },
      activity: activity.map((log) => ({
        id: log.id,
        action: log.action,
        issuePublicId: log.issue?.publicId ?? null,
        actor: log.actor ? log.actor.name ?? log.actor.email : null,
        createdAt: log.createdAt.toISOString(),
        timeLabel: formatRelativeTime(log.createdAt),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}