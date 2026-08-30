import { NextRequest, NextResponse } from 'next/server';
import {
  handleApiError,
  ApiError,
  badRequest,
  notFound,
  forbidden,
} from '@/lib/server/api';
import { requireUser } from '@/lib/server/session';
import { requireOwnAuthority, authorityOwnsIssue } from '@/lib/server/dept';
import { recordAudit } from '@/lib/server/audit';
import { formatRelativeTime } from '@/lib/utils';
import type { EscalationItem } from '@/lib/issues/types';
import { prisma } from '@/lib/db';

export interface RouteContext {
  params: Promise<{ id: string }>;
}

const ESCALATION_INCLUDE = {
  caller: { select: { name: true, email: true } },
  issue: { select: { publicId: true, title: true, status: true } },
} as const;

function toEscalationItem(row: {
  id: string;
  issueId: string;
  level: number;
  status: string;
  reason: string | null;
  createdAt: Date;
  caller: { name: string | null; email: string } | null;
  issue: { publicId: string; title: string; status: string } | null;
}): EscalationItem {
  return {
    id: row.id,
    issueId: row.issueId,
    issuePublicId: row.issue?.publicId ?? row.issueId,
    issueTitle: row.issue?.title ?? 'Unknown report',
    issueStatus: row.issue?.status ?? 'UNKNOWN',
    level: row.level,
    status: row.status,
    reason: row.reason,
    caller: row.caller ? row.caller.name ?? row.caller.email : null,
    createdAt: row.createdAt.toISOString(),
    timeLabel: formatRelativeTime(row.createdAt),
  };
}

/** Close an escalation on one of this department's own reports. */
export async function PATCH(request: NextRequest, ctx: RouteContext) {
  try {
    const user = await requireUser();
    const authority = await requireOwnAuthority(user);
    const { id } = await ctx.params;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(400, 'INVALID_INPUT', 'Request body must be JSON.');
    }
    if (body.status !== 'RESOLVED' && body.status !== 'IN_PROGRESS') {
      throw badRequest('"status" must be RESOLVED or IN_PROGRESS.');
    }

    const escalation = await prisma.escalation.findUnique({
      where: { id },
      include: { issue: { select: { authorityId: true } } },
    });
    if (!escalation) throw notFound('Escalation');
    if (!authorityOwnsIssue(authority, escalation.issue?.authorityId ?? null)) {
      throw forbidden();
    }

    const updated = await prisma.escalation.update({
      where: { id },
      data: { status: body.status },
      include: ESCALATION_INCLUDE,
    });

    await recordAudit({
      actorId: user.id,
      issueId: escalation.issueId,
      action: 'STATUS_CHANGED',
      entityType: 'Escalation',
      entityId: escalation.id,
      metadata: { from: escalation.status, to: body.status, level: escalation.level },
    });

    return NextResponse.json({ escalation: toEscalationItem(updated) });
  } catch (error) {
    return handleApiError(error);
  }
}