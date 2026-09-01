import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/session';
import { handleApiError } from '@/lib/server/api';
import { withRequest } from '@/lib/server/timing';
import { getAdminCommandCenter } from '@/lib/server/admin/commandCenter';

/**
 * GET /api/admin/command-center
 *
 * ADMIN-only consolidated operational console data. All aggregates are
 * computed live from real database records; RBAC is enforced here via
 * `requireRole('ADMIN')` — never trusted from the browser.
 */
export const GET = withRequest(async () => {
  try {
    await requireRole('ADMIN');
    const data = await getAdminCommandCenter();
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
});
