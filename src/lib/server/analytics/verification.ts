/**
 * Phase 19 — Analytics Engine: verification analytics.
 *
 * The citizen/authority verification funnel — pending vs verified vs rejected
 * and how long verification custody takes on average (created -> final state).
 * No fabricated states; everything is read from real Verification rows.
 */

import { prisma } from '@/lib/db';
import { Prisma } from '../../../../generated/prisma/client';
import type { RangeWindow, VerificationMetric } from './types';

interface AvgRow {
  avg_minutes: number | null;
}

export async function computeVerificationMetrics(window: RangeWindow): Promise<VerificationMetric> {
  const createdWhere = window.from
    ? { createdAt: { gte: window.from, lte: window.to ?? undefined } }
    : {};
  const finalStateWhere = window.from
    ? {
        status: { in: ['VERIFIED', 'REJECTED'] },
        ...createdWhere,
      }
    : { status: { in: ['VERIFIED', 'REJECTED'] } };

  const [pending, verified, rejected, avgTime] = await Promise.all([
    prisma.verification.count({ where: { ...createdWhere, status: 'PENDING' } }),
    prisma.verification.count({ where: { ...createdWhere, status: 'VERIFIED' } }),
    prisma.verification.count({ where: { ...createdWhere, status: 'REJECTED' } }),
    avgVerifyTimeBySql(window),
  ]);

  const total = pending + verified + rejected;
  void finalStateWhere;

  return {
    pending,
    verified,
    rejected,
    total,
    verificationRatePct:
      total > 0 ? Math.round((verified / total) * 10000) / 100 : null,
    avgVerifyTimeMinutes: avgTime,
  };
}

/** Minutes from verification creation to its final VERIFIED/REJECTED state. */
async function avgVerifyTimeBySql(window: RangeWindow): Promise<number | null> {
  const rows = await prisma.$queryRaw<AvgRow[]>(Prisma.sql`
    SELECT AVG(EXTRACT(EPOCH FROM (v."updatedAt" - v."createdAt")) / 60)::float AS avg_minutes
    FROM "Verification" v
    WHERE v.status IN ('VERIFIED', 'REJECTED')
      AND v."updatedAt" >= v."createdAt"
      ${window.from ? Prisma.sql`AND v."createdAt" >= ${window.from} AND v."createdAt" <= ${window.to}` : Prisma.empty}
  `);
  const value = rows[0]?.avg_minutes;
  return value == null ? null : Math.round(value);
}
