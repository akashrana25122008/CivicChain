/**
 * Phase 19 — Analytics Engine: escalation metrics.
 *
 * Escalation ladder activity within the window: volume, active vs resolved,
 * per-level distribution, average escalations per issue, and how often
 * escalations get resolved.
 */

import { prisma } from '@/lib/db';
import { EscalationStatus } from '../../../../generated/prisma/client';
import type { EscalationMetric, RangeWindow } from './types';

export async function computeEscalationMetrics(window: RangeWindow): Promise<EscalationMetric> {
  const createdWhere = window.from
    ? { createdAt: { gte: window.from, lte: window.to ?? undefined } }
    : {};
  const activeWhere = window.from
    ? {
        createdAt: { gte: window.from, lte: window.to ?? undefined },
        status: { in: [EscalationStatus.OPEN, EscalationStatus.IN_PROGRESS] },
      }
    : { status: { in: [EscalationStatus.OPEN, EscalationStatus.IN_PROGRESS] } };

  const [total, active, resolved, byLevel, issuesWithEsc] = await Promise.all([
    prisma.escalation.count({ where: createdWhere }),
    prisma.escalation.count({ where: activeWhere }),
    prisma.escalation.count({ where: { ...createdWhere, status: 'RESOLVED' } }),
    prisma.escalation.groupBy({ by: ['level'], where: window.from ? createdWhere : undefined, _count: { _all: true }, orderBy: { level: 'asc' } }),    prisma.escalation.groupBy({
      by: ['issueId'],
      where: window.from ? createdWhere : undefined,
      _count: { _all: true },
    }),
  ]);

  const escIssues = issuesWithEsc.length;
  const avgEscalationsPerIssue = escIssues > 0 ? Math.round((total / escIssues) * 100) / 100 : null;

  return {
    total,
    active,
    resolved,
    byLevel: byLevel.map((r) => ({ level: r.level, count: r._count._all })),
    avgEscalationsPerIssue,
    escalationsResolvedPct:
      total > 0 ? Math.round((resolved / total) * 10000) / 100 : null,
  };
}
