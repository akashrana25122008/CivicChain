/**
 * Phase 6 — SLA state calculation.
 *
 * Deterministic, pure computation of an Issue's SLA standing from its Promise
 * deadline. Returns the spec's canonical SLA states — ON_TRACK / AT_RISK /
 * BREACHED / RESOLVED — which are deliberately SEPARATE from Issue lifecycle
 * status and from the persisted PromiseStatus (those remain DB enums).
 *
 * This is the single source of truth for "how is the promise doing?". The
 * periodic SLA worker (Phase 5, Redis) will call this on a schedule; until
 * then the serializers/APIs surface the same computed result on read.
 */

import { AT_RISK_PCT } from './policy';

export type SlaState = 'ON_TRACK' | 'AT_RISK' | 'BREACHED' | 'RESOLVED';

export interface SlaSnapshot {
  /** Canonical SLA state for the Promise right now. */
  slaState: SlaState;
  /** 0-100 percentage of the window elapsed; 100 when breached. */
  slaPctElapsed: number;
  /** Milliseconds remaining until breach; <= 0 when breached/elapsed. */
  timeRemainingMs: number;
  /** True when the issue lifecycle is already resolved. */
  resolved: boolean;
}

export interface SlaStateInput {
  deadline: Date;
  createdAt: Date;
  /** Is the issue already resolved/completed? */
  resolved?: boolean;
  /** Wall-clock "now"; injected for deterministic tests. */
  now?: Date;
}

/**
 * Compute the current SLA snapshot for a Promise.
 *  - RESOLVED        -> lifecycle resolved (SLA honour achieved).
 *  - deadline passed -> BREACHED.
 *  - >= AT_RISK_PCT  -> AT_RISK.
 *  - otherwise       -> ON_TRACK.
 */
export function calculateSlaState(input: SlaStateInput): SlaSnapshot {
  const { deadline, createdAt, resolved = false, now = new Date() } = input;

  if (resolved) {
    return { slaState: 'RESOLVED', slaPctElapsed: 100, timeRemainingMs: 0, resolved: true };
  }

  const total = deadline.getTime() - createdAt.getTime();
  // No usable window (deadline in the past or equal) is treated as breached.
  if (total <= 0) {
    return { slaState: 'BREACHED', slaPctElapsed: 100, timeRemainingMs: 0, resolved: false };
  }

  const elapsedRaw = now.getTime() - createdAt.getTime();
  const elapsed = Math.max(0, Math.min(total, elapsedRaw));
  const pct = (elapsed / total) * 100;
  const remaining = deadline.getTime() - now.getTime();

  let state: SlaState;
  if (remaining <= 0) {
    state = 'BREACHED';
  } else if (pct >= AT_RISK_PCT * 100) {
    state = 'AT_RISK';
  } else {
    state = 'ON_TRACK';
  }

  return {
    slaState: state,
    slaPctElapsed: Math.round(pct * 100) / 100,
    timeRemainingMs: Math.max(0, remaining),
    resolved: false,
  };
}
