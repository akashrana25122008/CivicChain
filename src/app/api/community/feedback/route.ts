import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/server/api';
import { requireUser } from '@/lib/server/session';
import { prisma } from '@/lib/db';
import { CATEGORY_LABELS } from '@/lib/issues/mapping';
import type { CommunityFeedbackItem } from '@/lib/issues/types';

/**
 * GET /api/community/feedback — real community-vote rollups (Phase 24).
 * Groups actual Vote rows per issue (CONFIRM / SUPPORT / DISPUTE) and derives
 * the shares from real counts. Issues without any votes never appear; stats are
 * computed from the same rows — no hardcoded percentages.
 */
export async function GET() {
  try {
    await requireUser();

    const rows = await prisma.vote.groupBy({
      by: ['issueId', 'type'],
      _count: { _all: true },
    });

    const issueIds = [...new Set(rows.map((r) => r.issueId))];
    if (issueIds.length === 0) {
      return NextResponse.json({ items: [], stats: { totalIssues: 0, totalVotes: 0, confirmPct: null, supportPct: null, disputePct: null } });
    }

    const issues = await prisma.issue.findMany({
      where: { id: { in: issueIds } },
      select: { id: true, publicId: true, title: true, category: true },
      orderBy: { createdAt: 'desc' },
    });

    const counts = new Map<string, { confirm: number; support: number; dispute: number; duplicate: number; total: number }>();
    for (const row of rows) {
      const bucket = counts.get(row.issueId) ?? { confirm: 0, support: 0, dispute: 0, duplicate: 0, total: 0 };
      const n = row._count._all;
      if (row.type === 'CONFIRM') bucket.confirm += n;
      else if (row.type === 'SUPPORT') bucket.support += n;
      else if (row.type === 'DISPUTE') bucket.dispute += n;
      else bucket.duplicate += n;
      bucket.total += n;
      counts.set(row.issueId, bucket);
    }

    const items: CommunityFeedbackItem[] = issues
      .filter((issue) => counts.has(issue.id))
      .map((issue) => {
        const c = counts.get(issue.id)!;
        return {
          id: issue.id,
          publicId: issue.publicId,
          title: issue.title,
          category: issue.category,
          categoryLabel: CATEGORY_LABELS[issue.category] ?? issue.category,
          totalVotes: c.total,
          confirmVotes: c.confirm,
          supportVotes: c.support,
          disputeVotes: c.dispute,
          confirmPct: c.total > 0 ? Math.round((c.confirm / c.total) * 100) : null,
          supportPct: c.total > 0 ? Math.round((c.support / c.total) * 100) : null,
          disputePct: c.total > 0 ? Math.round((c.dispute / c.total) * 100) : null,
        };
      })
      .sort((a, b) => b.totalVotes - a.totalVotes);

    const totalVotes = items.reduce((s, i) => s + i.totalVotes, 0);
    const stats = {
      totalIssues: items.length,
      totalVotes,
      confirmPct: totalVotes > 0 ? Math.round((items.reduce((s, i) => s + i.confirmVotes, 0) / totalVotes) * 100) : null,
      supportPct: totalVotes > 0 ? Math.round((items.reduce((s, i) => s + i.supportVotes, 0) / totalVotes) * 100) : null,
      disputePct: totalVotes > 0 ? Math.round((items.reduce((s, i) => s + i.disputeVotes, 0) / totalVotes) * 100) : null,
    };

    return NextResponse.json({ items, stats });
  } catch (error) {
    return handleApiError(error);
  }
}