import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/session';
import { handleApiError, ApiError } from '@/lib/server/api';
import { castVote, getVoteSummary } from '@/lib/community/votes';
import { applyRateLimit, rateLimiters } from '@/lib/security/rate-limit';

export interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * /api/issues/:id/votes — canonical community voting surface (Phase 10).
 * POST: cast a typed vote (CONFIRM | DISPUTE | SUPPORT | DUPLICATE).
 * GET : real per-type vote counts for the issue.
 * Votes are authenticated signals and never mutate lifecycle/SLA/priority.
 */
export async function POST(request: NextRequest, ctx: RouteContext) {
  try {
    const limited = await applyRateLimit(request, rateLimiters.voting);
    if (!limited.allowed && limited.response) return limited.response;

    const actor = await requireUser();
    const { id } = await ctx.params;

    let body: { type?: unknown };
    try {
      body = (await request.json()) as { type?: unknown };
    } catch {
      throw new ApiError(400, 'INVALID_INPUT', 'Request body must be JSON.');
    }

    const vote = await castVote({ issueId: id, actor, type: body.type });
    return NextResponse.json(
      { vote: { id: vote.id, issueId: vote.issueId, type: vote.type }, created: vote.created },
      { status: vote.created ? 201 : 200 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(_request: NextRequest, ctx: RouteContext) {
  try {
    await requireUser(); // authenticated users may view an issue's vote summary
    const { id } = await ctx.params;
    const summary = await getVoteSummary(id);
    return NextResponse.json({ issueId: id, votes: summary });
  } catch (error) {
    return handleApiError(error);
  }
}
