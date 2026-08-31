import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/session';
import { handleApiError, badRequest } from '@/lib/server/api';
import { reverseGeocodeStructured } from '@/lib/server/geocode';

/**
 * GET /api/geocode/reverse?lat=&lon=&fallback=
 *
 * Reverse geocoding: turns a dropped pin (or GPS fix) into a human-readable
 * address + ward. Requires an authenticated citizen. Never fails hard — when
 * no provider is configured and no fallback is supplied, returns null with
 * `available:false` so the UI can degrade gracefully.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireUser();
    const params = request.nextUrl.searchParams;
    const lat = Number(params.get('lat'));
    const lon = Number(params.get('lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Number.isNaN(lat) || Number.isNaN(lon)) {
      throw badRequest('Valid lat and lon are required.');
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      throw badRequest('Coordinates out of range.');
    }

    const fallback = params.get('fallback')?.trim() || null;
    const result = await reverseGeocodeStructured(lat, lon, fallback);

    return NextResponse.json({
      available: Boolean(
        process.env.GEOCODER_URL && process.env.GEOCODER_URL.trim(),
      ),
      result: result
        ? {
            label: result.label,
            latitude: result.latitude,
            longitude: result.longitude,
            ward: result.ward ?? null,
          }
        : null,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
