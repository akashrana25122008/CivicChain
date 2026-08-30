import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/server/api';
import { requireRole } from '@/lib/server/session';
import { prisma } from '@/lib/db';

/** ADMIN-only platform statistics. */
export async function GET() {
  try {
    await requireRole('ADMIN');
    const [users, authorities, issues, resolved, auditLogs, notifications] = await Promise.all([
      prisma.user.count(),
      prisma.authority.count(),
      prisma.issue.count(),
      prisma.issue.count({ where: { status: 'RESOLVED' } }),
      prisma.auditLog.count(),
      prisma.notification.count(),
    ]);
    return NextResponse.json({
      stats: { users, authorities, issues, resolved, auditLogs, notifications },
    });
  } catch (error) {
    return handleApiError(error);
  }
}