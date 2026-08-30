import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { RoleApprovalStatus, UserRole } from '../../../../../generated/prisma/client';

/**
 * Self-service signup for a requested role.
 *
 * Security model: a privileged role (AUTHORITY / ADMIN) is NEVER granted at
 * signup. This endpoint records a PENDING request — the user is created as a
 * CITIZEN with `requestedRole`/`roleStatus=PENDING` set — and an existing
 * ADMIN must later approve it (see the admin users panel). Pure CITIZEN
 * signup needs no approval.
 *
 * The magic-link sign-in (EmailProvider) subsequently finds this pre-created
 * user via PrismaAdapter and does not overwrite the recorded role request.
 */
export async function POST(request: NextRequest) {
  try {
    if (request.headers.get('content-type')?.includes('application/json')) {
      const body = await request.json().catch(() => null);
      const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
      const requested = typeof body?.requestedRole === 'string' ? body.requestedRole : 'CITIZEN';

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json(
          { error: { code: 'INVALID_EMAIL', message: 'A valid email address is required.' } },
          { status: 400 },
        );
      }

      const requestedRole = Object.values(UserRole).includes(requested as UserRole)
        ? (requested as UserRole)
        : UserRole.CITIZEN;

      const isPrivileged =
        requestedRole === UserRole.AUTHORITY || requestedRole === UserRole.ADMIN;

      const existing = await prisma.user.findUnique({ where: { email } });

      if (existing) {
        // Never downgrade or alter an existing account's granted role here.
        // Only record a request if the user is asking for a privileged role
        // they don't already hold.
        if (isPrivileged && existing.role === UserRole.CITIZEN && existing.roleStatus !== RoleApprovalStatus.PENDING) {
          await prisma.user.update({
            where: { id: existing.id },
            data: { requestedRole, roleStatus: RoleApprovalStatus.PENDING },
          });
        }
        return NextResponse.json({ ok: true, existing: true });
      }

      await prisma.user.create({
        data: {
          email,
          role: UserRole.CITIZEN,
          ...(isPrivileged
            ? { requestedRole, roleStatus: RoleApprovalStatus.PENDING }
            : {}),
        },
      });

      return NextResponse.json({ ok: true, existing: false });
    }

    return NextResponse.json(
      { error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Send a JSON body.' } },
      { status: 415 },
    );
  } catch (error) {
    console.error('register error', error);
    return NextResponse.json(
      { error: { code: 'REGISTER_FAILED', message: 'Could not register. Please try again.' } },
      { status: 500 },
    );
  }
}
