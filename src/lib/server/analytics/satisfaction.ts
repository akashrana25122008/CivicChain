/**
 * Phase 19 — Analytics Engine: community satisfaction analytics.
 *
 * Drives satisfaction from real community signals — typed Votes and the karma
 * ledger — rather than invented surveys. Net satisfaction is the approving
 * (CONFIRM + SUPPORT) share of all votes; karma totals quantify community
 * engagement momentum.
 */

import { prisma } from '@/lib/db';
import type { RangeWindow, SatisfactionMetric } from './types';

export async function computeSatisfactionMetrics(window: RangeWindow): Promise<SatisfactionMetric> {
  const voteWhere = window.from ? { createdAt: { gte: window.from, lte: window.to ?? undefined } } : {};
  const karmaWhere = window.from
    ? { createdAt: { gte: window.from, lte: window.to ?? undefined } }
    : { points: { gt: 0 } };

  const [byType, karmaSum] = await Promise.all([
    prisma.vote.groupBy({ by: ['type'], where: window.from ? voteWhere : undefined, _count: { _all: true } }),
    prisma.karmaEvent.aggregate({ where: window.from ? karmaWhere : { points: { gt: 0 } }, _sum: { points: true } }),
  ]);

  const counts: Record<string, number> = {};
  let total = 0;
  for (const row of byType) {
    counts[row.type] = row._count._all;
    total += row._count._all;
  }

  const confirmVotes = counts.CONFIRM ?? 0;
  const supportVotes = counts.SUPPORT ?? 0;
  const disputeVotes = counts.DISPUTE ?? 0;
  const duplicateVotes = counts.DUPLICATE ?? 0;

  return {
    confirmVotes,
    supportVotes,
    disputeVotes,
    duplicateVotes,
    totalVotes: total,
    netSatisfactionPct:
      total > 0 ? Math.round(((confirmVotes + supportVotes) / total) * 10000) / 100 : null,
    totalKarmaAwarded: karmaSum._sum.points ?? 0,
  };
}
