import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/server/api';
import { requireUser } from '@/lib/server/session';
import { prisma } from '@/lib/db';
import { IssueStatus } from '../../../../../generated/prisma/client';

const NON_TERMINAL: IssueStatus[] = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'VERIFIED',
  'ASSIGNED',
  'IN_PROGRESS',
];

/**
 * Personal summary for the citizen dashboard. Every number is computed from
 * the live database, scoped to the signed-in user by their session id.
 */
export async function GET() {
  try {
    const user = await requireUser();
    const [total, active, resolved, rejected, evidenceTotal, evidencePending, notificationsUnread] =
      await Promise.all([
        prisma.issue.count({ where: { reporterId: user.id } }),
        prisma.issue.count({ where: { reporterId: user.id, status: { in: NON_TERMINAL } } }),
        prisma.issue.count({ where: { reporterId: user.id, status: 'RESOLVED' } }),
        prisma.issue.count({ where: { reporterId: user.id, status: 'REJECTED' } }),
        prisma.evidence.count({ where: { issue: { reporterId: user.id } } }),
        prisma.evidence.count({
          where: {
            issue: { reporterId: user.id },
            verifications: { none: { status: 'VERIFIED' } },
          },
        }),
        prisma.notification.count({ where: { userId: user.id, read: false } }),
      ]);

    return NextResponse.json({
      stats: {
        total,
        active,
        resolved,
        rejected,
        awaitingVerification: evidencePending,
        evidenceTotal,
        evidencePending,
        karmaScore: user.karmaScore,
        notificationsUnread,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}