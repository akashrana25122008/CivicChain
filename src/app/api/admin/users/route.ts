import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/server/api';
import { requireRole } from '@/lib/server/session';
import { formatRelativeTime } from '@/lib/utils';
import { prisma } from '@/lib/db';
import { UserRole } from '../../../../../generated/prisma/client';

const ROLE_LABELS: Record<UserRole, string> = {
  CITIZEN: 'Citizen',
  AUTHORITY: 'Authority',
  ADMIN: 'Administrator',
};

/** ADMIN-only directory of all platform users (search/filter/paged). */
export async function GET(request: NextRequest) {
  try {
    await requireRole('ADMIN');
    const sp = request.nextUrl.searchParams;

    const requestedRole = sp.get('role');
    const role = requestedRole && Object.values(UserRole).includes(requestedRole as UserRole)
      ? (requestedRole as UserRole)
      : null;
    const term = sp.get('q')?.trim();
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const requestedSize = Number(sp.get('pageSize')) || 20;
    const pageSize = Math.min(100, Math.max(1, requestedSize));

    const where = {
      AND: [
        role ? { role } : {},
        term
          ? {
              OR: [
                { name: { contains: term, mode: 'insensitive' as const } },
                { email: { contains: term, mode: 'insensitive' as const } },
              ],
            }
          : {},
      ],
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, name: true, email: true, role: true, karmaScore: true, createdAt: true },
      }),
      prisma.user.count({ where }),
    ]);

    const ids = users.map((u) => u.id);
    const [reportCounts, unreadCounts] = await Promise.all([
      prisma.issue.groupBy({ by: ['reporterId'], where: { reporterId: { in: ids } }, _count: { _all: true } }),
      prisma.notification.groupBy({
        by: ['userId'],
        where: { userId: { in: ids }, read: false },
        _count: { _all: true },
      }),
    ]);
    const reportsByUser = new Map(reportCounts.map((r) => [r.reporterId, r._count._all]));
    const unreadByUser = new Map(unreadCounts.map((r) => [r.userId, r._count._all]));

    return NextResponse.json({
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        roleLabel: ROLE_LABELS[u.role] ?? u.role,
        karmaScore: u.karmaScore,
        createdAt: u.createdAt.toISOString(),
        timeLabel: formatRelativeTime(u.createdAt),
        reportsCount: reportsByUser.get(u.id) ?? 0,
        notificationsUnread: unreadByUser.get(u.id) ?? 0,
      })),
      total,
      page,
      pageSize,
      pageCount: Math.ceil(total / pageSize),
    });
  } catch (error) {
    return handleApiError(error);
  }
}