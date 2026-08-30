import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/session';
import { handleApiError, ApiError } from '@/lib/server/api';
import { reopenIssue } from '@/lib/issues/actions';

export interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/issues/:id/reopen — "Citizen Disputed → Reopened" domain action.
 * Authorized staff, or the original citizen reporter, may reopen a resolved or
 * rejected issue. Validates state + actor and moves the lifecycle through the
 * state machine. Idempotent: reopening an already-active issue is rejected.
 */
export async function POST(request: NextRequest, ctx: RouteContext) {
  try {
    const actor = await requireUser();
    const { id } = await ctx.params;

    let body: { note?: unknown } = {};
    try {
      body = (await request.json()) as { note?: unknown };
    } catch {
      throw new ApiError(400, 'INVALID_INPUT', 'Request body must be JSON.');
    }
    const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 2000) : null;

    const result = await reopenIssue({ issueId: id, actor, note });
    return NextResponse.json({
      issueId: result.issueId,
      changed: result.changed,
      status: 'REOPENED',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
