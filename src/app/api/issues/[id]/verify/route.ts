import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/session';
import { handleApiError, ApiError } from '@/lib/server/api';
import { verifyIssue } from '@/lib/issues/actions';

export interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/issues/:id/verify — citizen verification of a resolved issue.
 * Only the original reporter may call it. `outcome: "VERIFIED"` confirms the fix
 * (lifecycle → VERIFIED); `outcome: "DISPUTED"` reopens the issue and recomputes
 * escalation interest. Lifecycle changes go through the state machine only.
 */
export async function POST(request: NextRequest, ctx: RouteContext) {
  try {
    const actor = await requireUser();
    const { id } = await ctx.params;

    let body: { outcome?: unknown; feedback?: unknown };
    try {
      body = (await request.json()) as { outcome?: unknown; feedback?: unknown };
    } catch {
      throw new ApiError(400, 'INVALID_INPUT', 'Request body must be JSON.');
    }
    if (body.outcome !== 'VERIFIED' && body.outcome !== 'DISPUTED') {
      throw new ApiError(400, 'INVALID_INPUT', '"outcome" must be VERIFIED or DISPUTED.');
    }
    const feedback =
      typeof body.feedback === 'string' && body.feedback.trim() ? body.feedback.trim().slice(0, 2000) : null;

    const result = await verifyIssue({
      issueId: id,
      actor,
      outcome: body.outcome,
      feedback,
    });

    return NextResponse.json({
      issueId: result.issueId,
      changed: result.changed,
      dispute: result.dispute,
      status: result.dispute ? 'REOPENED' : 'VERIFIED',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
