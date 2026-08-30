import { NextResponse } from 'next/server';
import { handleApiError, notFound, forbidden } from '@/lib/server/api';
import { requireUser } from '@/lib/server/session';
import { serializeIssueDetail } from '@/lib/issues/serialize';
import { prisma } from '@/lib/db';

export interface RouteContext {
  params: Promise<{ id: string }>;
}

const ISSUE_INCLUDE = {
  authority: true,
  promise: true,
  evidence: { orderBy: { createdAt: 'asc' as const } },
  auditLogs: { orderBy: { createdAt: 'asc' as const } },
} as const;

/**
 * Owner-only detail view (ADMIN may inspect). Primary identity check is
 * reporterId in the database versus the authenticated session user.
 */
export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const viewer = await requireUser();
    const { id } = await ctx.params;
    const issue = await prisma.issue.findUnique({ where: { id }, include: ISSUE_INCLUDE });
    if (!issue) throw notFound('Report');
    if (issue.reporterId !== viewer.id && viewer.role !== 'ADMIN') {
      throw forbidden();
    }
    return NextResponse.json({
      issue: serializeIssueDetail({
        issue,
        authority: issue.authority,
        promise: issue.promise,
        evidence: issue.evidence,
        auditLogs: issue.auditLogs,
        viewerId: viewer.id,
      }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}