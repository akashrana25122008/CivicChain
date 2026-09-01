/**
 * Phase 19 — Analytics Engine: department performance analytics.
 *
 * A single ranking of authorities by report volume plus their operational
 * outcomes (resolution rate, avg resolution time, active backlog, SLA
 * breaches). Everything is derived from real Issue / Promise data so the rank
 * is reproducible from the database alone.
 */

import { prisma } from '@/lib/db';
import { Prisma } from '../../../../generated/prisma/client';
import type { DepartmentMetric, RangeWindow } from './types';

interface AvgRow {
  authority_id: string;
  avg_minutes: number | null;
}
interface DeptCountRow {
  authority_id: string | null;
  total: number;
  resolved: number;
  active: number;
}
interface BreachRow {
  authority_id: string;
  breached: number;
}

export async function computeDepartmentMetrics(window: RangeWindow): Promise<DepartmentMetric> {
  const [authorities, countRows, avgRows, breachRows] = await Promise.all([
    prisma.authority.findMany({ select: { id: true, name: true, department: { select: { name: true } } } }),
    prisma.$queryRaw<DeptCountRow[]>(Prisma.sql`
      SELECT i."authorityId" AS authority_id,
             COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE i.status = 'RESOLVED')::int AS resolved,
             COUNT(*) FILTER (WHERE i.status IN ('SUBMITTED','UNDER_REVIEW','VERIFIED','ASSIGNED','IN_PROGRESS'))::int AS active
      FROM "Issue" i
      WHERE i."authorityId" IS NOT NULL
        ${window.from ? Prisma.sql`AND i."createdAt" >= ${window.from} AND i."createdAt" <= ${window.to}` : Prisma.empty}
      GROUP BY i."authorityId"
    `),
    prisma.$queryRaw<AvgRow[]>(Prisma.sql`
      SELECT i."authorityId" AS authority_id,
             AVG(EXTRACT(EPOCH FROM (al."createdAt" - i."createdAt")) / 60)::float AS avg_minutes
      FROM "AuditEvent" al
      JOIN "Issue" i ON i.id = al."issueId"
      WHERE al.action = 'STATUS_CHANGED'
        AND al.metadata->>'to' = 'RESOLVED'
        AND i."authorityId" IS NOT NULL
        ${window.from ? Prisma.sql`AND i."createdAt" >= ${window.from} AND i."createdAt" <= ${window.to}` : Prisma.empty}
      GROUP BY i."authorityId"
    `),
    prisma.$queryRaw<BreachRow[]>(Prisma.sql`
      SELECT p."authorityId" AS authority_id, COUNT(*)::int AS breached
      FROM "Promise" p
      LEFT JOIN "Issue" i ON i.id = p."issueId"
      WHERE p.status IN ('OPEN','IN_PROGRESS')
        AND p.deadline < NOW()
        AND (i.status IS NULL OR i.status NOT IN ('RESOLVED','REJECTED'))
        ${window.from ? Prisma.sql`AND p."createdAt" >= ${window.from} AND p."createdAt" <= ${window.to}` : Prisma.empty}
      GROUP BY p."authorityId"
    `),
  ]);

  const deptMap = new Map(authorities.map((a) => [a.id, a]));
  const avgMap = new Map(avgRows.map((r) => [r.authority_id, r.avg_minutes]));
  const breachMap = new Map(breachRows.map((r) => [r.authority_id, r.breached]));

  const rank = countRows
    .map((row) => {
      const dept = row.authority_id ? deptMap.get(row.authority_id) : undefined;
      return {
        authorityId: row.authority_id,
        label: dept?.department?.name ?? dept?.name ?? 'Unassigned',
        issueCount: row.total,
        resolvedCount: row.resolved,
        resolutionRatePct:
          row.total > 0 ? Math.round((row.resolved / row.total) * 10000) / 100 : null,
        avgResolutionMinutes: row.authority_id ? (avgMap.get(row.authority_id) ?? null) : null,
        activeCount: row.active,
        breached: row.authority_id ? (breachMap.get(row.authority_id) ?? 0) : 0,
      };
    })
    .sort((a, b) => b.issueCount - a.issueCount);

  return { rank };
}
