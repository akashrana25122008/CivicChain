import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, ApiError, badRequest } from '@/lib/server/api';
import { requireUser } from '@/lib/server/session';
import { prisma } from '@/lib/db';
import {
  NotificationChannel,
} from '../../../../../generated/prisma/client';

/**
 * Per-user notification channel preferences (Phase 13).
 *
 * A missing preference row means "enabled by default". The API always returns
 * all three channels with their resolved value so the UI has a stable shape,
 * and NEVER trusts a channel/enabled value from the browser for another user —
 * the owner is always the authenticated session user.
 */

export type PreferenceMap = Record<NotificationChannel, boolean>;
export type PreferencePatch = Partial<PreferenceMap>;

export async function GET() {
  try {
    const viewer = await requireUser();
    const rows = await prisma.notificationPreference.findMany({
      where: { userId: viewer.id },
      select: { channel: true, enabled: true },
    });
    const resolved = resolveMap(rows);
    return NextResponse.json({ preferences: resolved });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const viewer = await requireUser();

    let body: { preferences?: unknown };
    try {
      body = await request.json();
    } catch {
      throw new ApiError(400, 'INVALID_INPUT', 'Request body must be JSON.');
    }
    if (!body.preferences || typeof body.preferences !== 'object') {
      throw badRequest('A "preferences" object is required.');
    }

    const patch = body.preferences as Record<string, unknown>;
    const CHANNEL_VALUES = new Set<string>(Object.values(NotificationChannel));

    for (const [key, value] of Object.entries(patch)) {
      if (!CHANNEL_VALUES.has(key)) {
        throw badRequest(`Unknown channel "${key}".`);
      }
      if (typeof value !== 'boolean') {
        throw badRequest(`"${key}" must be a boolean.`);
      }
    }

    // Upsert each provided channel preference.
    const entries: Array<{ channel: NotificationChannel; enabled: boolean }> = [];
    for (const [key, value] of Object.entries(patch)) {
      entries.push({ channel: key as NotificationChannel, enabled: value as boolean });
    }

    for (const entry of entries) {
      await prisma.notificationPreference.upsert({
        where: { userId_channel: { userId: viewer.id, channel: entry.channel } },
        create: { userId: viewer.id, channel: entry.channel, enabled: entry.enabled },
        update: { enabled: entry.enabled },
      });
    }

    const rows = await prisma.notificationPreference.findMany({
      where: { userId: viewer.id },
      select: { channel: true, enabled: true },
    });
    return NextResponse.json({ preferences: resolveMap(rows) });
  } catch (error) {
    return handleApiError(error);
  }
}

function resolveMap(
  rows: Array<{ channel: NotificationChannel; enabled: boolean }>,
): PreferenceMap {
  const map: PreferenceMap = {
    IN_APP: true,
    EMAIL: true,
    PUSH: true,
  };
  for (const row of rows) {
    map[row.channel] = row.enabled;
  }
  return map;
}
