/**
 * Canonical escalation ladder (Phase 7).
 *
 * The numeric level is what the database persists on the Escalation model
 * (`level`). These shared labels + counts keep the ladder a single source of
 * truth instead of arbitrary strings scattered through the app.
 */
export const ESCALATION_LEVELS = [1, 2, 3, 4] as const;

export type EscalationLevelNumber = (typeof ESCALATION_LEVELS)[number];

export const ESCALATION_LEVEL_LABELS: Record<EscalationLevelNumber, string> = {
  1: 'Department Officer',
  2: 'Department Head',
  3: 'Municipal Authority',
  4: 'Admin',
};

export const MAX_ESCALATION_LEVEL: EscalationLevelNumber = 4;

/** Human label for any persisted level number (unknown values fall back). */
export function escalationLevelLabel(level: number): string {
  return ESCALATION_LEVEL_LABELS[(level as EscalationLevelNumber)] ?? `Level ${level}`;
}

/** Next legal ladder step above `level` (never exceeds 4). */
export function nextEscalationLevel(from: number): number {
  const next = from + 1;
  return next > MAX_ESCALATION_LEVEL ? MAX_ESCALATION_LEVEL : next;
}
