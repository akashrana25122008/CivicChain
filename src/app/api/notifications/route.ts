import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/session';
import { handleApiError } from '@/lib/server/api';
import { formatRelativeTime } from '@/lib/utils';
import { prisma } from '@/lib/db';
import type { NotificationItem } from '@/lib/issues/types';

export async function GET() {
  try {
    const viewer = await requireUser();
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: viewer.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { issue: { select: { publicId: true } } },
      }),
      prisma.notification.count({ where: { userId: viewer.id, read: false } }),
    ]);

    const items: NotificationItem[] = notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      read: n.read,
      issueId: n.issueId,
      issuePublicId: n.issue?.publicId ?? null,
      createdAt: n.createdAt.toISOString(),
      timeLabel: formatRelativeTime(n.createdAt),
    }));

    return NextResponse.json({ notifications: items, unreadCount });
  } catch (error) {
    return handleApiError(error);
  }
}