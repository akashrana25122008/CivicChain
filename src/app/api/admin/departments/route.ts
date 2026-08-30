import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/server/api';
import { requireRole } from '@/lib/server/session';
import { prisma } from '@/lib/db';
import { EscalationStatus, Prisma } from '../../../../../generated/prisma/client';

const ACTIVE = ['SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS'];
const OPEN_ESCALATION: EscalationStatus[] = ['OPEN', 'IN_PROGRESS'];

/** ADMIN-only directory of authorities (departments) with live workload numbers. */
export async function GET() {
  try {
    await requireRole('ADMIN');

    const [authorities, issuesByStatus, escalationsByDept, promisesByDept, avgRows] =
      await Promise.all([
        prisma.authority.findMany({
          include: { user: { select: { name: true, email: true } } },
        }),
        prisma.issue.groupBy({
          by: ['authorityId', 'status'],
          where: { authorityId: { not: null } },
          _count: { _all: true },
        }),
        prisma.escalation.groupBy({
          by: ['authorityId'],
          where: {
            authorityId: { not: null },
            status: { in: OPEN_ESCALATION },
          },
          _count: { _all: true },
        }),
        prisma.promise.groupBy({
          by: ['authorityId', 'status'],
          where: { authorityId: { not: null } },
          _count: { _all: true },
        }),
        prisma.$queryRaw<Array<{ authorityId: string; avg_minutes: number | null }>>(Prisma.sql`
          SELECT i."authorityId" AS "authorityId",
                 AVG(EXTRACT(EPOCH FROM (al."createdAt" - i."createdAt")) / 60)::float AS avg_minutes
          FROM "AuditLog" al
          JOIN "Issue" i ON i.id = al."issueId"
          WHERE al.action = 'STATUS_CHANGED'
            AND al.metadata->>'to' = 'RESOLVED'
            AND i."authorityId" IS NOT NULL
          GROUP BY i."authorityId"
        `),
      ]);

    const escalationsMap = new Map(
      escalationsByDept.map((r) => [r.authorityId, (r._count as { _all: number })._all]),
    );
    const avgMap = new Map(avgRows.map((r) => [r.authorityId, r.avg_minutes]));

    const issuesByDept = new Map<string, { assigned: number; active: number; resolved: number; rejected: number }>();
    for (const row of issuesByStatus) {
      const id = row.authorityId as string;
      const bucket = issuesByDept.get(id) ?? { assigned: 0, active: 0, resolved: 0, rejected: 0 };
      bucket.assigned += row._count._all;
      if (ACTIVE.includes(row.status)) bucket.active += row._count._all;
      if (row.status === 'RESOLVED') bucket.resolved += row._count._all;
      if (row.status === 'REJECTED') bucket.rejected += row._count._all;
      issuesByDept.set(id, bucket);
    }

    const offsets = new Map<string, { active: number; broken: number }>();
    for (const row of promisesByDept) {
      const id = row.authorityId as string;
      const bucket = offsets.get(id) ?? { active: 0, broken: 0 };
      if (row.status === 'OPEN' || row.status === 'IN_PROGRESS') bucket.active += row._count._all;
      if (row.status === 'BROKEN') bucket.broken += row._count._all;
      offsets.set(id, bucket);
    }

    return NextResponse.json({
      authorities: authorities.map((a) => {
        const workload = issuesByDept.get(a.id) ?? { assigned: 0, active: 0, resolved: 0, rejected: 0 };
        const promises = offsets.get(a.id) ?? { active: 0, broken: 0 };
        const avg = avgMap.get(a.id);
        return {
          id: a.id,
          name: a.name,
          department: a.department,
          jurisdiction: a.jurisdiction,
          email: a.email,
          operator: a.user ? a.user.name ?? a.user.email : null,
          assigned: workload.assigned,
          active: workload.active,
          resolved: workload.resolved,
          rejected: workload.rejected,
          escalationsOpen: escalationsMap.get(a.id) ?? 0,
          promisesActive: promises.active,
          promisesBroken: promises.broken,
          avgResolutionMinutes: avg == null ? null : Math.round(avg),
        };
      }),
      total: authorities.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}