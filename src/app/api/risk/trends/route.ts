import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/session';
import { handleApiError } from '@/lib/server/api';
import { fetchAreaRisks } from '@/lib/risk/areas';

/**
 * GET /api/risk/trends — Risk trend data per area.
 *
 * Query params:
 *   ?days=30
 *   ?limit=20
 *
 * Returns ward risk data with trend indicators.
 */
export async function GET(request: NextRequest) {
  try {
    await requireUser();
    const sp = request.nextUrl.searchParams;

    const days = sp.get('days') ? Number(sp.get('days')) : undefined;
    const limit = sp.get('limit') ? Number(sp.get('limit')) : undefined;

    const wards = await fetchAreaRisks({
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
