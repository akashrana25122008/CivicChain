import { prisma } from '@/lib/db';
import { forbidden } from '@/lib/server/api';
import type { Authority, User } from '../../../generated/prisma/client';

/**
 * Server-side helpers for AUTHORITY-role users. The authority record is always
 * resolved from the authenticated user's id in the database — never from a
 * value sent by the browser.
 */
export function isAuthority(user: User): user is User & { role: 'AUTHORITY' } {
  return user.role === 'AUTHORITY';
}

export async function getOwnAuthority(user: User): Promise<Authority | null> {
  if (!isAuthority(user)) return null;
  return prisma.authority.findUnique({ where: { userId: user.id } });
}

/** Resolve the caller's authority or throw 403 when they have none. */
export async function requireOwnAuthority(user: User): Promise<Authority> {
  const authority = await getOwnAuthority(user);
  if (!authority) throw forbidden();
  return authority;
}

/** True when an issue is assigned to the given authority record. */
export function authorityOwnsIssue(
  authority: Authority,
  issueAuthorityId: string | null,
): boolean {
  return issueAuthorityId === authority.id;
}