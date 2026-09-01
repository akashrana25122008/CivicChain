/**
 * Phase 19 — Analytics Engine: AI intelligence analytics.
 *
 * Measures the AI analysis pipeline's real output: completion stats, model
 * confidence, and category accuracy (the model's classified category vs the
 * issue's final reviewed category). Every value reads real AIAnalysis rows;
 * nothing is fabricated when no analysis has run.
 */

import { prisma } from '@/lib/db';
import { Prisma } from '../../../../generated/prisma/client';
import type { AiMetric, RangeWindow } from './types';

export async function computeAiMetrics(window: RangeWindow): Promise<AiMetric> {
  const createdWhere = window.from
    ? { createdAt: { gte: window.from, lte: window.to ?? undefined } }
    : {};

  const [total, completed, failed, pending, confAgg, accuracyRow] = await Promise.all([
    prisma.aIAnalysis.count({ where: createdWhere }),
    prisma.aIAnalysis.count({ where: { ...createdWhere, status: 'COMPLETED' } }),
    prisma.aIAnalysis.count({ where: { ...createdWhere, status: 'FAILED' } }),
    prisma.aIAnalysis.count({ where: { ...createdWhere, status: 'PENDING' } }),
    prisma.aIAnalysis.aggregate({
      where: { ...createdWhere, status: 'COMPLETED', confidence: { not: null } },
      _avg: { confidence: true },
    }),
    categoryAccuracySql(window),
  ]);

  return {
    totalAnalyses: total,
    completed,
    failed,
    pending,
    avgConfidence:
      confAgg._avg.confidence != null
        ? Math.round(confAgg._avg.confidence * 10000) / 10000
        : null,
    categoryAccuracyPct: accuracyRow,
  };
}

/** Share of COMPLETED analyses whose AI category matches the reviewed issue category. */
async function categoryAccuracySql(window: RangeWindow): Promise<number | null> {
  const rows = await prisma.$queryRaw<Array<{ n: number; hit: number }>>(Prisma.sql`
    SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE a.category::text = i.category::text)::int AS hit
    FROM "AIAnalysis" a
    JOIN "Issue" i ON i.id = a."issueId"
    WHERE a.status = 'COMPLETED' AND a.category IS NOT NULL
      ${window.from ? Prisma.sql`AND a."createdAt" >= ${window.from} AND a."createdAt" <= ${window.to}` : Prisma.empty}
  `);
  const total = rows[0]?.n ?? 0;
  if (total <= 0) return null;
  return Math.round(((rows[0]?.hit ?? 0) / total) * 10000) / 100;
}
