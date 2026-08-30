import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, ApiError, notFound, forbidden } from '@/lib/server/api';
import { requireUser } from '@/lib/server/session';
import { recordAudit } from '@/lib/server/audit';
import { createNotification } from '@/lib/server/notify';
import { serializeIssueDetail } from '@/lib/issues/serialize';
import { STATUS_LABELS } from '@/lib/issues/mapping';
import { prisma } from '@/lib/db';
import { IssueStatus } from '../../../../../generated/prisma/client';

export interface RouteContext {
  params: Promise<{ id: string }>;
}

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
      }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

const VALID_STATUSES = new Set<string>(Object.values(IssueStatus));

function parseStatus(input: string): IssueStatus {
  if (!VALID_STATUSES.has(input)) {
    throw new ApiError(400, 'INVALID_INPUT', `Unknown status "${input}".`);
  }
  return input as IssueStatus;
}

export async function PATCH(request: NextRequest, ctx: RouteContext) {
  try {
    const actor = await requireUser();
    const { id } = await ctx.params;

    let body: { status?: unknown };
    try {
      body = await request.json();
    } catch {
      throw new ApiError(400, 'INVALID_INPUT', 'Request body must be JSON.');
    }
    if (typeof body.status !== 'string') {
      throw new ApiError(400, 'INVALID_INPUT', 'Status change requires a "status" field.');
    }
    const next = parseStatus(body.status);

    const issue = await prisma.issue.findUnique({ where: { id } });
    if (!issue) throw notFound('Report');

    // Role gate (against the live DB):
    //  - ADMIN: any issue.
    //  - AUTHORITY: only issues assigned to their own authority.
    if (actor.role === 'ADMIN') {
      // allowed
    } else if (actor.role === 'AUTHORITY') {
      const ownAuthority = await prisma.authority.findUnique({ where: { userId: actor.id } });
      if (!ownAuthority || ownAuthority.id !== issue.authorityId) {
        throw forbidden();
      }
    } else {
      throw forbidden();
    }

    if (next === issue.status) {
      return NextResponse.json({ unchanged: true });
    }

    const updated = await prisma.issue.update({
      where: { id },
      data: { status: next },
      include: ISSUE_INCLUDE,
    });

    await recordAudit({
      actorId: actor.id,
      issueId: issue.id,
      action: 'STATUS_CHANGED',
      entityType: 'Issue',
      entityId: issue.id,
      metadata: { from: issue.status, to: next },
    });

    if (issue.reporterId !== actor.id) {
      await createNotification({
        userId: issue.reporterId,
        issueId: issue.id,
        type: 'STATUS_CHANGED',
        title: `Report ${issue.publicId} is now ${STATUS_LABELS[next] ?? next}`,
        message: `Status changed from ${STATUS_LABELS[issue.status] ?? issue.status} to ${STATUS_LABELS[next] ?? next}.`,
      });
    }

    return NextResponse.json({
      issue: serializeIssueDetail({
        issue: updated,
        authority: updated.authority,
        promise: updated.promise,
        evidence: updated.evidence,
        auditLogs: updated.auditLogs,
        viewerId: actor.id,
      }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}