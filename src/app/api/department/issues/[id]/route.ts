import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, notFound, forbidden } from '@/lib/server/api';
import { requireUser } from '@/lib/server/session';
import { requireOwnAuthority, authorityOwnsIssue } from '@/lib/server/dept';
import { serializeIssueDetail } from '@/lib/issues/serialize';
import { allowedTransitionsFor } from '@/lib/issues/transition';
import { prisma } from '@/lib/db';

export interface RouteContext {
  params: Promise<{ id: string }>;
}

const DETAIL_INCLUDE = {
  authority: true,
  promise: true,
  reporter: { select: { name: true, email: true } },
  evidence: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      verifications: {
        orderBy: { createdAt: 'desc' as const },
        include: { verifier: { select: { name: true, email: true } } },
      },
    },
  },
  auditLogs: { orderBy: { createdAt: 'asc' as const } },
} as const;

/** Department-scoped issue detail: visible only to the authority owning the issue. */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const user = await requireUser();
    const authority = await requireOwnAuthority(user);
    const { id } = await ctx.params;

    const issue = await prisma.issue.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    if (!issue) throw notFound('Report');
    if (!authorityOwnsIssue(authority, issue.authorityId)) throw forbidden();

    return NextResponse.json({
      issue: serializeIssueDetail({
        issue,
        authority: issue.authority,
        promise: issue.promise,
        evidence: issue.evidence,
        auditLogs: issue.auditLogs,
        viewerId: user.id,
        revealReporter: true,
        revealContact: true,
        reporter: issue.reporter,
        allowedTransitions: await allowedTransitionsFor(user, issue),
      }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}