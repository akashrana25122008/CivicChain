import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/server/api';
import { requireRole } from '@/lib/server/session';
import { computeAnalytics } from '@/lib/server/analytics';

/**
 * ADMIN-only Analytics Engine API.
 *
 * GET /api/admin/analytics/engine?range=7d|30d|90d|all
 *
 * Returns the full consolidated analytics payload computed from live data
 * across every metric family. The range is validated server-side (never
 * trusted from the browser). Admin RBAC is enforced before any computation.
 */
export async function GET(request: Request) {
  try {
    await requireRole('ADMIN');

    const url = new URL(request.url);
    const range = url.searchParams.get('range');

    const payload = await computeAnalytics(range);
    return NextResponse.json(payload);
  } catch (error) {
    return handleApiError(error);
  }
}
