import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/session';
import { handleApiError } from '@/lib/server/api';
import { fetchAreaRisks } from '@/lib/risk/areas';
import type { RiskLevel } from '@/lib/risk/scoring';

/**
 * GET /api/risk/wards — Area/ward risk scores.
 *
 * Query params:
 *   ?riskLevel=CRITICAL|HIGH|MEDIUM|LOW — filter by level
 *   ?category=POTHOLE|DRAINAGE|... — filter by issue category
 *   ?departmentId=... — filter by routed department
 *   ?days=30 — time window (default 30)
 *   ?limit=20 — max results (default 50)
 *   ?offset=0 — pagination offset
 */
export async function GET(request: NextRequest) {
  try {
    await requireUser();
    const sp = request.nextUrl.searchParams;

    const riskLevel = sp.get('riskLevel') as RiskLevel | null;
    const category = sp.get('category');
    const departmentId = sp.get('departmentId');
    const days = sp.get('days') ? Number(sp.get('days')) : undefined;
    const limit = sp.get('limit') ? Number(sp.get('limit')) : undefined;
    const offset = sp.get('offset') ? Number(sp.get('offset')) : undefined;

    if (riskLevel && !['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(riskLevel)) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'Invalid riskLevel.' } },
        { status: 400 },
      );
    }
    if (days != null && (!Number.isFinite(days) || days < 0)) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'Invalid days.' } },
        { status: 400 },
      );
    }
    if (limit != null && (!Number.isFinite(limit) || limit <= 0)) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'Invalid limit.' } },
        { status: 400 },
      );
    }
    if (offset != null && (!Number.isFinite(offset) || offset < 0)) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'Invalid offset.' } },
        { status: 400 },
      );
    }

    const wards = await fetchAreaRisks({
      riskLevel: riskLevel ?? undefined,
      category: category ?? undefined,
      departmentId: departmentId ?? undefined,
      days: days ?? 30,
      limit: limit ?? 50,
      offset: offset ?? 0,
    });

    return NextResponse.json({ wards });
  } catch (error) {
    return handleApiError(error);
  }
}