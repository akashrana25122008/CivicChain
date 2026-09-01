/**
 * Canonical civic department registry (Phase 23 — first-class Department rows).
 *
 * Single source of truth for the seeded Department names. The dev seed
 * (prisma/seed.ts) creates these rows, and the rule-based routing mapping
 * (src/lib/issues/mapping.ts) resolves categories to these EXACT names, so a
 * typo here silently breaks authority routing. The integrity tests assert that
 * coupling: every mapped department must appear in this list.
 *
 * Client-bundle safe (no server imports) — but note it MUST stay in sync with
 * DEPARTMENT_BY_CATEGORY in mapping.ts, which is the routing source.
 */
export const DEPARTMENTS = [
  'Roads & Infrastructure Department',
  'Public Lighting Department',
  'Sanitation Department',
  'Water Supply Department',
  'Infrastructure Department',
];

export type DepartmentName = (typeof DEPARTMENTS)[number];

export function isDepartmentName(value: string): value is DepartmentName {
  return (DEPARTMENTS as readonly string[]).includes(value);
}