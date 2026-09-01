/**
 * Pure access-control decision helpers (Phase 21).
 *
 * Centralizes the role-hierarchy and object-access rules so they can be unit
 * tested for IDOR (insecure direct object reference) and privilege-escalation
 * regressions without a database. Route handlers call these pure predicates to
 * decide whether a viewer may read/write a resource owned by someone else.
 *
 * Roles (local, intentionally independent of the generated Prisma enum so the
 * security contract is exercised directly): CITIZEN < AUTHORITY < ADMIN.
 */

export type Role = 'CITIZEN' | 'AUTHORITY' | 'ADMIN';

/** Strict role ordering: a caller may act as any role at-or-below theirs,
 *  but never escalate to a higher role. */
const ROLE_RANK: Record<Role, number> = { CITIZEN: 1, AUTHORITY: 2, ADMIN: 3 };

export function roleRank(role: Role): number {
  return ROLE_RANK[role];
}

/** True when `viewer` holds `required` or a strictly higher role. */
export function hasRole(viewer: Role, required: Role): boolean {
  return ROLE_RANK[viewer] >= ROLE_RANK[required];
}

/** True when the viewer is an admin. */
export function isAdmin(viewer: Role): boolean {
  return viewer === 'ADMIN';
}

/** True when the viewer is a department authority. */
export function isAuthority(viewer: Role): boolean {
  return viewer === 'AUTHORITY';
}

/* ---------------------------------------------------------------------------
 * Object access rules (evidence / issues)
 * ------------------------------------------------------------------------- */

export interface IssueScope {
  reporterId?: string | null;
  authorityId?: string | null;
}

/**
 * May `viewerId` read an issue/evidence object owned by `scope`?
 *
 *  - Admin: yes (highest privilege; also used for audit/remediation).
 *  - Authority: yes IF the object is assigned to their authority department.
 *  - Citizen: yes only for their OWN reports.
 *
 * No viewer escalates: a citizen can never read a report assigned to an
 * authority (or another citizen), and an authority can never read a report
 * that is not theirs OR not assigned to their authority — even if they know
 * the object id (this is the IDOR guard).
 */
export function canReadIssue(viewer: Role, viewerId: string, scope: IssueScope): boolean {
  if (isAdmin(viewer)) return true;
  if (isAuthority(viewer)) return Boolean(scope.authorityId && scope.authorityId === viewerId);
  return Boolean(scope.reporterId && scope.reporterId === viewerId);
}

/**
 * May `viewerId` mutate an issue/evidence object? The same rule as read for
 * this codebase (no elevated-write path exists), but as a distinct predicate so
 * write-path regressions are caught separately.
 */
export function canMutateIssue(viewer: Role, viewerId: string, scope: IssueScope): boolean {
  return canReadIssue(viewer, viewerId, scope);
}

/* ---------------------------------------------------------------------------
 * Admin / department surface gates
 * ------------------------------------------------------------------------- */

/** The ADMIN and DEPARTMENT surfaces are role-gated at two layers. */
export function canEnterAdmin(viewer: Role): boolean {
  return isAdmin(viewer);
}

export function canEnterDepartment(viewer: Role): boolean {
  return isAuthority(viewer) || isAdmin(viewer);
}

/**
 * A department authority may only act on issues assigned to THEIR authority.
 * This function takes the authority's resolved department id and the object's
 * assigned authority id — no authority may reach another authority's queue by
 * supplying a foreign authorityId (privilege-escalation guard).
 */
export function authorityOwnsIssue(
  viewerRole: Role,
  viewerAuthorityId: string | null | undefined,
  scope: IssueScope,
): boolean {
  if (isAdmin(viewerRole)) return true;
  if (!isAuthority(viewerRole)) return false;
  return Boolean(viewerAuthorityId && scope.authorityId === viewerAuthorityId);
}
