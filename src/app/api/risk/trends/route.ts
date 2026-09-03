import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/session';
import { handleApiError } from '@/lib/server/api';
import { fetchAreaRisks } from '@/lib/risk/areas';

/**
 * GET /api/risk/trends — Risk trend data per area.
 *
 * Query params:
 *   ?category=...
 *   ?departmentId=...
 *   ?days=30
 *   ?limit=20
 *
 * Returns ward risk data with trend indicators.
 */
export async function GET(request: NextRequest) {
  try {
    await requireUser();
    const sp = request.nextUrl.searchParams;

    const category = sp.get('category');
    const departmentId = sp.get('departmentId');
    const days = sp.get('days') ? Number(sp.get('days')) : undefined;
    const limit = sp.get('limit') ? Number(sp.get('limit')) : undefined;

    if (days != null && (!Number.isFinite(days) || days < 0)) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'Invalid days.' } },
        { status: 400 },
      );
    }

    const wards = await fetchAreaRisks({
      category: category ?? undefined,
      departmentId: departmentId ?? undefined,
      days: days ?? 30,
      limit: limit ?? 20,
    });

    const trends = wards.map(w => ({
      wardId: w.wardId,
      wardName: w.wardName,
      riskScore: w.riskScore,
      riskLevel: w.riskLevel,
      trend: w.trend,
    }));

    return NextResponse.json({ trends });
  } catch (error) {
    return handleApiError(error);
  }
}
