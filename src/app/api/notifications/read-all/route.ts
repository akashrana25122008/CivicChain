import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/session';
import { handleApiError } from '@/lib/server/api';
import { prisma } from '@/lib/db';

/**
 * Mark all of the current user's notifications as read in a single atomic
 * update (Phase 13) — replaces the previous N-request "mark all" client fan-out.
 */
export async function POST() {
  try {
    const viewer = await requireUser();
    const result = await prisma.notification.updateMany({
      where: { userId: viewer.id, read: false },
      data: { read: true },
    });
    return NextResponse.json({ updated: result.count });
  } catch (error) {
    return handleApiError(error);
  }
}
