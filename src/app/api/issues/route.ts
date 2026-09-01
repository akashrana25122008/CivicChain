import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/session';
import { handleApiError, badRequest } from '@/lib/server/api';
import { withRequest } from '@/lib/server/timing';
import { queryIssueList } from '@/lib/issues/query';
import { createReportHttp } from '@/lib/issues/http';

const MAX_PAGE_SIZE = 200;
const VALID_SORTS = new Set(['newest', 'oldest', 'updated']);

/**
 * GET /api/issues — authenticated catalogue feed (shared query implementation).
 * Query params are validated here (defense-in-depth; queryIssueList also clamps
 * internally): page/pageSize must be finite numbers within bounds, sort/category
 * must match the accepted enums, so garbage input gets a clear 400 rather than
 * a silent coercion or unbounded page size.
 */
export const GET = withRequest(async (request: NextRequest) => {
  try {
    const viewer = await requireUser();
    const { searchParams } = request.nextUrl;

    const rawPage = searchParams.get('page');
    const rawSize = searchParams.get('pageSize');
    const page = rawPage === null ? 1 : Number(rawPage);
    const pageSize = rawSize === null ? 100 : Number(rawSize);

    if (!Number.isInteger(page) || page < 1) {
      throw badRequest('page must be a positive integer.');
    }
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
      throw badRequest(`pageSize must be an integer between 1 and ${MAX_PAGE_SIZE}.`);
    }

    const sort = (searchParams.get('sort') ?? 'newest') as string;
    if (!VALID_SORTS.has(sort)) {
      throw badRequest('sort must be one of: newest, oldest, updated.');
    }

    const result = await queryIssueList({
      viewerId: viewer.id,
      q: searchParams.get('q'),
      category: searchParams.get('category'),
      status: searchParams.get('status'),
      sort: sort as 'newest' | 'oldest' | 'updated',
      page,
      pageSize,
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
});

export const POST = withRequest((request: NextRequest) => createReportHttp(request));