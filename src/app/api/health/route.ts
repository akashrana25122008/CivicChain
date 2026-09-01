import { NextResponse } from 'next/server';
import { withRequest } from '@/lib/server/timing';
import { prisma } from '@/lib/db';

/**
 * GET /api/health — public liveness probe for external monitoring.
 *
 * Deliberately unauthenticated and lightweight: uptime checkers, load
 * balancers, and orchestrators probe this path without credentials. It only
 * verifies the database connectivity and the process liveness — it does NOT
 * expose internal counts or system state (use /api/admin/health for the full
 * ADMIN-only probe).
 *
 * Returns 200 with `{ status: "ok" }` when healthy, 503 when the database is
 * unreachable.
 */
export const GET = withRequest(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok', service: 'civicchain' });
  } catch {
    return NextResponse.json(
      { status: 'unavailable', service: 'civicchain' },
      { status: 503 },
    );
  }
});
