import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/session';
import { handleApiError } from '@/lib/server/api';
import { queryIssueList } from '@/lib/issues/query';
import { createReportHttp } from '@/lib/issues/http';

/**
 * /api/issues — Phase 1 community surface.
 * GET: authenticated catalogue feed (shared query implementation).
 * POST: report creation; delegates to the shared Phase 2 pipeline used by
 * POST /api/reports (see src/lib/issues/http.ts) — one implementation.
 */

export async function GET(request: NextRequest) {
  try {
    const viewer = await requireUser();
    const { searchParams } = request.nextUrl;
    const result = await queryIssueList({
      viewerId: viewer.id,
      q: searchParams.get('q'),
      category: searchParams.get('category'),
      status: searchParams.get('status'),
      sort: (searchParams.get('sort') as 'newest' | 'oldest' | 'updated') ?? 'newest',
      page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
      pageSize: searchParams.get('pageSize') ? Number(searchParams.get('pageSize')) : 100,
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  return createReportHttp(request);
}