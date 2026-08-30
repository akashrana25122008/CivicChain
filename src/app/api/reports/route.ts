import { NextRequest, NextResponse } from 'next/server';
import { createReportHttp, listReportsHttp } from '@/lib/issues/http';

/**
 * /api/reports — DEPRECATED compatibility adapter (Phase 2).
 *
 * The canonical API resource is /api/issues (src/app/api/issues/route.ts).
 * This route exists only so older clients keep working: every handler
 * delegates to the exact same shared implementation the canonical surface
 * uses (src/lib/issues/http.ts). No domain logic lives here — add features to
 * /api/issues, not here. Existing internal clients have been moved to
 * /api/issues; this adapter is kept for out-of-band/legacy requests.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return createReportHttp(request);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return listReportsHttp(request);
}