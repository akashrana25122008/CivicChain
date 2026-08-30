import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/server/api';
import { requireRole } from '@/lib/server/session';
import { prisma } from '@/lib/db';

/** ADMIN-only platform statistics. */
export async function GET() {
  try {
    await requireRole('ADMIN');
    const [users, citizens, authorities, issues, resolved, activeIssues, issuesByStatus, auditLogs, notifications, escalations, verifiedEvidence, pendingEvidence] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'CITIZEN' } }),
      prisma.authority.count(),
      prisma.issue.count(),
      prisma.issue.count({ where: { status: 'RESOLVED' } }),
      prisma.issue.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS'] } } }),
      prisma.issue.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      prisma.auditLog.count(),
      prisma.notification.count(),
      prisma.escalation.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      prisma.verification.count({ where: { status: 'VERIFIED' } }),
      prisma.evidence.count({ where: { verifications: { none: { status: 'VERIFIED' } } } }),
    ]);
    return NextResponse.json({
      stats: {
        users,
        citizens,
        authorities,
        issues,
        resolved,
        activeIssues,
        auditLogs,
        notifications,
        escalations,
        verifiedEvidence,
        pendingEvidence,
      },
      byStatus: issuesByStatus.map((r) => ({
        status: r.status,
        count: r._count._all,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}