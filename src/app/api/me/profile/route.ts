import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, ApiError } from '@/lib/server/api';
import { requireUser } from '@/lib/server/session';
import { prisma } from '@/lib/db';
import { requireProfilePatch, type ProfileView } from '@/lib/server/profile';

/**
 * The authenticated user's own profile (Phase 14 — settings actually working).
 *
 * GET reflects the authoritative DB record (derived from the session, never the
 * browser). PATCH currently allows updating `name` only — email and role are
 * identity/privilege attributes and are not editable here.
 */

export async function GET() {
  try {
    const viewer = await requireUser();
    const view: ProfileView = {
      name: viewer.name ?? '',
      email: viewer.email,
      role: viewer.role,
    };
    return NextResponse.json({ profile: view });
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

    const { patch, error } = requireProfilePatch(body);
    if (error) throw error;

    const updated = await prisma.user.update({
      where: { id: viewer.id },
      data: { ...patch },
      select: { name: true, email: true, role: true },
    });

    const view: ProfileView = {
      name: updated.name ?? '',
      email: updated.email,
      role: updated.role,
    };
    return NextResponse.json({ profile: view });
  } catch (error) {
    return handleApiError(error);
  }
}