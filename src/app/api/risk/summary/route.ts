import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/session';
import { handleApiError } from '@/lib/server/api';
import { fetchRiskSummary } from '@/lib/risk/areas';

/**
 * GET /api/risk/summary — Dashboard risk overview.
 *
 * Query params:
 *   ?category=...
 *   ?departmentId=...
 *   ?days=30
 */
export async function GET(request: NextRequest) {
  try {
    await requireUser();
    const sp = request.nextUrl.searchParams;

    const category = sp.get('category');
    const departmentId = sp.get('departmentId');
    const days = sp.get('days') ? Number(sp.get('days')) : undefined;

    if (days != null && (!Number.isFinite(days) || days <= 0)) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'Invalid days.' } },
        { status: 400 },
      );
    }

    const summary = await fetchRiskSummary({
      category: category ?? undefined,
      departmentId: departmentId ?? undefined,
      days: days ?? 30,
    });

    return NextResponse.json(summary);
  } catch (error) {
    return handleApiError(error);
  }
}
