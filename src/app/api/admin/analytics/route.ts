import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/server/api';
import { requireRole } from '@/lib/server/session';
import { avgResolutionMinutes, createdIssuesByDay } from '@/lib/server/metrics';
import { CATEGORY_LABELS, STATUS_LABELS } from '@/lib/issues/mapping';
import { prisma } from '@/lib/db';
import { IssueStatus } from '../../../../../generated/prisma/client';

const ACTIVE = ['SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS'];
const RESOLVED: IssueStatus = 'RESOLVED';

/** ADMIN-only platform analytics — all aggregates computed from live data. */
export async function GET() {
  try {
    await requireRole('ADMIN');

    const [byCategory, byStatus, byDepartment, usersByRole, total, resolved, avgMinutes, overTime, reportsToday, reportsThisWeek] =
      await Promise.all([
        prisma.issue.groupBy({ by: ['category'], _count: { _all: true } }),
        prisma.issue.groupBy({ by: ['status'], _count: { _all: true } }),
        prisma.issue.groupBy({
          by: ['authorityId'],
          where: { authorityId: { not: null } },
          _count: { _all: true },
        }),
        prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
        prisma.issue.count(),
        prisma.issue.count({ where: { status: RESOLVED } }),
        avgResolutionMinutes({}),
        createdIssuesByDay({ days: 30 }),
        prisma.issue.count({ where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
        prisma.issue.count({
          where: {
            createdAt: {
              gte: new Date(new Date().setDate(new Date().getDate() - 7)),
            },
          },
        }),
      ]);

    const departments = await prisma.authority.findMany({
      select: { id: true, name: true, department: true },
    });
    const deptMap = new Map(departments.map((d) => [d.id, d]));

    return NextResponse.json({
      issuesByCategory: byCategory.map((row) => ({
        category: row.category,
        label: CATEGORY_LABELS[row.category] ?? row.category,
        count: row._count._all,
      })),
      issuesByStatus: byStatus.map((row) => ({
        status: row.status,
        label: STATUS_LABELS[row.status] ?? row.status,
        count: row._count._all,
      })),
      issuesByDepartment: byDepartment.map((row) => {
        const dept = row.authorityId ? deptMap.get(row.authorityId) : undefined;
        return {
          authorityId: row.authorityId,
          label: dept?.department ?? dept?.name ?? 'Unassigned',
          count: row._count._all,
        };
      }),
      usersByRole: usersByRole.map((row) => ({ role: row.role, count: row._count._all })),
      overTime,
      totals: {
        issues: total,
        activeIssues: byStatus
          .filter((row) => ACTIVE.includes(row.status))
          .reduce((sum, row) => sum + row._count._all, 0),
        resolved,
        resolutionRate: total > 0 ? Math.round((resolved / total) * 10000) / 100 : null,
        avgResolutionMinutes: avgMinutes,
        reportsToday,
        reportsThisWeek,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}