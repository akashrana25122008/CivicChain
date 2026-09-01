/**
 * Phase 19 — Analytics Engine: SLA analytics.
 *
 * Distribution of active promises across the canonical SLA states (ON_TRACK /
 * AT_RISK / BREACHED) evaluated via the shared SLA evaluator — never
 * fabricated. Breach rate and per-department breakdown give operators a single
 * live view of promise health inside the analytics window.
 */

import { prisma } from '@/lib/db';
import { calculateSlaState, type SlaState } from '@/lib/sla/state';
import type { RangeWindow, SlaMetric } from './types';

interface RawPromise {
  deadline: Date;
  createdAt: Date;
  status: string;
  authorityId: string | null;
}

export async function computeSlaMetrics(window: RangeWindow): Promise<SlaMetric> {
  const promises = await prisma.promise.findMany({
    where: {
      status: { in: ['OPEN', 'IN_PROGRESS'] },
      ...(window.from
        ? { createdAt: { gte: window.from, lte: window.to ?? undefined } }
        : {}),
    },
    select: {
      deadline: true,
      createdAt: true,
      status: true,
      authorityId: true,
      issue: { select: { status: true } },
    },
  });

  const raw = promises as RawPromise[];

  let onTrack = 0;
  let atRisk = 0;
  let breached = 0;
  const byDepartment = new Map<string | null, { breached: number; atRisk: number; onTrack: number }>();

  for (const p of raw) {
    const state = slaStateOf(p);
    if (state === 'ON_TRACK') onTrack += 1;
    else if (state === 'AT_RISK') atRisk += 1;
    else if (state === 'BREACHED') breached += 1;

    const bucket = byDepartment.get(p.authorityId) ?? { breached: 0, atRisk: 0, onTrack: 0 };
    if (state === 'ON_TRACK') bucket.onTrack += 1;
    else if (state === 'AT_RISK') bucket.atRisk += 1;
    else if (state === 'BREACHED') bucket.breached += 1;
    byDepartment.set(p.authorityId, bucket);
  }

  const authorities = await prisma.authority.findMany({
    select: { id: true, name: true, department: { select: { name: true } } },
  });
  const deptMap = new Map(authorities.map((a) => [a.id, a]));

  const activePromises = onTrack + atRisk + breached;

  return {
    onTrack,
    atRisk,
    breached,
    activePromises,
    breachRatePct:
      activePromises > 0 ? Math.round((breached / activePromises) * 10000) / 100 : null,
    byDepartment: Array.from(byDepartment.entries()).map(([authorityId, counts]) => {
      const dept = authorityId ? deptMap.get(authorityId) : undefined;
      return {
        authorityId,
        label: dept?.department?.name ?? dept?.name ?? 'Unassigned',
        breached: counts.breached,
        atRisk: counts.atRisk,
        onTrack: counts.onTrack,
      };
    }),
  };
}

function slaStateOf(p: RawPromise): SlaState | 'RESOLVED' {
  const issueStatus = (p as { issue?: { status?: string } | null }).issue?.status;
  const resolved = issueStatus === 'RESOLVED' || issueStatus === 'REJECTED';
  const snap = calculateSlaState({ deadline: p.deadline, createdAt: p.createdAt, resolved });
  return snap.slaState;
}
