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
  /** Lifecycle statuses the current viewer is authorized to request next. */
  allowedTransitions: string[];
  /**
   * Real, computed Promise/SLA standing (Phase 6). Separate from the persisted
   * PromiseStatus and Issue lifecycle. Null when no Promise (no authority yet).
   */
  sla: SlaSnapshotItem;
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

export interface AuditLogItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actor: string | null;
  issueId: string | null;
  issuePublicId: string | null;
  metadata: unknown | null;
  createdAt: string;
}