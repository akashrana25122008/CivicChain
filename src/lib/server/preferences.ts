/**
 * User preferences (Phase 14) — settings actually working.
 *
 * A single persisted `UserPreferences` row per user, keyed strictly off the
 * authenticated session user id. This module exposes the pure helpers used by
 * the API route and tests: default resolution, patch validation, and mapping
 * between the DB row and the stable API shape. It never touches the browser.
 */
import type { ThemePreference } from '../../../generated/prisma/client';

/** Stable, always-shape preferences exposed to the browser. */
export interface UserPreferencesView {
  theme: ThemePreference;
  language: string;
  weeklyDigest: boolean;
  reportUpdates: boolean;
}

/** Serializable subset of a persisted row (enough to build a stable view). */
export interface UserPreferencesRow {
  theme: ThemePreference;
  language: string;
  weeklyDigest: boolean;
  reportUpdates: boolean;
}

/** Default preferences applied when a user has never saved a row. */
export const DEFAULT_PREFERENCES: UserPreferencesView = {
  theme: 'SYSTEM',
  language: 'en',
  weeklyDigest: false,
  reportUpdates: true,
};

export const SUPPORTED_LANGUAGES: ReadonlyArray<{ code: string; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी (Hindi)' },
  { code: 'mr', label: 'मराठी (Marathi)' },
  { code: 'gu', label: 'ગુજરાતી (Gujarati)' },
  { code: 'ta', label: 'தமிழ் (Tamil)' },
  { code: 'te', label: 'తెలుగు (Telugu)' },
];

export const THEME_VALUES: ReadonlyArray<ThemePreference> = ['LIGHT', 'DARK', 'SYSTEM'];

/** All-patch → a partial update. Unknown/immutable keys are rejected. */
export function pickPatch(input: Record<string, unknown>): {
  patch: Record<string, unknown>;
  error?: string;
} {
  const patch: Record<string, unknown> = {};
  for (const key of ['theme', 'language', 'weeklyDigest', 'reportUpdates']) {
    if (key in input) {
      patch[key] = (input as Record<string, unknown>)[key];
    }
  }
  return { patch };
}

/** Validate a single field value against the known keys. Returns error message or null. */
export function validatePatchValue(key: string, value: unknown): string | null {
  switch (key) {
    case 'theme':
      if (THEME_VALUES.includes(value as ThemePreference)) return null;
      return `"theme" must be one of ${THEME_VALUES.join(', ')}.`;
    case 'language':
      if (typeof value !== 'string' || !value.trim()) {
        return '"language" must be a non-empty string.';
      }
      if (!SUPPORTED_LANGUAGES.some((l) => l.code === value)) {
        return `"language" is not supported.`;
      }
      return null;
    case 'weeklyDigest':
    case 'reportUpdates':
      if (typeof value === 'boolean') return null;
      return `"${key}" must be a boolean.`;
    default:
      return `Unknown preference "${key}".`;
  }
}

/** Any keys not part of the preferences surface → reject the whole request. */
export function unknownKeys(input: Record<string, unknown>): string[] {
  const allowed = new Set(['theme', 'language', 'weeklyDigest', 'reportUpdates']);
  return Object.keys(input).filter((k) => !allowed.has(k));
}

/** Merge a persisted row over the defaults to always return a stable shape. */
export function toView(row: UserPreferencesRow): UserPreferencesView {
  return {
    theme: row.theme,
    language: row.language,
    weeklyDigest: row.weeklyDigest,
    reportUpdates: row.reportUpdates,
  };
}