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
import { createNotification } from '@/lib/server/notify';
import { formatRelativeTime } from '@/lib/utils';
import type { EscalationItem } from '@/lib/issues/types';
import { prisma } from '@/lib/db';

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

/** Escalations raised against this department's own reports. */
export async function GET() {
  try {
    const user = await requireUser();
    const authority = await requireOwnAuthority(user);

    const escalations = await prisma.escalation.findMany({
      where: { issue: { authorityId: authority.id } },
      orderBy: { createdAt: 'desc' },
      include: {
        caller: { select: { name: true, email: true } },
        issue: { select: { publicId: true, title: true, status: true } },
      },
    });

    return NextResponse.json({ escalations: escalations.map(toEscalationItem) });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Raise a new escalation on one of this department's own reports. */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const authority = await requireOwnAuthority(user);

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(400, 'INVALID_INPUT', 'Request body must be JSON.');
    }
    const issueId = body.issueId;
    if (typeof issueId !== 'string' || issueId.length === 0) {
      throw badRequest('A valid "issueId" is required.');
    }
    const reason =
      typeof body.reason === 'string' && body.reason.trim().length > 0
        ? body.reason.trim().slice(0, 1000)
        : null;

    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      select: { id: true, publicId: true, reporterId: true, authorityId: true },
    });
    if (!issue) throw notFound('Report');
    if (!authorityOwnsIssue(authority, issue.authorityId)) throw forbidden();

    const openEscalation = await prisma.escalation.findFirst({
      where: { issueId, status: { in: ['OPEN', 'IN_PROGRESS'] } },
      select: { id: true },
    });
    if (openEscalation) {
      throw badRequest('This report already has an open escalation.');
    }

    const max = await prisma.escalation.aggregate({
      where: { issueId },
      _max: { level: true },
    });
    const level = (max._max.level ?? 0) + 1;

    const escalation = await prisma.escalation.create({
      data: {
        issueId,
        callerId: user.id,
        authorityId: authority.id,
        level,
        status: 'OPEN',
        reason,
      },
      include: {
        caller: { select: { name: true, email: true } },
        issue: { select: { publicId: true, title: true, status: true } },
      },
    });

    await recordAudit({
      actorId: user.id,
      issueId,
      action: 'ESCALATION_CREATED',
      entityType: 'Escalation',
      entityId: escalation.id,
      metadata: { level, reason },
    });

    if (issue.reporterId !== user.id) {
      await createNotification({
        userId: issue.reporterId,
        issueId,
        type: 'ESCALATION_CREATED',
        title: `Report ${issue.publicId} was escalated`,
        message: `Escalated to level ${level}.${reason ? ` Reason: ${reason}` : ''}`,
      });
    }

    return NextResponse.json({ escalation: toEscalationItem(escalation) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}