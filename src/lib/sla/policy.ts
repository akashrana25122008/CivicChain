/**
 * Phase 6 — Centralized SLA policy.
 *
 * A single source of truth for the resolution deadline CivicChain commits to
 * for an Issue. Deadlines are derived deterministically from severity (the
 * only signal reliably present when a Promise is formed), with optional
 * per-category and per-severity overrides from environment configuration.
 *
 * This is a POLICY: values here describe how long a response should take, not
 * how long it HAS taken (that is `calculateSlaState` in ./state). Deadlines are
 * never hardcoded in route handlers.
 */

export interface SlaDeadlines {
  /** Minutes after assignment an acknowledgement should occur. */
  acknowledgementMinutes: number;
  /** Minutes after assignment a resolution is promised. */
  resolutionMinutes: number;
}

export type SeverityKey = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** Baseline resolution SLA by severity (public-safety informed). */
export const RESOLUTION_SLA_MINUTES: Record<SeverityKey, number> = {
  LOW: 60 * 24 * 7, // 7 days
  MEDIUM: 60 * 24 * 3, // 3 days
  HIGH: 60 * 24 * 1, // 24 hours
  CRITICAL: 60 * 12, // 12 hours
};

/** Baseline acknowledgement SLA by severity. */
export const ACK_SLA_MINUTES: Record<SeverityKey, number> = {
  LOW: 60 * 24, // 24 hours
  MEDIUM: 60 * 8, // 8 hours
  HIGH: 60 * 4, // 4 hours
  CRITICAL: 60 * 2, // 2 hours
};

/**
 * Percentage of the SLA window elapsed at which an issue is considered
 * AT_RISK (configurable). The worker/serializer uses this to classify
 * ON_TRACK vs AT_RISK before BREACHED.
 *
 * NOTE: Changed from 0.8 to 0.7 to provide earlier warning when
 * an issue is approaching the SLA deadline. At 70% elapsed, 30%
 * of the SLA window still remains, giving authorities time to
 * take corrective action before hitting the AT_RISK threshold.
 */

export const AT_RISK_PCT = 0.7;

/** Parse a positive integer from the environment, falling back to a default. */
function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Effective acknowledgement + resolution deadlock for a severity. */
export function slaDeadlinesFor(severity: SeverityKey | null): SlaDeadlines {
  const key: SeverityKey = severity && severity in RESOLUTION_SLA_MINUTES ? severity : 'MEDIUM';
  return {
    acknowledgementMinutes: envInt(
      `SLA_ACK_MINUTES_${key}`,
      ACK_SLA_MINUTES[key],
    ),
    resolutionMinutes: envInt(
      `SLA_RESOLUTION_MINUTES_${key}`,
      RESOLUTION_SLA_MINUTES[key],
    ),
  };
}

/** Is this string a valid SeverityKey (safe for unknown/DB values)? */
export function isSeverityKey(value: unknown): value is SeverityKey {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(RESOLUTION_SLA_MINUTES, value)
  );
}
