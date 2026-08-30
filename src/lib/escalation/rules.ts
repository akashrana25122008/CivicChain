import type { Severity } from '../../../generated/prisma/client';

/**
 * Pure, side-effect-free evaluation of an EscalationRule against a single
 * Issue snapshot. Separated from the DB-backed engine so the decision logic is
 * unit-testable without a database.
 *
 * Supported numeric/enum gates in `rule.conditions` (JSON):
 *   { slaPctGte: number }            -> SLA deadline elapsed at least this %
 *   { statusNotIn: string[] }        -> disallow matching these lifecycle states
 */
export interface RuleSnapshot {
  /** Current lifecycle status. */
  status: string;
  /** Current issue severity (unknown = null). */
  severity: Severity | null;
  /** Current 0-100 priority score (unknown = null). */
  priority: number | null;
  /** Current escalation level already reached (0 = none). */
  level: number;
  /** Percentage of the SLA window elapsed (0-100); null when no SLA/deadline. */
  slaPct: number | null;
}

export interface RuleConditions {
  slaPctGte?: number;
  statusNotIn?: string[];
}

export function parseRuleConditions(conditions: unknown): RuleConditions {
  if (!conditions || typeof conditions !== 'object') return {};
  const c = conditions as Record<string, unknown>;
  const out: RuleConditions = {};
  if (typeof c.slaPctGte === 'number') out.slaPctGte = c.slaPctGte;
  if (Array.isArray(c.statusNotIn)) {
    out.statusNotIn = c.statusNotIn.filter((s): s is string => typeof s === 'string');
  }
  return out;
}

export interface EscalationDecision {
  matches: boolean;
  reasons: string[];
}

/**
 * Does this rule fire for the given Issue snapshot? Enforces, in order:
 * enabled, level already reached (fromLevel), severity gate, priority gate,
 * SLA gate, and status-not-in gate. Pure — no I/O.
 */
export function evaluateRule(
  rule: {
    enabled: boolean;
    fromLevel: number;
    minSeverity: Severity | null;
    minPriority: number | null;
    conditions: unknown;
  },
  snapshot: RuleSnapshot,
): EscalationDecision {
  const reasons: string[] = [];

  if (!rule.enabled) {
    reasons.push('rule disabled');
    return { matches: false, reasons };
  }

  // Only advance the ladder: skip if the issue has already reached or
  // exceeded the rule's base level (prevents re-escalating the same step).
  if (snapshot.level > rule.fromLevel) {
    return { matches: false, reasons: ['already escalated past this step'] };
  }
  if (rule.fromLevel > 0 && snapshot.level !== rule.fromLevel) {
    return { matches: false, reasons: ['base level not reached'] };
  }

  if (rule.minSeverity) {
    if (!snapshot.severity) return { matches: false, reasons: ['severity unknown'] };
    if (severityRank(snapshot.severity) < severityRank(rule.minSeverity)) {
      return { matches: false, reasons: ['severity below threshold'] };
    }
  }

  if (rule.minPriority != null) {
    if (snapshot.priority == null) return { matches: false, reasons: ['priority unknown'] };
    if (snapshot.priority < rule.minPriority) {
      return { matches: false, reasons: ['priority below threshold'] };
    }
  }

  const cond = parseRuleConditions(rule.conditions);
  if (cond.slaPctGte != null) {
    if (snapshot.slaPct == null) return { matches: false, reasons: ['no SLA available'] };
    if (snapshot.slaPct < cond.slaPctGte) return { matches: false, reasons: ['SLA not far enough along'] };
  }
  if (cond.statusNotIn && cond.statusNotIn.includes(snapshot.status)) {
    return { matches: false, reasons: ['lifecycle status excluded by rule'] };
  }

  return { matches: true, reasons: ['all rule conditions satisfied'] };
}

/** Ordinal for comparing severity thresholds (LOW < MEDIUM < HIGH < CRITICAL). */
function severityRank(s: Severity): number {
  switch (s) {
    case 'CRITICAL':
      return 4;
    case 'HIGH':
      return 3;
    case 'MEDIUM':
      return 2;
    default:
      return 1;
  }
}
