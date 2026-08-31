/**
 * Phase 16 — Department priority queue ordering.
 *
 * A pure, deterministic ranking for the Department Command Center work queue.
 * It NEVER re-implements the risk or SLA formulas — it consumes their already
 * computed outputs (a risk level from the Phase 11 risk engine, an SLA state
 * from the Phase 6 SLA evaluator) and folds them into a single actionable
 * urgency score alongside severity, escalation level, and age.
 *
 * The resulting score is used purely for ORDERING the queue (and for the
 * "needs attention now" signal). It is deliberately separate from the
 * persisted `Issue.priority` (0-100 intelligence score) — that value stays the
 * authoritative AI/priority-engine score; this queue rank is an operator
 * triage view computed on read.
 */

import { calculateSlaState } from '@/lib/sla/state';
import { severityToScore } from '@/lib/risk/scoring';
import type { RiskLevel } from '@/lib/risk/scoring';
import type { IssueStatus, Severity } from '../../../generated/prisma/client';

export type SlaState = 'ON_TRACK' | 'AT_RISK' | 'BREACHED' | 'RESOLVED';

export interface QueueIssueInput {
  id: string;
  status: IssueStatus;
  severity: Severity | null;
  /** Persisted 0-100 intelligence priority score (may be null). */
  priority: number | null;
  /** Current highest open escalation level (0 = none). */
  escalationLevel: number;
  /** Computed risk level from the Phase 11 engine (may be undefined). */
  riskLevel?: RiskLevel | null;
  createdAt: Date;
  /** Promise deadline, when a promise is owed. */
  slaDeadline?: Date | null;
  /** Issue creation time used for the SLA window base. */
  slaCreatedAt?: Date | null;
  /** Wall-clock "now", injected for deterministic tests. */
  now?: Date;
}

export interface QueueRank {
  /** Pure ordering 0-100. Higher = more urgent. */
  score: number;
  level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  /** Sorted descending components behind the score (for tooltips). */
  components: Array<{ key: string; label: string; contribution: number }>;
  slaState: SlaState;
}

// Weights are tuned so SLA urgency and risk dominate an operator queue.
const WEIGHTS = {
  severity: 0.2,
  sla: 0.35,
  risk: 0.2,
  escalation: 0.15,
  age: 0.1,
} as const;

const SLA_STATE_SCORES: Record<SlaState, number> = {
  BREACHED: 100,
  AT_RISK: 75,
  ON_TRACK: 30,
  RESOLVED: 0,
};

const ESCALATION_SCORES: Record<number, number> = {
  0: 0,
  1: 40,
  2: 60,
  3: 80,
  4: 100,
};

const RISK_SCORES: Record<string, number> = {
  LOW: 20,
  MEDIUM: 50,
  HIGH: 80,
  CRITICAL: 100,
};

/** 0-100 severity-of-the-issue component (reuses the Phase 11 mapping only). */
function severityComponent(severity: Severity | null): number {
  return severityToScore(severity);
}

/** Escalation urgency 0-100 from the current open ladder level. */
function escalationComponent(level: number): number {
  return ESCALATION_SCORES[level] ?? 0;
}

/** 0-100 risk component from the computed Phase 11 risk level. */
function riskComponent(riskLevel: RiskLevel | null | undefined): number {
  if (!riskLevel) return 0;
  return RISK_SCORES[riskLevel] ?? 0;
}

/** Age urgency: older active issues get a mild bump that saturates at 14 days. */
function ageComponent(createdAt: Date, now: Date): number {
  const hours = Math.max(0, (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
  return Math.min(100, Math.round((hours / (14 * 24)) * 100));
}

/** Resolve the SLA standing, reusing the canonical SLA evaluator. */
function resolveSla(input: QueueIssueInput, now: Date): SlaState {
  if (!input.slaDeadline) return 'ON_TRACK';
  const resolved =
    input.status === 'RESOLVED' ||
    input.status === 'REJECTED';
  return calculateSlaState({
    deadline: input.slaDeadline,
    createdAt: input.slaCreatedAt ?? input.createdAt,
    resolved,
    now,
  }).slaState;
}

/**
 * Rank a single issue for the department queue.
 *
 * Already-resolved/rejected issues always rank at the bottom so closed work
 * never consumes operator attention.
 */
export function rankQueueItem(input: QueueIssueInput): QueueRank {
  const now = input.now ?? new Date();
  const slaState = resolveSla(input, now);
  const closed = input.status === 'RESOLVED' || input.status === 'REJECTED';

  const severity = severityComponent(input.severity);
  const sla = SLA_STATE_SCORES[slaState];
  const risk = riskComponent(input.riskLevel);
  const escalation = escalationComponent(input.escalationLevel);
  const age = ageComponent(input.createdAt, now);

  // Closed work collapses to the floor so it never outranks anything active.
  const effective = closed ? 0 : 1;

  const score = Math.round(
    (severity * WEIGHTS.severity +
      sla * WEIGHTS.sla +
      risk * WEIGHTS.risk +
      escalation * WEIGHTS.escalation) *
      effective,
  );

  const level: QueueRank['level'] =
    score >= 80 ? 'CRITICAL' : score >= 60 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW';

  return {
    score,
    level,
    components: [
      { key: 'severity', label: 'Severity', contribution: Math.round(severity * WEIGHTS.severity) },
      { key: 'sla', label: 'SLA', contribution: Math.round(sla * WEIGHTS.sla) },
      { key: 'risk', label: 'Risk', contribution: Math.round(risk * WEIGHTS.risk) },
      { key: 'escalation', label: 'Escalation', contribution: Math.round(escalation * WEIGHTS.escalation) },
      { key: 'age', label: 'Age', contribution: Math.round(age * WEIGHTS.age) },
    ],
    slaState,
  };
}

export interface QueueSorterParams {
  issues: QueueIssueInput[];
  now?: Date;
  /** Optional: only include issues in these lifecycle statuses. */
  statuses?: IssueStatus[];
  /** Optional: only include issues that are active (not resolved/rejected). */
  activeOnly?: boolean;
}

/**
 * Sort a list of issues by the computed queue urgency, highest first. Ties
 * break on recency (older first) then the persisted intelligence priority.
 */
export function sortQueue(
  params: QueueSorterParams,
): Array<{ input: QueueIssueInput; rank: QueueRank }> {
  const { issues, now } = params;
  const statusFilter = params.statuses ? new Set(params.statuses) : null;

  const ranked = issues
    .filter((issue) => {
      if (statusFilter && !statusFilter.has(issue.status)) return false;
      if (params.activeOnly && (issue.status === 'RESOLVED' || issue.status === 'REJECTED')) {
        return false;
      }
      return true;
    })
    .map((input) => ({ input, rank: rankQueueItem({ ...input, now }) }));

  ranked.sort((a, b) => {
    if (b.rank.score !== a.rank.score) return b.rank.score - a.rank.score;
    if (a.input.createdAt.getTime() !== b.input.createdAt.getTime()) {
      return a.input.createdAt.getTime() - b.input.createdAt.getTime();
    }
    return (b.input.priority ?? 0) - (a.input.priority ?? 0);
  });

  return ranked;
}
