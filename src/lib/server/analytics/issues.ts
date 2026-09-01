/**
 * Phase 19 — Analytics Engine: issue volume analytics.
 *
 * Aggregates the issue lifecycle over a unified time window: totals, active /
 * resolved / rejected splits, status + category + department breakdowns, a
 * zero-filled daily series, and a current-vs-previous trend.
 */

import { prisma } from '@/lib/db';
import { Prisma, IssueStatus } from '../../../../generated/prisma/client';
import { CATEGORY_LABELS } from '@/lib/issues/mapping';
import type { IssueMetric, MetricTrend, RangeWindow } from './types';
import { previousWindow } from './range';
import { calculateTrend } from '@/lib/risk/trend';

const ACTIVE_STATUSES: IssueStatus[] = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'VERIFIED',
  'ASSIGNED',
  'IN_PROGRESS',
];

interface DayKeyRow {
  day: Date;
  value: number;
}

function dayKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export async function computeIssueMetrics(window: RangeWindow): Promise<IssueMetric> {
  const createdWhere = window.from
    ? { createdAt: { gte: window.from, lte: window.to ?? undefined } }
    : {};
  const activeWhere = window.from
    ? {
        createdAt: { gte: window.from, lte: window.to ?? undefined },
        status: { in: ACTIVE_STATUSES },
      }
    : { status: { in: ACTIVE_STATUSES } };

  const [total, active, resolved, rejected, byStatus, byCategory, byDepartment, overTimeRows, authorities] =
    await Promise.all([
      prisma.issue.count({ where: createdWhere }),
      prisma.issue.count({ where: activeWhere }),
      prisma.issue.count({ where: { ...(window.from ? createdWhere : {}), status: 'RESOLVED' } }),
      prisma.issue.count({ where: { ...(window.from ? createdWhere : {}), status: 'REJECTED' } }),
      prisma.issue.groupBy({ by: ['status'], where: window.from ? createdWhere : undefined, _count: { _all: true } }),
      prisma.issue.groupBy({ by: ['category'], where: window.from ? createdWhere : undefined, _count: { _all: true } }),
      prisma.issue.groupBy({
        by: ['authorityId'],
        where: window.from
          ? { ...createdWhere, authorityId: { not: null } }
          : { authorityId: { not: null } },
        _count: { _all: true },
      }),
      prisma.$queryRaw<DayKeyRow[]>(
        window.from
          ? Prisma.sql`
              SELECT date_trunc('day', "createdAt") AS day, count(*)::int AS value
              FROM "Issue"
              WHERE "createdAt" >= ${window.from} AND "createdAt" <= ${window.to}
              GROUP BY 1 ORDER BY 1
            `
          : Prisma.sql`
              SELECT date_trunc('day', "createdAt") AS day, count(*)::int AS value
              FROM "Issue"
              GROUP BY 1 ORDER BY 1
            `,
      ),
      prisma.authority.findMany({ select: { id: true, name: true, department: { select: { name: true } } } }),
    ]);

  const deptMap = new Map(authorities.map((a) => [a.id, a]));

  // ---- Trend: current vs previous equivalent window ----
  let trend: MetricTrend = { current: total, previous: total, percentage: 0, direction: 'STABLE' };
  if (window.from) {
    const prev = previousWindow(window);
    if (prev) {
      const prevTotal = await prisma.issue.count({
        where: { createdAt: { gte: prev.from, lte: prev.to } },
      });
      trend = {
        current: total,
        previous: prevTotal,
        percentage: calculateTrend(total, prevTotal).percentage,
        direction: calculateTrend(total, prevTotal).direction,
      };
    }
  }

  // ---- Zero-filled daily series ----
  const counts = new Map(overTimeRows.map((r) => [dayKey(r.day), r.value]));
  const overTime: IssueMetric['overTime'] = [];
  if (window.from) {
    for (let offset = window.days - 1; offset >= 0; offset -= 1) {
      const key = dayKey(new Date(Date.now() - offset * 24 * 60 * 60 * 1000));
      overTime.push({ day: key, value: counts.get(key) ?? 0 });
    }
  }

  return {
    total,
    active,
    resolved,
    rejected,
    byStatus: byStatus.map((r) => ({ status: r.status, count: r._count._all })),
    byCategory: byCategory.map((r) => ({
      category: r.category,
      count: r._count._all,
      label: CATEGORY_LABELS[r.category] ?? r.category,
    })),
    byDepartment: byDepartment.map((r) => {
      const dept = r.authorityId ? deptMap.get(r.authorityId) : undefined;
      return {
        authorityId: r.authorityId,
        label: dept?.department?.name ?? dept?.name ?? 'Unassigned',
        count: r._count._all,
      };
    }),
    overTime,
    trend,
  };
}
