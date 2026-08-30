import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/server/api';
import { requireRole } from '@/lib/server/session';
import { prisma } from '@/lib/db';

/** ADMIN-only platform statistics. */
export async function GET() {
  try {
    await requireRole('ADMIN');
    const [users, authorities, issues, resolved, activeIssues, auditLogs, notifications, escalations, verifiedEvidence, pendingEvidence] = await Promise.all([
      prisma.user.count(),
      prisma.authority.count(),
      prisma.issue.count(),
      prisma.issue.count({ where: { status: 'RESOLVED' } }),
      prisma.issue.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS'] } } }),
      prisma.auditLog.count(),
      prisma.notification.count(),
      prisma.escalation.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      prisma.verification.count({ where: { status: 'VERIFIED' } }),
      prisma.evidence.count({ where: { verifications: { none: { status: 'VERIFIED' } } } }),
    ]);
    return NextResponse.json({
      stats: { users, authorities, issues, resolved, activeIssues, auditLogs, notifications, escalations, verifiedEvidence, pendingEvidence },
    });
  } catch (error) {
    return handleApiError(error);
  }
}