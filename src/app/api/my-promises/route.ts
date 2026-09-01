import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/server/api';
import { requireUser } from '@/lib/server/session';
import { prisma } from '@/lib/db';
import { calculateSlaState } from '@/lib/sla/state';
import { formatRelativeTime } from '@/lib/utils';
import { CATEGORY_LABELS, STATUS_LABELS } from '@/lib/issues/mapping';
import type { PromiseItem } from '@/lib/issues/types';
import { IssueStatus, PromiseStatus } from '../../../../generated/prisma/client';

/**
 * GET /api/my-promises — the citizen's own promise ledger (Phase 24).
 * Real commitments with a Promise row, SLA standing computed live against the
 * committed deadline (ON_TRACK / AT_RISK / BREACHED / RESOLVED) plus persisted
 * PromiseStatus. Stats are derived from the same rows — never hardcoded.
 */
export async function GET() {
  try {
    const viewer = await requireUser();

    const issues = await prisma.issue.findMany({
      where: { reporterId: viewer.id, promise: { isNot: null } },
      include: {
        authority: { include: { department: { select: { name: true } } } },
        promise: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const promises: PromiseItem[] = issues.map((issue) => {
      const promise = issue.promise!;
      const resolved =
        issue.status === IssueStatus.RESOLVED ||
        issue.status === IssueStatus.REJECTED ||
        promise.status === PromiseStatus.COMPLETED;
      const snap = calculateSlaState({
        deadline: promise.deadline,
        createdAt: issue.createdAt,
        resolved,
      });
      return {
        id: issue.id,
        publicId: issue.publicId,
        title: issue.title,
        category: issue.category,
        categoryLabel: CATEGORY_LABELS[issue.category] ?? issue.category,
        status: issue.status,
        statusLabel: STATUS_LABELS[issue.status] ?? issue.status,
        authority: issue.authority?.department?.name ?? issue.authority?.name ?? null,
        slaState: snap.slaState,
        slaPctElapsed: snap.slaPctElapsed,
        timeRemainingMs: snap.timeRemainingMs,
        deadline: promise.deadline.toISOString(),
        promiseStatus: promise.status,
        createdAt: issue.createdAt.toISOString(),
        timeLabel: formatRelativeTime(issue.createdAt),
      };
    });

    const stats = { total: promises.length, onTrack: 0, atRisk: 0, breached: 0, resolved: 0 };
    for (const p of promises) {
      if (p.slaState === 'ON_TRACK') stats.onTrack += 1;
      else if (p.slaState === 'AT_RISK') stats.atRisk += 1;
      else if (p.slaState === 'BREACHED') stats.breached += 1;
      else stats.resolved += 1;
    }

    return NextResponse.json({ promises, stats, sampledAt: new Date().toISOString() });
  } catch (error) {
    return handleApiError(error);
  }
}