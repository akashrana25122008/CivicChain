import { NextRequest, NextResponse } from 'next/server';
import { getReportDetailHttp, patchReportHttp } from '@/lib/issues/http';

export interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * /api/reports/[id]
 * GET: authorized report detail (owner, assigned authority, or admin).
 * PATCH: authorized status update (authority of that department or admin).
 */
export async function GET(request: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const { id } = await ctx.params;
  return getReportDetailHttp(request, id);
}

export async function PATCH(request: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const { id } = await ctx.params;
  return patchReportHttp(request, id);
}