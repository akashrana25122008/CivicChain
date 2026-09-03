import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/session';
import { handleApiError, notFound } from '@/lib/server/api';
import { fetchWardDetail } from '@/lib/risk/areas';

export interface RouteContext {
  params: Promise<{ wardId: string }>;
}

/**
 * GET /api/risk/wards/:wardId — full ward/area risk detail.
 *
 * Query params:
 *   ?category=...         restrict to one issue category
 *   ?departmentId=...     restrict to issues routed to one department
 *   ?days=30              time window (default 30)
 *
 * Returns the ward summary plus the per-factor breakdown, an explanation of
 * why this ward has its current risk level, the issues driving it, and the
 * category distribution within the ward.
 */
export async function GET(request: NextRequest, ctx: RouteContext) {
  try {
    await requireUser();
    const sp = request.nextUrl.searchParams;
    const { wardId } = await ctx.params;

    const category = sp.get('category');
    const departmentId = sp.get('departmentId');
    const days = sp.get('days') ? Number(sp.get('days')) : undefined;

    if (days != null && (!Number.isFinite(days) || days < 0)) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'Invalid days.' } },
        { status: 400 },
      );
    }

    const detail = await fetchWardDetail(wardId, {
      category: category ?? undefined,
      departmentId: departmentId ?? undefined,
      days: days ?? 30,
    });

    if (!detail) throw notFound('Ward');

    return NextResponse.json({ ward: detail });
  } catch (error) {
    return handleApiError(error);
  }
}