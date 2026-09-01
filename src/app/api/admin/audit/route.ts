import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, badRequest } from '@/lib/server/api';
import { requireRole } from '@/lib/server/session';
import { AuditAction } from '../../../../../generated/prisma/client';
import { prisma } from '@/lib/db';
import type { AuditEventItem } from '@/lib/issues/types';

export const MAX_PAGE_SIZE = 200;

/**
 * ADMIN-only audit trail of every business action on the platform.
 * Supports an optional single-action filter and cursor-based pagination
 * (newest first, keyed on the monotonically increasing `seq`). `total` is the
 * true count matching the current filter, not the page length.
 */
export async function GET(request: NextRequest) {
  try {
    await requireRole('ADMIN');

    const actionParam = request.nextUrl.searchParams.get('action');
    const cursorParam = request.nextUrl.searchParams.get('cursor');
    const limitParam = request.nextUrl.searchParams.get('limit');

    const cursor = cursorParam != null && cursorParam !== '' ? Number(cursorParam) : null;
    if (cursor != null && (!Number.isInteger(cursor) || cursor < 0)) {
      throw badRequest('Invalid cursor; expected the integer seq of a row.');
    }
    const limit = limitParam != null && limitParam !== '' ? Number(limitParam) : 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
      throw badRequest(`Limit must be an integer between 1 and ${MAX_PAGE_SIZE}.`);
    }

    let action: AuditAction | null = null;
    if (actionParam && actionParam !== 'ALL') {
      if (!Object.values(AuditAction).includes(actionParam as AuditAction)) {
        throw badRequest(`Unknown audit action "${actionParam}".`);
      }
      action = actionParam as AuditAction;
    }

    const where = action ? { action } : {};

    const [total, logs] = await Promise.all([
      prisma.auditEvent.count({ where }),
      prisma.auditEvent.findMany({
        where,
        orderBy: { seq: 'desc' },
        take: limit,
        ...(cursor != null ? { cursor: { seq: cursor }, skip: 1 } : {}),
        include: {
          actor: { select: { name: true, email: true, role: true } },
          issue: { select: { publicId: true } },
        },
      }),
    ]);

    const items: AuditEventItem[] = logs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      actor: log.actor ? log.actor.name ?? log.actor.email : null,
      issueId: log.issueId,
      issuePublicId: log.issue?.publicId ?? null,
      metadata: log.metadata,
      createdAt: log.createdAt.toISOString(),
      seq: log.seq,
      hash: log.hash,
      prevHash: log.prevHash,
    }));

    const nextSeq = items.length === limit ? items[items.length - 1].seq : null;

    return NextResponse.json({
      logs: items,
      total,
      actions: Object.values(AuditAction),
      nextSeq,
    });
  } catch (error) {
    return handleApiError(error);
  }
}