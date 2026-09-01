/**
 * Phase 19 — Analytics Engine: shared metric types.
 *
 * A single, typed vocabulary describing every metric family the Analytics
 * Service can produce. Consumers (the admin API + UI) depend on these shapes
 * so all metric modules stay interchangeable and the aggregate payload is
 * self-describing.
 */

// ---------------------------------------------------------------------------
// Time range
// ---------------------------------------------------------------------------

export type TimeRange = '7d' | '30d' | '90d' | 'all';

export interface RangeWindow {
  /** Canonical range key the caller requested. */
  range: TimeRange;
  /** Inclusive lower bound (null for 'all'). */
  from: Date | null;
  /** Inclusive upper bound (null for 'all'). */
  to: Date | null;
  /** Number of trailing days used for range-bounded windows; 0 for 'all'. */
  days: number;
}

// ---------------------------------------------------------------------------
// Trends, anomalies & insights
// ---------------------------------------------------------------------------

export interface MetricTrend {
  /** Latest window value. */
  current: number;
  /** Previous equivalent window value. */
  previous: number;
  /** Percentage change vs previous window (positive = increase). */
  percentage: number;
  /** INCREASING / STABLE / DECREASING — via the shared risk trend util. */
  direction: 'INCREASING' | 'STABLE' | 'DECREASING';
}

export type AnomalySeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Anomaly {
  key: string;
  label: string;
  severity: AnomalySeverity;
  /** Machine-readable detail (e.g. the outlier value + expected band). */
  detail: string;
  /** Point-in-time comparison surfaced to operators. */
  current: number;
  expected: number;
}

export interface Insight {
  id: string;
  category:
    | 'issue'
    | 'resolution'
    | 'sla'
    | 'duplicate'
    | 'verification'
    | 'escalation'
    | 'department'
    | 'ward'
    | 'satisfaction'
    | 'ai';
  title: string;
  detail: string;
  tone: 'positive' | 'negative' | 'neutral';
}

// ---------------------------------------------------------------------------
// Domain metric payloads
// ---------------------------------------------------------------------------

export interface IssueMetric {
  total: number;
  active: number;
  resolved: number;
  rejected: number;
  byStatus: Array<{ status: string; count: number }>;
  byCategory: Array<{ category: string; label: string; count: number }>;
  byDepartment: Array<{ authorityId: string | null; label: string; count: number }>;
  overTime: Array<{ day: string; value: number }>;
  trend: MetricTrend;
}

export interface ResolutionMetric {
  resolutionRatePct: number | null;
  avgResolutionMinutes: number | null;
  resolvedCount: number;
  /** Average time to first response (SUBMITTED -> first status change), minutes. */
  avgFirstResponseMinutes: number | null;
  /** Reopen rate: RESOLVED issues later transitioned away from RESOLVED / all resolved. */
  reopenCount: number;
  reopenRatePct: number | null;
  trend: MetricTrend | null;
}

export interface SlaMetric {
  onTrack: number;
  atRisk: number;
  breached: number;
  activePromises: number;
  breachRatePct: number | null;
  byDepartment: Array<{ authorityId: string | null; label: string; breached: number; atRisk: number; onTrack: number }>;
}

export interface DuplicateMetric {
  totalIncidents: number;
  duplicateCoveragePct: number | null;
  countsByIncidentSize: Array<{ size: number; incidentCount: number }>;
  avgReportsPerIncident: number | null;
  duplicateMarkedReports: number;
}

export interface VerificationMetric {
  pending: number;
  verified: number;
  rejected: number;
  total: number;
  verificationRatePct: number | null;
  avgVerifyTimeMinutes: number | null;
}

export interface EscalationMetric {
  total: number;
  active: number;
  resolved: number;
  byLevel: Array<{ level: number; count: number }>;
  avgEscalationsPerIssue: number | null;
  escalationsResolvedPct: number | null;
}

export interface DepartmentMetric {
  rank: Array<{
    authorityId: string | null;
    label: string;
    issueCount: number;
    resolvedCount: number;
    resolutionRatePct: number | null;
    avgResolutionMinutes: number | null;
    activeCount: number;
    breached: number;
  }>;
}

export interface WardRiskMetric {
  totalAreas: number;
  lowRiskAreas: number;
  mediumRiskAreas: number;
  highRiskAreas: number;
  criticalRiskAreas: number;
  totalActiveIssues: number;
  totalSlaBreaches: number;
  avgScore: number;
  /** Highest-risk areas (top few) for the analytic surface. */
  topAreas: Array<{ areaName: string; riskScore: number; riskLevel: string; activeIncidents: number }>;
}

export interface SatisfactionMetric {
  confirmVotes: number;
  supportVotes: number;
  disputeVotes: number;
  duplicateVotes: number;
  totalVotes: number;
  /** Approving signal share: (confirm+support)/total votes; null when no votes. */
  netSatisfactionPct: number | null;
  totalKarmaAwarded: number;
}

export interface AiMetric {
  totalAnalyses: number;
  completed: number;
  failed: number;
  pending: number;
  avgConfidence: number | null;
  /** Share of completed analyses whose AI category matches the post-review issue category. */
  categoryAccuracyPct: number | null;
}

// ---------------------------------------------------------------------------
// Aggregate payload
// ---------------------------------------------------------------------------

export interface AnalyticsPayload {
  generatedAt: string;
  range: TimeRange;
  issues: IssueMetric;
  resolution: ResolutionMetric;
  sla: SlaMetric;
  duplicate: DuplicateMetric;
  verification: VerificationMetric;
  escalation: EscalationMetric;
  department: DepartmentMetric;
  wardRisk: WardRiskMetric;
  satisfaction: SatisfactionMetric;
  ai: AiMetric;
  anomalies: Anomaly[];
  insights: Insight[];
}
