import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/server/api';
import { fetchAreaRisks } from '@/lib/risk/areas';

/**
 * GET /api/public/risks — public, anonymous snapshot of real predictive risk
 * zones for the landing "Predictive Intelligence" section. Reuses the Phase 11
 * risk engine (never fabricated) but exposes only public-safe, non-personal
 * fields. Cached at the edge layer.
 */
export async function GET() {
  try {
    const areas = await fetchAreaRisks({ days: 90, limit: 6 });

    const risks = areas.map((a) => ({
      wardId: a.wardId,
      wardName: a.wardName,
      riskScore: a.riskScore,
      riskLevel: a.riskLevel,
      activeIncidents: a.activeIncidents,
      totalIncidents: a.totalIncidents,
      topCategory: a.topCategory,
      averageResolutionTime: a.averageResolutionTime,
      trend: {
        direction: a.trend.direction,
        percentage: a.trend.percentage,
      },
    }));

    return NextResponse.json(
      { risks, generatedAt: new Date().toISOString() },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, max-age=60, stale-while-revalidate=600',
        },
      },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
