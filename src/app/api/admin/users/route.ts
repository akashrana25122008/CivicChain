import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/server/api';
import { requireRole } from '@/lib/server/session';
import { formatRelativeTime } from '@/lib/utils';
import { prisma } from '@/lib/db';
import { UserRole, RoleApprovalStatus } from '../../../../../generated/prisma/client';
import { recordAudit } from '@/lib/server/audit';

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

    // When `pending=true`, return only accounts awaiting role approval.
    const pendingOnly = sp.get('pending') === 'true';

    const where = {
      AND: [
        role ? { role } : {},
        pendingOnly ? { roleStatus: RoleApprovalStatus.PENDING } : {},
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
        select: {
          id: true, name: true, email: true, role: true, requestedRole: true, roleStatus: true,
          active: true,
          authorities: { include: { department: { select: { name: true } } } },
          karmaScore: true, createdAt: true,
        },
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
        requestedRole: u.requestedRole,
        roleStatus: u.roleStatus,
        active: u.active,
        authority: u.authorities[0] ? { id: u.authorities[0].id, name: u.authorities[0].name, department: u.authorities[0].department?.name ?? null } : null,
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
      departments: await prisma.authority.findMany({
        select: { id: true, name: true, department: { select: { name: true } } },
        orderBy: { name: 'asc' },
      }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

interface ReviewBody {
  id?: string;
  action?: 'approve' | 'reject' | 'deactivate' | 'activate';
  // For AUTHORITY approval: link to an existing department, or create a new one.
  authorityId?: string;
  departmentName?: string;
  departmentEmail?: string;
}

/** ADMIN-only review of pending role requests (approve / reject). */
export async function PATCH(request: Request) {
  try {
    const admin = await requireRole('ADMIN');
    const body = (await request.json().catch(() => ({}))) as ReviewBody;

    const id = body.id;
    if (!id || (body.action !== 'approve' && body.action !== 'reject' && body.action !== 'deactivate' && body.action !== 'activate')) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'A valid id and action (approve|reject|deactivate|activate) are required.' } },
        { status: 400 },
      );
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'User not found.' } },
        { status: 404 },
      );
    }

    if (body.action === 'deactivate') {
      if (target.id === admin.id) {
        return NextResponse.json(
          { error: { code: 'SELF_ACTION', message: 'You cannot deactivate your own account.' } },
          { status: 400 },
        );
      }
      if (!target.active) {
        return NextResponse.json(
          { error: { code: 'ALREADY_INACTIVE', message: 'This account is already deactivated.' } },
          { status: 400 },
        );
      }
      const updated = await prisma.user.update({
        where: { id },
        data: { active: false },
      });
      await recordAudit({
        action: 'USER_DEACTIVATED',
        actorId: admin.id,
        entityType: 'User',
        entityId: target.id,
        metadata: { email: target.email, role: target.role },
      });
      return NextResponse.json({ ok: true, user: { id: updated.id, active: updated.active } });
    }

    if (body.action === 'activate') {
      if (target.active) {
        return NextResponse.json(
          { error: { code: 'ALREADY_ACTIVE', message: 'This account is already active.' } },
          { status: 400 },
        );
      }
      const updated = await prisma.user.update({
        where: { id },
        data: { active: true },
      });
      await recordAudit({
        action: 'USER_REACTIVATED',
        actorId: admin.id,
        entityType: 'User',
        entityId: target.id,
        metadata: { email: target.email, role: target.role },
      });
      return NextResponse.json({ ok: true, user: { id: updated.id, active: updated.active } });
    }

    if (body.action === 'reject') {
      const updated = await prisma.user.update({
        where: { id },
        data: {
          roleStatus: RoleApprovalStatus.REJECTED,
          requestedRole: null,
          roleReviewedById: admin.id,
          roleReviewedAt: new Date(),
        },
      });
      await recordAudit({
        action: 'ROLE_REQUEST_REJECTED',
        actorId: admin.id,
        entityType: 'User',
        entityId: target.id,
        metadata: { email: target.email, requestedRole: target.requestedRole ?? null },
      });
      return NextResponse.json({ ok: true, user: { id: updated.id, role: updated.role, roleStatus: updated.roleStatus } });
    }

    // approve
    const requested = target.requestedRole;
    if (!requested || requested === UserRole.CITIZEN) {
      return NextResponse.json(
        { error: { code: 'NOT_PENDING', message: 'This account has no pending privileged role request.' } },
        { status: 400 },
      );
    }

    if (requested === UserRole.AUTHORITY) {
      // Link to an existing department (recommended) or create a new one.
      if (body.authorityId) {
        const authority = await prisma.authority.findUnique({ where: { id: body.authorityId } });
        if (!authority) {
          return NextResponse.json(
            { error: { code: 'NOT_FOUND', message: 'Selected department not found.' } },
            { status: 404 },
          );
        }
        await prisma.authority.update({
          where: { id: authority.id },
          data: { userId: target.id, email: body.departmentEmail ?? target.email },
        });
      } else {
        const deptName = body.departmentName?.trim();
        if (!deptName) {
          return NextResponse.json(
            { error: { code: 'INVALID_INPUT', message: 'Provide an existing department or a department name to create one.' } },
            { status: 400 },
          );
        }
        // Create (or reuse) the first-class Department, then link the new
        // Authority to it — the authority's "department" is no longer a bare
        // string (Phase 23).
        const department = await prisma.department.upsert({
          where: { name: deptName },
          update: {},
          create: { name: deptName },
        });
        await prisma.authority.create({
          data: {
            name: deptName,
            departmentId: department.id,
            email: body.departmentEmail ?? target.email,
            userId: target.id,
          },
        });
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        role: requested,
        roleStatus: RoleApprovalStatus.APPROVED,
        roleReviewedById: admin.id,
        roleReviewedAt: new Date(),
      },
    });

    await recordAudit({
      action: 'ROLE_REQUEST_APPROVED',
      actorId: admin.id,
      entityType: 'User',
      entityId: target.id,
      metadata: { email: target.email, grantedRole: requested },
    });

    return NextResponse.json({ ok: true, user: { id: updated.id, role: updated.role, roleStatus: updated.roleStatus } });
  } catch (error) {
    return handleApiError(error);
  }
}