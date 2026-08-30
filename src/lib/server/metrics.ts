import { prisma } from '@/lib/db';
import { Prisma } from '../../../generated/prisma/client';
import { calculateSlaState } from '@/lib/sla/state';

export interface ResolutionQuery {
  authorityId?: string | null;
}

/**
 * Average time (whole minutes) between a report's creation and its resolution,
 * derived from the real audit trail ("STATUS_CHANGED" → RESOLVED). Null when
 * nothing has ever been resolved.
 */
export async function avgResolutionMinutes(
  options: ResolutionQuery = {},
): Promise<number | null> {
  const rows = await prisma.$queryRaw<Array<{ avg_minutes: number | null }>>(Prisma.sql`
    SELECT AVG(EXTRACT(EPOCH FROM (al."createdAt" - i."createdAt")) / 60)::float AS avg_minutes
    FROM "AuditLog" al
    JOIN "Issue" i ON i.id = al."issueId"
    WHERE al.action = 'STATUS_CHANGED'
      AND al.metadata->>'to' = 'RESOLVED'
      ${options.authorityId ? Prisma.sql`AND i."authorityId" = ${options.authorityId}` : Prisma.empty}
  `);
  const value = rows[0]?.avg_minutes;
  return value == null ? null : Math.round(value);
}

function dayKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Report-creation counts per calendar day over the trailing `days` window,
 * zero-filled so chart consumers never have to synthesize gaps.
 */
export async function createdIssuesByDay(options: {
  authorityId?: string | null;
  days: number;
}): Promise<Array<{ day: string; created: number }>> {
  const since = new Date(Date.now() - options.days * 24 * 60 * 60 * 1000);
  const rows = await prisma.$queryRaw<Array<{ day: Date; created: number }>>(Prisma.sql`
    SELECT date_trunc('day', "createdAt") AS day, count(*)::int AS created
    FROM "Issue"
    WHERE "createdAt" >= ${since}
      ${options.authorityId ? Prisma.sql`AND "authorityId" = ${options.authorityId}` : Prisma.empty}
    GROUP BY 1
    ORDER BY 1
  `);

  const counts = new Map(rows.map((r) => [dayKey(r.day), r.created]));
  const out: Array<{ day: string; created: number }> = [];
  for (let offset = options.days - 1; offset >= 0; offset -= 1) {
    const key = dayKey(new Date(Date.now() - offset * 24 * 60 * 60 * 1000));
    out.push({ day: key, created: counts.get(key) ?? 0 });
  }
  return out;
}
/**
 * Real SLA health distribution (ON_TRACK / AT_RISK / BREACHED) for an
 * authority's active promises (Phase 6). States are computed via the shared
 * SLA evaluator, never fabricated. RESOLVED/COMPLETED promises are excluded
 * from the distribution (they are no longer owed).
 */
export async function slaHealthForAuthority(options: {
  authorityId: string;
}): Promise<{ onTrack: number; atRisk: number; breached: number }> {
  const promises = await prisma.promise.findMany({
    where: {
      authorityId: options.authorityId,
      status: { in: ['OPEN', 'IN_PROGRESS'] },
    },
    select: {
      deadline: true,
      issue: { select: { createdAt: true, status: true } },
    },
  });

  const counts = { onTrack: 0, atRisk: 0, breached: 0 };
  for (const p of promises) {
    if (!p.issue) continue;
    const { slaState } = calculateSlaState({
      deadline: p.deadline,
      createdAt: p.issue.createdAt,
      resolved: p.issue.status === 'RESOLVED' || p.issue.status === 'REJECTED',
    });
    if (slaState === 'ON_TRACK') counts.onTrack += 1;
    else if (slaState === 'AT_RISK') counts.atRisk += 1;
    else if (slaState === 'BREACHED') counts.breached += 1;
    // RESOLVED is excluded (not an active promise).
  }
  return counts;
}
