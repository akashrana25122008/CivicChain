import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, notFound } from '@/lib/server/api';
import { requireUser } from '@/lib/server/session';
import { serializeIssueDetail } from '@/lib/issues/serialize';
import { allowedTransitionsFor } from '@/lib/issues/transition';
import { patchReportHttp } from '@/lib/issues/http';
import { prisma } from '@/lib/db';

export interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * /api/issues/[id]
 * GET: community detail — any authenticated user may view civic issue
 * metadata (transparency). Private evidence files are independently gated by
 * /api/evidence/[id]/file.
 * PATCH: status updates under the Phase 1 role model (shared handler).
 */
const ISSUE_INCLUDE = {
  authority: true,
  promise: true,
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

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const viewer = await requireUser();
    const { id } = await ctx.params;
    const issue = await prisma.issue.findUnique({ where: { id }, include: ISSUE_INCLUDE });
    if (!issue) throw notFound('Report');
    return NextResponse.json({
      issue: serializeIssueDetail({
        issue,
        authority: issue.authority,
        promise: issue.promise,
        evidence: issue.evidence,
        auditLogs: issue.auditLogs,
        viewerId: viewer.id,
        allowedTransitions: await allowedTransitionsFor(viewer, issue),
      }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  return patchReportHttp(request, id);
}