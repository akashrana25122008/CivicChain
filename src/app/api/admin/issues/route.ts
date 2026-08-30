import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/server/api';
import { requireRole } from '@/lib/server/session';
import { queryIssueList } from '@/lib/issues/query';

/** ADMIN-only system-wide issue manager (search/filter/paged). */
export async function GET(request: NextRequest) {
  try {
    const user = await requireRole('ADMIN');
    const sp = request.nextUrl.searchParams;

    const result = await queryIssueList({
      viewerId: user.id,
      revealReporter: true,
      q: sp.get('q'),
      category: sp.get('category'),
      status: sp.get('status'),
      sort: (sp.get('sort') as 'newest' | 'oldest' | 'updated') ?? 'newest',
      page: sp.get('page') ? Number(sp.get('page')) : 1,
      pageSize: sp.get('pageSize') ? Number(sp.get('pageSize')) : 25,
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}