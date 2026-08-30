import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/session';
import { handleApiError } from '@/lib/server/api';
import { requireOwnAuthority } from '@/lib/server/dept';
import { queryIssueList } from '@/lib/issues/query';

/** Department workbench issue list — strictly scoped to the caller's own authority. */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const authority = await requireOwnAuthority(user);
    const sp = request.nextUrl.searchParams;

    const result = await queryIssueList({
      viewerId: user.id,
      revealReporter: true,
      authorityId: authority.id,
      q: sp.get('q'),
      category: sp.get('category'),
      status: sp.get('status'),
      sort: (sp.get('sort') as 'newest' | 'oldest' | 'updated') ?? 'newest',
      page: sp.get('page') ? Number(sp.get('page')) : 1,
      pageSize: sp.get('pageSize') ? Number(sp.get('pageSize')) : 15,
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}