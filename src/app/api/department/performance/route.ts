import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/session';
import { handleApiError } from '@/lib/server/api';
import { requireOwnAuthority } from '@/lib/server/dept';
import { avgResolutionMinutes, createdIssuesByDay } from '@/lib/server/metrics';
import { STATUS_LABELS } from '@/lib/issues/mapping';
import { prisma } from '@/lib/db';
import { IssueStatus } from '../../../../../generated/prisma/client';

const ACTIVE_STATUSES: IssueStatus[] = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'VERIFIED',
  'ASSIGNED',
  'IN_PROGRESS',
];

/** Department performance & progress — own-authority scope, real data only. */
export async function GET() {
  try {
    const user = await requireUser();
    const authority = await requireOwnAuthority(user);

    const [total, active, resolved, rejected, inProgress, awaitingVerification, escalationsTotal, escalationsOpen, promisesActive, promisesBroken, promisesCompleted, avgMinutes, byStatus, verifiedVerifications, rejectedVerifications, byDay] =
      await Promise.all([
        prisma.issue.count({ where: { authorityId: authority.id } }),
        prisma.issue.count({ where: { authorityId: authority.id, status: { in: ACTIVE_STATUSES } } }),
        prisma.issue.count({ where: { authorityId: authority.id, status: 'RESOLVED' } }),
        prisma.issue.count({ where: { authorityId: authority.id, status: 'REJECTED' } }),
        prisma.issue.count({ where: { authorityId: authority.id, status: 'IN_PROGRESS' } }),
        prisma.evidence.count({
          where: {
            issue: { authorityId: authority.id },
            verifications: { none: { status: 'VERIFIED' } },
          },
        }),
        prisma.escalation.count({ where: { issue: { authorityId: authority.id } } }),
        prisma.escalation.count({ where: { issue: { authorityId: authority.id }, status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
        prisma.promise.count({ where: { authorityId: authority.id, status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
        prisma.promise.count({ where: { authorityId: authority.id, status: 'BROKEN' } }),
        prisma.promise.count({ where: { authorityId: authority.id, status: 'COMPLETED' } }),
        avgResolutionMinutes({ authorityId: authority.id }),
        prisma.issue.groupBy({
          by: ['status'],
          where: { authorityId: authority.id },
          _count: { _all: true },
        }),
        prisma.verification.count({
          where: { issue: { authorityId: authority.id }, status: 'VERIFIED' },
        }),
        prisma.verification.count({
          where: { issue: { authorityId: authority.id }, status: 'REJECTED' },
        }),
        createdIssuesByDay({ authorityId: authority.id, days: 14 }),
      ]);

    const statusBreakdown = byStatus.map((row) => ({
      status: row.status,
      label: STATUS_LABELS[row.status] ?? row.status,
      count: row._count._all,
    }));

    return NextResponse.json({
      summary: {
        total,
        active,
        resolved,
        rejected,
        inProgress,
        awaitingVerification,
        escalationsTotal,
        escalationsOpen,
        promisesActive,
        promisesBroken,
        promisesCompleted,
        avgResolutionMinutes: avgMinutes,
        resolutionRate: total > 0 ? Math.round((resolved / total) * 10000) / 100 : null,
        verifiedVerifications,
        rejectedVerifications,
      },
      byStatus: statusBreakdown,
      byDay,
    });
  } catch (error) {
    return handleApiError(error);
  }
}