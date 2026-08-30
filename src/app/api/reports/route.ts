import { NextRequest, NextResponse } from 'next/server';
import { createReportHttp, listReportsHttp } from '@/lib/issues/http';

/**
 * /api/reports — Phase 2 real report pipeline surface.
 * POST: create a report (multipart; evidence files validated server-side,
 *   stored in private object storage; issue minted from the session identity).
 * GET: role-scoped report listing (citizen=own, authority=dept, admin=all).
 * All handling is shared with /api/issues (src/lib/issues/http.ts).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return createReportHttp(request);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return listReportsHttp(request);
}