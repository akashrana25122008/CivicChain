import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, notFound, forbidden, ApiError } from '@/lib/server/api';
import { requireUser } from '@/lib/server/session';
import { prisma } from '@/lib/db';

export interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Mark a notification read — owner only. */
export async function PATCH(request: NextRequest, ctx: RouteContext) {
  try {
    const viewer = await requireUser();
    const { id } = await ctx.params;

    let body: { read?: unknown } = {};
    try {
      body = await request.json();
    } catch {
      throw new ApiError(400, 'INVALID_INPUT', 'Request body must be JSON.');
    }
    if (body.read !== true) {
      throw new ApiError(400, 'INVALID_INPUT', 'Only "read: true" is supported.');
    }

    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification) throw notFound('Notification');
    if (notification.userId !== viewer.id) throw forbidden();

    await prisma.notification.update({
      where: { id },
      data: { read: true },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}