/**
 * Phase 19 — Analytics Engine: resolution analytics.
 *
 * How effectively and quickly the platform resolves reports within a window.
 * Resolution time and first-response time are derived from the real AuditEvent
 * trail — never synthesized — while the reopen metric uses lifecycle
 * transitions (RESOLVED -> back to an active status) recorded in the audit log.
 */

import { prisma } from '@/lib/db';
import { Prisma } from '../../../../generated/prisma/client';
import type { MetricTrend, RangeWindow, ResolutionMetric } from './types';
import { previousWindow } from './range';
import { calculateTrend } from '@/lib/risk/trend';

interface AvgRow {
  avg_minutes: number | null;
}

const ACTIVE_STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS'];

function createdRange(window: RangeWindow) {
  if (!window.from) return {};
  return { createdAt: { gte: window.from, lte: window.to ?? undefined } };
}

export async function computeResolutionMetrics(window: RangeWindow): Promise<ResolutionMetric> {
  const createdWhere = createdRange(window);
  const [total, resolved, avgMinutes, avgFirstResponse, reopen] = await Promise.all([
    prisma.issue.count({ where: createdWhere }),
    prisma.issue.count({ where: { ...createdWhere, status: 'RESOLVED' } }),
    avgBySql(window),
    avgFirstResponseBySql(window),
    countReopens(window),
  ]);

  let trend: MetricTrend | null = null;
  if (window.from) {
    const prev = previousWindow(window);
    if (prev) {
      const prevRate = await resolutionRateSql(prev.from, prev.to);
      const pct = resolved > 0 && total > 0 ? (resolved / total) * 100 : 0;
      if (prevRate !== null) {
        trend = {
          current: Math.round(pct * 100) / 100,
          previous: prevRate,
          percentage: calculateTrend(Math.round(pct * 100) / 100, prevRate).percentage,
          direction: calculateTrend(Math.round(pct * 100) / 100, prevRate).direction,
        };
      }
    }
  }

  const resolutionRatePct =
    total > 0 ? Math.round((resolved / total) * 10000) / 100 : null;

  return {
    resolutionRatePct,
    avgResolutionMinutes: avgMinutes,
    resolvedCount: resolved,
    avgFirstResponseMinutes: avgFirstResponse,
    reopenCount: reopen.count,
    reopenRatePct:
      resolved > 0 ? Math.round((reopen.count / resolved) * 10000) / 100 : null,
    trend,
  };
}

/** Average minutes from issue creation to a RESOLVED status change (audit-derived). */
async function avgBySql(window: RangeWindow): Promise<number | null> {
  const rows = await prisma.$queryRaw<AvgRow[]>(Prisma.sql`
    SELECT AVG(EXTRACT(EPOCH FROM (al."createdAt" - i."createdAt")) / 60)::float AS avg_minutes
    FROM "AuditEvent" al
    JOIN "Issue" i ON i.id = al."issueId"
    WHERE al.action = 'STATUS_CHANGED'
      AND al.metadata->>'to' = 'RESOLVED'
      ${window.from ? Prisma.sql`AND i."createdAt" >= ${window.from} AND i."createdAt" <= ${window.to}` : Prisma.empty}
  `);
  const value = rows[0]?.avg_minutes;
  return value == null ? null : Math.round(value);
}

/** Average minutes from creation to the report first leaving SUBMITTED. */
async function avgFirstResponseBySql(window: RangeWindow): Promise<number | null> {
  const rows = await prisma.$queryRaw<AvgRow[]>(Prisma.sql`
    SELECT AVG(EXTRACT(EPOCH FROM (al."createdAt" - i."createdAt")) / 60)::float AS avg_minutes
    FROM "AuditEvent" al
    JOIN "Issue" i ON i.id = al."issueId"
    WHERE al.action = 'STATUS_CHANGED'
      AND al.metadata->>'from' = 'SUBMITTED'
      ${window.from ? Prisma.sql`AND i."createdAt" >= ${window.from} AND i."createdAt" <= ${window.to}` : Prisma.empty}
  `);
  const value = rows[0]?.avg_minutes;
  return value == null ? null : Math.round(value);
}

/** Count issues that were RESOLVED and later moved back to an active status. */
async function countReopens(window: RangeWindow): Promise<{ count: number }> {
  const rows = await prisma.$queryRaw<Array<{ issue_id: string }>>(Prisma.sql`
    SELECT DISTINCT i.id AS issue_id
    FROM "AuditEvent" al
    JOIN "Issue" i ON i.id = al."issueId"
    WHERE al.action = 'STATUS_CHANGED'
      AND al.metadata->>'from' = 'RESOLVED'
      AND al.metadata->>'to' IN (${Prisma.join(ACTIVE_STATUSES)})
      ${window.from
        ? Prisma.sql`AND al."createdAt" >= ${window.from} AND al."createdAt" <= ${window.to}`
        : Prisma.empty}
  `);
  return { count: rows.length };
}

/** Resolution rate (0-100) for an explicit period; null when no issues. */
async function resolutionRateSql(from: Date, to: Date): Promise<number | null> {
  const [total, resolved] = await Promise.all([
    prisma.issue.count({ where: { createdAt: { gte: from, lte: to } } }),
    prisma.issue.count({ where: { createdAt: { gte: from, lte: to }, status: 'RESOLVED' } }),
  ]);
  if (total <= 0) return null;
  return Math.round((resolved / total) * 10000) / 100;
}
