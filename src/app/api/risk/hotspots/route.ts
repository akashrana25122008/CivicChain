import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/session';
import { handleApiError } from '@/lib/server/api';
import { fetchHotspots } from '@/lib/risk/areas';
import type { RiskLevel } from '@/lib/risk/scoring';

/**
 * GET /api/risk/hotspots — Top risk areas with full detail.
 *
 * Query params:
 *   ?riskLevel=CRITICAL|HIGH|MEDIUM|LOW
 *   ?category=...
 *   ?departmentId=...
 *   ?days=30
 *   ?limit=10
 */
export async function GET(request: NextRequest) {
  try {
    await requireUser();
    const sp = request.nextUrl.searchParams;

    const riskLevel = sp.get('riskLevel') as RiskLevel | null;
    const category = sp.get('category');
    const departmentId = sp.get('departmentId');
    const days = sp.get('days') ? Number(sp.get('days')) : undefined;
    const limit = sp.get('limit') ? Number(sp.get('limit')) : undefined;

    if (riskLevel && !['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(riskLevel)) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'Invalid riskLevel.' } },
        { status: 400 },
      );
    }
    if (days != null && (!Number.isFinite(days) || days < 0)) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'Invalid days.' } },
        { status: 400 },
      );
    }

    const hotspots = await fetchHotspots({
      riskLevel: riskLevel ?? undefined,
      category: category ?? undefined,
      departmentId: departmentId ?? undefined,
      days: days ?? 30,
      limit: limit ?? 10,
    });

    return NextResponse.json({ hotspots });
  } catch (error) {
    return handleApiError(error);
  }
}
