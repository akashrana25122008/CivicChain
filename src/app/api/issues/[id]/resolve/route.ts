import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/session';
import { handleApiError, ApiError } from '@/lib/server/api';
import { resolveIssue } from '@/lib/issues/actions';

export interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/issues/:id/resolve — resolution domain action. Authorized staff
 * only. Validates current state + actor and moves the lifecycle through the
 * state machine (`transitionIssue`), never by patching status directly.
 * Idempotent: resolving an already-resolved issue is a safe no-op.
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

    const result = await resolveIssue({ issueId: id, actor, note });
    return NextResponse.json({
      issueId: result.issueId,
      changed: result.changed,
      status: 'RESOLVED',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
