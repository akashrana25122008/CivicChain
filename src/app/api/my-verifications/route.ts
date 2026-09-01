import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/server/api';
import { requireUser } from '@/lib/server/session';
import { prisma } from '@/lib/db';
import { CATEGORY_LABELS, STATUS_LABELS } from '@/lib/issues/mapping';
import type { MyVerificationItem } from '@/lib/issues/types';
import { IssueStatus } from '../../../../generated/prisma/client';

/**
 * GET /api/my-verifications — the citizen's resolution-verification surface
 * (Phase 24). Lists the reporter's issues that reached a terminal-resolved
 * lifecycle (RESOLVED awaiting their confirmation, or VERIFIED once confirmed).
 * The page drives real POST /api/issues/:id/verify calls; nothing is fabricated.
 */
export async function GET() {
  try {
    const viewer = await requireUser();

    const issues = await prisma.issue.findMany({
      where: {
        reporterId: viewer.id,
        status: { in: [IssueStatus.RESOLVED, IssueStatus.VERIFIED] },
      },
      include: {
        authority: { include: { department: { select: { name: true } } } },
        promise: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    const items: MyVerificationItem[] = issues.map((issue) => ({
      id: issue.id,
      publicId: issue.publicId,
      title: issue.title,
      category: issue.category,
      categoryLabel: CATEGORY_LABELS[issue.category] ?? issue.category,
      status: issue.status,
      statusLabel: STATUS_LABELS[issue.status] ?? issue.status,
      authority: issue.authority?.department?.name ?? issue.authority?.name ?? null,
      promiseLabel: issue.promise
        ? `Promise · ${issue.promise.deadline.toISOString()}`
        : null,
      verificationState:
        issue.status === IssueStatus.VERIFIED ? 'VERIFIED' : 'PENDING',
      resolvedAt: issue.updatedAt.toISOString(),
    }));

    const stats = {
      total: items.length,
      pending: items.filter((i) => i.verificationState === 'PENDING').length,
      verified: items.filter((i) => i.verificationState === 'VERIFIED').length,
    };

    return NextResponse.json({ items, stats });
  } catch (error) {
    return handleApiError(error);
  }
}