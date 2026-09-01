import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/server/api';
import { requireUser } from '@/lib/server/session';
import { prisma } from '@/lib/db';
import { formatRelativeTime } from '@/lib/utils';
import type { EscalationItem } from '@/lib/issues/types';
import { EscalationStatus } from '../../../../generated/prisma/client';

/**
 * GET /api/my-escalations — escalations raised on the citizen's own reports
 * (Phase 24). Real Escalation rows filtered through the issue's reporter.
 * Stats (total, by level, open) are derived from the same rows.
 */
export async function GET() {
  try {
    const viewer = await requireUser();

    const rows = await prisma.escalation.findMany({
      where: { issue: { reporterId: viewer.id } },
      include: {
        issue: { select: { publicId: true, title: true, status: true } },
        caller: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const items: EscalationItem[] = rows.map((esc) => ({
      id: esc.id,
      issueId: esc.issueId,
      issuePublicId: esc.issue?.publicId ?? '',
      issueTitle: esc.issue?.title ?? 'Report',
      issueStatus: esc.issue?.status ?? 'OPEN',
      level: esc.level,
      status: esc.status,
      reason: esc.reason ?? null,
      caller: esc.caller ? esc.caller.name ?? esc.caller.email : null,
      createdAt: esc.createdAt.toISOString(),
      timeLabel: formatRelativeTime(esc.createdAt),
    }));

    const stats = {
      total: items.length,
      open: items.filter((i) =>
        i.status === EscalationStatus.OPEN || i.status === EscalationStatus.IN_PROGRESS,
      ).length,
      byLevel: { 1: 0, 2: 0, 3: 0, 4: 0 },
    };
    for (const item of items) {
      if (item.level >= 1 && item.level <= 4) {
        stats.byLevel[item.level as 1 | 2 | 3 | 4] += 1;
      }
    }

    return NextResponse.json({ items, stats });
  } catch (error) {
    return handleApiError(error);
  }
}