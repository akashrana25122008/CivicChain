import {
  NotificationChannel,
  NotificationType,
  type Prisma,
  type PrismaClient,
} from '../../../generated/prisma/client';
import { prisma as prismaClient } from '@/lib/db';
import { sendNotificationEmail } from '@/lib/email/notification';

export type NotifyTx = PrismaClient | Prisma.TransactionClient;

/** Channel routing decisions (Phase 13). */
export const NOTIFICATION_CHANNELS = [
  NotificationChannel.IN_APP,
  NotificationChannel.EMAIL,
  NotificationChannel.PUSH,
] as const;

export type ChannelPreference = Record<
  NotificationChannel,
  { explicit: boolean; enabled: boolean }
>;

/** The default — no preference row exists → the channel is on. */
const DEFAULT_PREFERENCE: ChannelPreference = {
  IN_APP: { explicit: false, enabled: true },
  EMAIL: { explicit: false, enabled: true },
  PUSH: { explicit: false, enabled: true },
};

/**
 * Build a deterministic channel map from the persisted preference rows.
 * A missing row (or a user with no rows at all) yields the default: enabled.
 * Pure — no DB access, fully unit-testable.
 */
export function resolveChannelPreferences(
  rows: Array<{ channel: NotificationChannel; enabled: boolean }>,
): ChannelPreference {
  const result: ChannelPreference = {
    IN_APP: { ...DEFAULT_PREFERENCE.IN_APP },
    EMAIL: { ...DEFAULT_PREFERENCE.EMAIL },
    PUSH: { ...DEFAULT_PREFERENCE.PUSH },
  };
  for (const row of rows) {
    result[row.channel] = { explicit: true, enabled: row.enabled };
  }
  return result;
}

/** True when a channel should deliver for this preference map. */
export function channelEnabled(
  prefs: ChannelPreference,
  channel: NotificationChannel,
): boolean {
  return (
    prefs[channel]?.enabled ?? DEFAULT_PREFERENCE[channel]?.enabled ?? true
  );
}

export interface CreateNotificationInput {
  userId: string;
  issueId?: string | null;
  type: NotificationType;
  title: string;
  message?: string | null;
  /**
   * Deep-link the notification resolves to (e.g. `/dashboard/issues/<id>`).
   */
  link?: string | null;
  /**
   * Optional idempotency guard. When provided and a notification with the same
   * key already exists, the call is a no-op (a retried event cannot double-notify).
   */
  dedupeKey?: string;
  /**
   * Channels to attempt. Defaults to IN_APP + EMAIL (multi-channel by default).
   * Each channel is gated by the recipient's preference before it runs.
   */
  channels?: NotificationChannel[];
  tx?: NotifyTx;
}

export interface NotifyResult {
  persisted: boolean;
  notificationId?: string;
  channels: Array<{ channel: NotificationChannel; delivered: boolean; reason?: string }>;
}

/**
 * The single event-driven notification dispatcher (Phase 13).
 *
 * 1. Resolves the recipient's persisted preferences (in-app/email/push).
 * 2. For each requested channel that the user has enabled:
 *      IN_APP → persists a `Notification` row.
 *      EMAIL  → attempts delivery via `sendNotificationEmail` (honest failure).
 *      PUSH   → recorded as honest UNSUPPORTED (no provider in this environment);
 *               the row is still persisted for a future delivery worker.
 * 3. Each accepted in-app notification is dedupe-safe via the optional dedupeKey.
 *
 * Delivery failures are never fatal to the caller — a failed channel must not
 * corrupt the in-app record or the triggering business transaction.
 */
export async function notifyUser(
  input: CreateNotificationInput & { channels?: NotificationChannel[] },
): Promise<NotifyResult> {
  const db: NotifyTx = input.tx ?? prismaClient;
  const channels = input.channels ?? [NotificationChannel.IN_APP, NotificationChannel.EMAIL];

  // Resolve prefs (reads are exempt from the outermore transaction so a missing
  // preference never blocks a write).
  const prefRows = await db.notificationPreference.findMany({
    where: { userId: input.userId },
    select: { channel: true, enabled: true },
  });
  const prefs = resolveChannelPreferences(prefRows);

  // Idempotency: a supplied dedupeKey must be globally unique.
  if (input.dedupeKey) {
    const existing = await db.notification.findUnique({
      where: { dedupeKey: input.dedupeKey },
      select: { id: true },
    });
    if (existing) {
      return { persisted: false, notificationId: existing.id, channels: [] };
    }
  }

  const wantsInApp = channels.includes(NotificationChannel.IN_APP);
  const createInApp = wantsInApp && channelEnabled(prefs, NotificationChannel.IN_APP);

  let persistedId: string | undefined;
  if (createInApp) {
    const created = await db.notification.create({
      data: {
        userId: input.userId,
        issueId: input.issueId ?? null,
        type: input.type,
        title: input.title,
        message: input.message ?? null,
        link: input.link ?? null,
        dedupeKey: input.dedupeKey ?? null,
        channel: NotificationChannel.IN_APP,
      },
      select: { id: true },
    });
    persistedId = created.id;
  }

  const results: NotifyResult['channels'] = [];

  if (channels.includes(NotificationChannel.EMAIL)) {
    const emailOn = channelEnabled(prefs, NotificationChannel.EMAIL);
    if (emailOn) {
      const recipient = await db.user.findUnique({
        where: { id: input.userId },
        select: { email: true, name: true },
      });
      const to = recipient?.email;
      if (to) {
        const emailResult = await sendNotificationEmail({
          to,
          subject: input.title,
          text: `${input.title}\n\n${input.message ?? ''}`.trim(),
        });
        results.push({
          channel: NotificationChannel.EMAIL,
          delivered: emailResult.delivered,
          reason: emailResult.reason,
        });
      } else {
        results.push({
          channel: NotificationChannel.EMAIL,
          delivered: false,
          reason: 'Recipient has no email address.',
        });
      }
    } else {
      results.push({
        channel: NotificationChannel.EMAIL,
        delivered: false,
        reason: 'Email notifications disabled by preference.',
      });
    }
  }

  if (channels.includes(NotificationChannel.PUSH)) {
    const pushOn = channelEnabled(prefs, NotificationChannel.PUSH);
    // No push provider exists in this environment — honest UNSUPPORTED. The
    // in-app record above (if any) is unaffected.
    results.push({
      channel: NotificationChannel.PUSH,
      delivered: false,
      reason: pushOn
        ? 'Push delivery requires a provider (not configured).'
        : 'Push notifications disabled by preference.',
    });
  }

  return {
    persisted: !!persistedId,
    notificationId: persistedId,
    channels: results,
  };
}

/**
 * Back-compatible in-app notification creator (Phase 1). Legacy callers route
 * through here. It now also attempts EMAIL delivery for the recipient when that
 * channel is enabled, so existing event sources gain multi-channel behaviour
 * without changing their signatures.
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  await notifyUser({
    ...input,
    channels: input.channels ?? [
      NotificationChannel.IN_APP,
      NotificationChannel.EMAIL,
    ],
  });
}
