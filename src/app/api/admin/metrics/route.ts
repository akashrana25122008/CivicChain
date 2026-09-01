import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/session';
import { handleApiError } from '@/lib/server/api';
import { withRequest } from '@/lib/server/timing';
import { getOperationalMetrics } from '@/lib/server/observability/metrics';

/**
 * GET /api/admin/metrics — ADMIN-only operational metrics snapshot.
 * Computed live from the database: notification delivery, AI latency
 * percentiles + error rate, error counts, and request-volume estimates.
 */
export const GET = withRequest(async () => {
  try {
    await requireRole('ADMIN');
    const metrics = await getOperationalMetrics();
    return NextResponse.json(metrics);
  } catch (error) {
    return handleApiError(error);
  }
});
