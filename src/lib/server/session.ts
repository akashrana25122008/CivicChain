import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db';
import { forbidden, unauthorized } from '@/lib/server/api';
import type { User } from '../../../generated/prisma/client';

/**
 * Returns the authoritative user from the database for the current session.
 * The role on this record is the ONLY role the server trusts — never a value
 * coming from the browser, and never a stale value cached in the JWT alone.
 */
export async function getSessionUser(): Promise<User | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    // Phase 24 — a deactivated account is treated as signed out everywhere.
    // Existing JWT sessions remain technically valid at the edge, but every
    // server-side authorization flows through this function, so an inactive
    // account cannot act until reactivated.
    if (!user || !user.active) return null;
    return user;
  } catch {
    return null;
  }
}

/** Get the session user or throw 401. */
export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) throw unauthorized();
  return user;
}

/** Get the session user and require one of the given roles. */
export async function requireRole(...roles: Array<'CITIZEN' | 'AUTHORITY' | 'ADMIN'>): Promise<User> {
  const user = await requireUser();
  if (!roles.includes(user.role as 'CITIZEN' | 'AUTHORITY' | 'ADMIN')) {
    throw forbidden();
  }
  return user;
}