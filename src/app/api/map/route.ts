import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/session';
import { requireOwnAuthority } from '@/lib/server/dept';
import { handleApiError } from '@/lib/server/api';
import { queryIssueList } from '@/lib/issues/query';

/**
 * /api/map — geographic issue catalogue for the Civic Map.
 *
 * Authorization is enforced HERE against the live database, never the client:
 *  - CITIZEN    → only reports they submitted themselves.
 *  - AUTHORITY  → only reports assigned to their own authority.
 *  - ADMIN      → the full system feed, optionally narrowed by ?department=.
 *
 * Filters (category / status / priority / from / to) map to real WHERE clauses
 * in queryIssueList — the map renders exactly what the server returns.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const sp = request.nextUrl.searchParams;

    if (user.role === 'CITIZEN') {
      const result = await queryIssueList({
        viewerId: user.id,
        reporterId: user.id,
        q: null,
        category: sp.get('category'),
        status: sp.get('status'),
        priority: sp.get('priority'),
        dateFrom: sp.get('from'),
        dateTo: sp.get('to'),
        sort: (sp.get('sort') as 'newest' | 'oldest' | 'updated') ?? 'updated',
        page: 1,
        pageSize: 200,
      });
      return NextResponse.json({ scope: 'mine', ...result });
    }

    if (user.role === 'AUTHORITY') {
      const authority = await requireOwnAuthority(user);
      const result = await queryIssueList({
        viewerId: user.id,
        revealReporter: true,
        authorityId: authority.id,
        q: null,
        category: sp.get('category'),
        status: sp.get('status'),
        priority: sp.get('priority'),
        dateFrom: sp.get('from'),
        dateTo: sp.get('to'),
        sort: (sp.get('sort') as 'newest' | 'oldest' | 'updated') ?? 'updated',
        page: 1,
        pageSize: 200,
      });
      return NextResponse.json({ scope: 'department', ...result });
    }

    // ADMIN — full feed, optional department slice.
    const result = await queryIssueList({
      viewerId: user.id,
      revealReporter: true,
      authorityId: sp.get('department'),
      q: null,
      category: sp.get('category'),
      status: sp.get('status'),
      priority: sp.get('priority'),
      dateFrom: sp.get('from'),
      dateTo: sp.get('to'),
      sort: (sp.get('sort') as 'newest' | 'oldest' | 'updated') ?? 'updated',
      page: 1,
      pageSize: 200,
    });
    return NextResponse.json({ scope: 'all', ...result });
  } catch (error) {
    return handleApiError(error);
  }
}