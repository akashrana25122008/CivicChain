/**
 * Phase 19 — Analytics Engine: duplicate analytics.
 *
 * Measures how effectively the duplicate engine clusters individual reports
 * into Incidents. Coverage = share of in-window reports linked to an Incident;
 * cluster-size distribution + average reports-per-incident show consolidation
 * depth.
 */

import { prisma } from '@/lib/db';
import { Prisma } from '../../../../generated/prisma/client';
import type { DuplicateMetric, RangeWindow } from './types';

export async function computeDuplicateMetrics(window: RangeWindow): Promise<DuplicateMetric> {
  const issueWhere = window.from
    ? { createdAt: { gte: window.from, lte: window.to ?? undefined } }
    : {};

  const [totalIssues, incidentCount, incidents, ms_size] = await Promise.all([
    prisma.issue.count({ where: issueWhere }),
    prisma.incident.count(),
    prisma.incident.findMany({
      select: { _count: { select: { issues: { where: issueWhere } } } },
    }),
    prisma.$queryRaw<Array<{ n: number; cnt: number }>>`
      SELECT size AS n, COUNT(*)::int AS cnt
      FROM (SELECT "incidentId", COUNT(*)::int AS size
            FROM "Issue" WHERE "incidentId" IS NOT NULL ${window.from ? Prisma.sql`AND "createdAt" >= ${window.from} AND "createdAt" <= ${window.to}` : Prisma.empty}
            GROUP BY "incidentId") s
      GROUP BY size
      ORDER BY size
    `,
  ]);

  // Reports that belong to an incident sized within the window.
  const sizedIssues = incidents.reduce((sum, inc) => sum + inc._count.issues, 0);
  const duplicateCoveragePct =
    totalIssues > 0 ? Math.round((sizedIssues / totalIssues) * 10000) / 100 : null;

  const totalReportsInIncidents = incidents.reduce(
    (sum, inc) => sum + inc._count.issues,
    0,
  );

  return {
    totalIncidents: incidentCount,
    duplicateCoveragePct,
    countsByIncidentSize: ms_size.map((r) => ({ size: r.n, incidentCount: r.cnt })),
    avgReportsPerIncident:
      incidentCount > 0
        ? Math.round((totalReportsInIncidents / incidentCount) * 100) / 100
        : null,
    duplicateMarkedReports: totalReportsInIncidents,
  };
}
