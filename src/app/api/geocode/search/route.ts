import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/session';
import { handleApiError, badRequest } from '@/lib/server/api';
import { searchGeocode, extractWardFromText } from '@/lib/server/geocode';

/**
 * GET /api/geocode/search?q=...&lat=&lon=&limit=
 *
 * Forward geocoding / address autocomplete. Requires an authenticated citizen.
 * Delegates to the provider when configured; otherwise returns a label-only
 * local candidate (zero coordinates = "unlocated"). Ward is optionally derived
 * server-side from the query text so the picker can offer it without a provider.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireUser();
    const params = request.nextUrl.searchParams;
    const q = (params.get('q') ?? '').trim();
    if (!q) throw badRequest('Missing query (q).');

    const limitRaw = Number(params.get('limit') ?? 6);
    const limit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(20, Math.floor(limitRaw)))
      : 6;

    const latRaw = Number(params.get('lat'));
    const lonRaw = Number(params.get('lon'));
    const hasAnchor =
      Number.isFinite(latRaw) && Number.isFinite(lonRaw) && !Number.isNaN(latRaw) && !Number.isNaN(lonRaw);

    const results = await searchGeocode(q, {
      limit,
      ...(hasAnchor ? { lat: latRaw, lon: lonRaw } : {}),
    });

    return NextResponse.json({
      results: results.map((r) => ({
        label: r.label,
        latitude: r.latitude,
        longitude: r.longitude,
        ward: r.ward ?? extractWardFromText(r.label),
        // Zero coords from a local fallback candidate mean "unlocated".
        located: !(r.latitude === 0 && r.longitude === 0),
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
