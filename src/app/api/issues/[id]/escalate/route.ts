import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/session';
import { handleApiError, ApiError, badRequest, notFound, forbidden } from '@/lib/server/api';
import { recordAudit } from '@/lib/server/audit';
import { createNotification } from '@/lib/server/notify';
import { getOwnAuthority } from '@/lib/server/dept';
import { nextEscalationLevel } from '@/lib/escalation/levels';
import { prisma } from '@/lib/db';

export interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/issues/:id/escalate — raise an escalation against an issue.
 * Escalation is recorded as a domain event (not a raw status change) with an
 * audit entry + notification. Authorized callers: ADMIN, the assigned
 * authority, or the original citizen reporter. Duplicate open escalations are
 * rejected (idempotency).
 */
export async function POST(request: NextRequest, ctx: RouteContext) {
  try {
    const actor = await requireUser();
    const { id } = await ctx.params;

    let body: { reason?: unknown };
    try {
      body = (await request.json()) as { reason?: unknown };
    } catch {
      throw new ApiError(400, 'INVALID_INPUT', 'Request body must be JSON.');
    }
    const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim().slice(0, 1000) : null;

    const issue = await prisma.issue.findUnique({
      where: { id },
      select: { id: true, publicId: true, reporterId: true, authorityId: true, status: true },
    });
    if (!issue) throw notFound('Issue');

    // Authorization: admin, assigned authority, or the reporter.
    const isAdmin = actor.role === 'ADMIN';
    const isReporter = issue.reporterId === actor.id;
    let isAuthority = false;
    if (actor.role === 'AUTHORITY' && issue.authorityId) {
      const authority = await getOwnAuthority(actor);
      isAuthority = !!authority && authority.id === issue.authorityId;
    }
    if (!isAdmin && !isReporter && !isAuthority) throw forbidden();

    const open = await prisma.escalation.findFirst({
      where: { issueId: id, status: { in: ['OPEN', 'IN_PROGRESS'] } },
      select: { id: true },
    });
    if (open) throw badRequest('This issue already has an open escalation.');

    const max = await prisma.escalation.aggregate({ where: { issueId: id }, _max: { level: true } });
    const level = nextEscalationLevel(max._max.level ?? 0);

    const authority = actor.role === 'AUTHORITY' ? await getOwnAuthority(actor) : null;

    const escalation = await prisma.escalation.create({
      data: {
        issueId: id,
        callerId: actor.id,
        authorityId: authority?.id ?? null,
        level,
        status: 'OPEN',
        reason,
      },
    });

    await recordAudit({
      actorId: actor.id,
      issueId: id,
      action: 'ESCALATION_CREATED',
      entityType: 'Issue',
      entityId: id,
      metadata: { escalationId: escalation.id, level, reason },
    });

    if (issue.reporterId !== actor.id) {
      await createNotification({
        userId: issue.reporterId,
        issueId: id,
        type: 'ESCALATION_CREATED',
        title: `Report ${issue.publicId} was escalated`,
        message: `Escalated to level ${level}.${reason ? ` Reason: ${reason}` : ''}`,
      });
    }

    return NextResponse.json(
      { escalation: { id: escalation.id, issueId: id, level, status: escalation.status }, issueStatus: issue.status },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
