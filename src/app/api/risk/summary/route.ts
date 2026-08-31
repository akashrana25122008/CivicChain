import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/session';
import { handleApiError } from '@/lib/server/api';
import { fetchRiskSummary } from '@/lib/risk/areas';

/**
 * GET /api/risk/summary — Dashboard risk overview.
 *
 * Query params:
 *   ?category=...
 *   ?days=30
 */
export async function GET(request: NextRequest) {
  try {
    await requireUser();
    const sp = request.nextUrl.searchParams;

    const category = sp.get('category');
    const days = sp.get('days') ? Number(sp.get('days')) : undefined;

    const summary = await fetchRiskSummary({
      category: category ?? undefined,
      days: days ?? 30,
    });

    return NextResponse.json(summary);
  } catch (error) {
    return handleApiError(error);
  }
}
