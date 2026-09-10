/**
 * Shared contract between the server API and the client UI for civic issues.
 * The target: the same UI components keep rendering the same shapes while their
 * data source moved from hardcoded constants to the database (Phase 1).
 */

export interface IssueListItem {
  id: string;
  publicId: string;
  title: string;
  category: string;
  categoryLabel: string;
  status: string;
  statusLabel: string;
  /** Badge status vocabulary used by the existing UI (active, assigned, …). */
  displayStatus: string;
  severity: string | null;
  severityLabel: string | null;
  priority: number | null;
  priorityLevel: string | null;
  location: string | null;
  authority: string | null;
  promiseLabel: string | null;
  /** Number of merged citizen reports. Always 1 until duplicate merging exists. */
  reportCount: number;
  createdAt: string;
  updatedAt: string;
  timeLabel: string;
  /** Authority promise deadline (ISO), if a promise exists for the issue. */
  promiseDeadline: string | null;
  byCurrentUser: boolean;
  hasLocation: boolean;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  /** Reporter display name (only populated on staff/admin views). */
  reporterName: string | null;
  /** Incident cluster this report belongs to, if any. */
  incidentId: string | null;
}

export interface EvidenceQueueItem extends EvidenceItem {
  issueId: string;
  issuePublicId: string;
  issueTitle: string;
  issueStatus: string;
}

export type TimelineState = 'completed' | 'current' | 'pending';

export interface TimelineItem {
  date: string;
  label: string;
  state: TimelineState;
}

export interface EvidenceVerification {
  id: string;
  status: string;
  note: string | null;
  verifierName: string | null;
  createdAt: string;
}

export interface EvidenceItem {
  id: string;
  type: string;
  /**
   * Browser-accessible URL. External URL evidence is returned verbatim;
   * uploaded images/videos resolve to the authorized evidence-file route.
   */
  url: string;
  /** Stable storage key (object storage / local store). Internal use. */
  storageKey: string | null;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
  /** Latest recorded verification for this evidence item, if any. */
  verification: EvidenceVerification | null;
}

export type AiAnalysisItem = {
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  category: string | null;
  categoryLabel: string | null;
  severity: string | null;
  severityLabel: string | null;
  confidence: number | null;
  safetyRisk: string | null;
  safetyRiskLabel: string | null;
  infrastructureType: string | null;
  infrastructureTypeLabel: string | null;
  reasoningSummary: string | null;
  modelName: string | null;
  errorMessage: string | null;
  analyzedAt: string | null;
} | null;

export type IncidentSummary = {
  id: string;
  publicId: string;
  title: string;
  memberCount: number;
  memberPublicIds: string[];
} | null;

export type PriorityComponentItem = {
  key: string;
  label: string;
  weight: number;
  score: number;
  origin: 'computed' | 'unavailable';
};

export type PriorityBreakdown = {
  score: number;
  level: string;
  components: PriorityComponentItem[];
  unavailable: string[];
} | null;

/** A single factor row for the Civic Impact Score (see lib/impact). */
export type ImpactFactorItem = {
  key: string;
  label: string;
  max: number;
  earned: number;
  pct: number;
  origin: 'computed' | 'unavailable';
};

/** The Civic Impact Score breakdown surfaced on issue detail. */
export type CivicImpactItem = {
  score: number;
  verdict: string;
  verdictLabel: string;
  factors: ImpactFactorItem[];
  unavailable: string[];
  explanation: string;
} | null;

export type DuplicateSignalsItem = {
  geographic: number | null;
  text: number | null;
  image: number | null;
  time: number;
  category: number;
  contributors: string[];
};

export type DuplicateVerdictItem = {
  candidateIssueId: string;
  candidatePublicId: string;
  candidateIncidentId: string | null;
  distanceMeters: number | null;
  confidence: number;
  band: 'probably_new' | 'possible' | 'strong';
  signals: DuplicateSignalsItem;
} | null;

export type SlaSnapshotItem = {
  slaState: 'ON_TRACK' | 'AT_RISK' | 'BREACHED' | 'RESOLVED';
  slaPctElapsed: number;
  timeRemainingMs: number;
  deadline: string | null;
} | null;

/**
 * One row of the tamper-evident audit ledger for an issue (Phase 18). Each
 * audit event carries its SHA-256 hash and the previous row's hash, so the
 * history of a report cannot be rewritten undetected. No blockchain involved —
 * this is a simple, verifiable hash chain.
 */
export type AuditChainItem = {
  seq: number;
  action: string;
  label: string;
  createdAt: string;
  timeLabel: string;
  /** SHA-256 of this entry, chained onto prevHash. */
  hash: string;
  /** Hash of the previous ledger row; null for the chain head. */
  prevHash: string | null;
};

export interface IssueDetail extends IssueListItem {
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  contact: string | null;
  evidence: EvidenceItem[];
  timeline: TimelineItem[];
  /** Back-compat field; use aiAnalysis.confidence going forward. */
  aiConfidence: number | null;
  analysisStatus: string | null;
  aiAnalysis: AiAnalysisItem;
  incident: IncidentSummary;
  priorityBreakdown: PriorityBreakdown;
  /**
   * Civic Impact Score (Phase 25) — the transparency-led differentiator that
   * ranks complaints by predicted civic impact rather than submission order.
   */
  civicImpact: CivicImpactItem;
  /** Lifecycle statuses the current viewer is authorized to request next. */
  allowedTransitions: string[];
  /**
   * Real computed SLA standing (Phase 6). Separate from the persisted
   * `PromiseStatus` and Issue lifecycle. Null when no Promise (no authority yet).
   */
  sla: SlaSnapshotItem;
  /**
   * Tamper-evident audit chain for this report (Phase 18). Every action that
   * touched the issue is listed here with its SHA-256 hash, chained onto the
   * previous row. The client verifies continuity to detect any tampering.
   */
  auditChain: AuditChainItem[];
  /**
   * Phase 24 — the current viewer is the reporter AND the issue is RESOLVED,
   * so the client may show the Confirm-fixed / Dispute controls (POST /verify).
   */
  canVerify: boolean;
  /** Real per-type vote counts (Phase 24), rolled from the issue's votes. */
  voteSummary: VoteSummaryItem;
}

export interface ApiIssueResponse {
  issue: IssueDetail;
}

export interface ApiIssueListResponse {
  issues: IssueListItem[];
  total: number;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string | null;
  read: boolean;
  issueId: string | null;
  issuePublicId: string | null;
  /** Deep-link the notification resolves to, if any (Phase 13). */
  link: string | null;
  createdAt: string;
  timeLabel: string;
}

export interface EscalationItem {
  id: string;
  issueId: string;
  issuePublicId: string;
  issueTitle: string;
  issueStatus: string;
  level: number;
  status: string;
  reason: string | null;
  caller: string | null;
  createdAt: string;
  timeLabel: string;
}

export interface AuditEventItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actor: string | null;
  issueId: string | null;
  issuePublicId: string | null;
  metadata: unknown | null;
  createdAt: string;
  seq?: number;
  hash?: string | null;
  prevHash?: string | null;
}

// ---------------------------------------------------------------------------
// Phase 24 — Citizen surfaces (real DB-backed promise / verification /
// community / escalation feeds replacing the hardcoded dashboard pages).
// ---------------------------------------------------------------------------

export type SlaStateValue = 'ON_TRACK' | 'AT_RISK' | 'BREACHED' | 'RESOLVED';

/** A single commitment row for the citizen promise ledger (GET /api/my-promises). */
export interface PromiseItem {
  id: string;
  publicId: string;
  title: string;
  category: string;
  categoryLabel: string;
  status: string;
  statusLabel: string;
  authority: string | null;
  /** Real computed SLA standing (see src/lib/sla/state). */
  slaState: SlaStateValue;
  slaPctElapsed: number;
  timeRemainingMs: number;
  deadline: string;
  /** Persisted PromiseStatus (OPEN | IN_PROGRESS | COMPLETED | BROKEN). */
  promiseStatus: string;
  createdAt: string;
  timeLabel: string;
}

/** Reporter-facing resolution-confirmation row (GET /api/my-verifications). */
export interface MyVerificationItem {
  id: string;
  publicId: string;
  title: string;
  category: string;
  categoryLabel: string;
  status: string;
  statusLabel: string;
  authority: string | null;
  promiseLabel: string | null;
  /** VERIFIED when the reporter confirmed the fix; PENDING when unresolved. */
  verificationState: 'PENDING' | 'VERIFIED';
  /** When the issue last entered a resolved/verified lifecycle state. */
  resolvedAt: string;
}

/** Per-issue community-vote rollup (GET /api/community/feedback). */
export interface CommunityFeedbackItem {
  id: string;
  publicId: string;
  title: string;
  category: string;
  categoryLabel: string;
  totalVotes: number;
  confirmVotes: number;
  supportVotes: number;
  disputeVotes: number;
  /** Share of total votes on this issue, 0-100; null when no votes. */
  confirmPct: number | null;
  supportPct: number | null;
  disputePct: number | null;
}

/** Real per-type vote counts surfaced on the issue detail view. */
export interface VoteSummaryItem {
  confirm: number;
  dispute: number;
  support: number;
  duplicate: number;
  total: number;
}