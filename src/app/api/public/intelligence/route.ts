import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/server/api';
import { computeLandingIntelligence } from '@/lib/server/landing';

/**
 * GET /api/public/intelligence — public, anonymous snapshot of aggregated
 * landing-page KPIs. No auth: deliberately the marketing surface, bounded
 * and read-only. Cached for 5 minutes at the CDN/edge layer.
 */
export async function GET() {
  try {
    const intelligence = await computeLandingIntelligence();

    return NextResponse.json(intelligence, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, max-age=60, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
