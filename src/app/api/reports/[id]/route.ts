import { NextRequest, NextResponse } from 'next/server';
import { getReportDetailHttp, patchReportHttp } from '@/lib/issues/http';

export interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * /api/reports/[id] — DEPRECATED compatibility adapter (Phase 2).
 * The canonical resource is /api/issues/[id]. Both GET and PATCH delegate to
 * the same shared handlers used by the canonical surface; add features there.
 * GET: authorized issue detail (owner, assigned authority, or admin).
 * PATCH: lifecycle status update through the single state machine
 *   (src/lib/issues/transition.ts) — the adapter adds nothing.
 */
export async function GET(request: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const { id } = await ctx.params;
  return getReportDetailHttp(request, id);
}

export async function PATCH(request: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const { id } = await ctx.params;
  return patchReportHttp(request, id);
}