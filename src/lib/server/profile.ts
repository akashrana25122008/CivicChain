/**
 * Profile editing helpers (Phase 14) — keeps validation in one testable place.
 * Email and role are identity/privilege attributes and are deliberately not
 * editable through this surface; only `name` may be updated.
 */
import type { ApiError } from '@/lib/server/api';
import { badRequest } from '@/lib/server/api';
import type { UserRole } from '../../../generated/prisma/client';

export interface ProfileView {
  name: string;
  email: string;
  role: UserRole;
}

export interface ProfilePatch {
  name?: string;
}

export function requireProfilePatch(input: Record<string, unknown>): {
  patch: ProfilePatch;
  error?: ApiError;
} {
  const allowed = new Set(['name']);
  const unknown = Object.keys(input).filter((k) => !allowed.has(k));
  if (unknown.length > 0) {
    return { patch: {}, error: badRequest(`Unknown profile field(s): ${unknown.join(', ')}.`) };
  }
  const patch: ProfilePatch = {};
  if ('name' in input) {
    const name = input.name;
    if (typeof name !== 'string' || name.trim().length === 0) {
      return { patch: {}, error: badRequest('"name" must be a non-empty string.') };
    }
    if (name.length > 80) {
      return { patch: {}, error: badRequest('"name" must be 80 characters or fewer.') };
    }
    patch.name = name.trim();
  }
  return { patch };
}
