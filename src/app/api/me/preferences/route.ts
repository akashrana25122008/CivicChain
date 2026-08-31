import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, ApiError, badRequest } from '@/lib/server/api';
import { requireUser } from '@/lib/server/session';
import { prisma } from '@/lib/db';
import { ThemePreference } from '../../../../../generated/prisma/client';
import {
  DEFAULT_PREFERENCES,
  pickPatch,
  validatePatchValue,
  unknownKeys,
  toView,
} from '@/lib/server/preferences';

/**
 * Persisted per-user settings (Phase 14).
 *
 * GET returns a fully-resolved preferences view (never null) so the UI always
 * has a stable shape. PATCH merges partial updates into the single per-user
 * row, keyed strictly off the authenticated session user id. Values are
 * validated server-side; unknown keys reject the whole request.
 */

export async function GET() {
  try {
    const viewer = await requireUser();
    const row = await prisma.userPreferences.findUnique({ where: { userId: viewer.id } });
    return NextResponse.json({ preferences: row ? toView(row) : DEFAULT_PREFERENCES });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const viewer = await requireUser();

    let body: Record<string, unknown>;
    try {
      const parsed: unknown = await request.json();
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new ApiError(400, 'INVALID_INPUT', 'Request body must be a JSON object.');
      }
      body = parsed as Record<string, unknown>;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(400, 'INVALID_INPUT', 'Request body must be valid JSON.');
    }

    const unknown = unknownKeys(body);
    if (unknown.length > 0) {
      throw badRequest(`Unknown preference(s): ${unknown.join(', ')}.`);
    }

    const { patch } = pickPatch(body);
    const data: {
      theme?: ThemePreference;
      language?: string;
      weeklyDigest?: boolean;
      reportUpdates?: boolean;
    } = {};
    for (const [key, value] of Object.entries(patch)) {
      const err = validatePatchValue(key, value);
      if (err) throw badRequest(err);
      (data as Record<string, unknown>)[key] = value;
    }

    if (Object.keys(data).length === 0) {
      // Empty patch → no-op, return current state.
      const current = await prisma.userPreferences.findUnique({
        where: { userId: viewer.id },
      });
      return NextResponse.json({
        preferences: current ? toView(current) : DEFAULT_PREFERENCES,
      });
    }

    const upserted = await prisma.userPreferences.upsert({
      where: { userId: viewer.id },
      create: { userId: viewer.id, ...data },
      update: { ...data },
    });

    return NextResponse.json({ preferences: toView(upserted) });
  } catch (error) {
    return handleApiError(error);
  }
}