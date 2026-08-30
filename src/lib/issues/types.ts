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
  location: string | null;
  authority: string | null;
  promiseLabel: string | null;
  /** Number of merged citizen reports. Always 1 until duplicate merging exists. */
  reportCount: number;
  createdAt: string;
  timeLabel: string;
  byCurrentUser: boolean;
  hasLocation: boolean;
  latitude: number | null;
  longitude: number | null;
  /** Reporter display name (only populated on staff/admin views). */
  reporterName: string | null;
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
  url: string;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
  /** Latest recorded verification for this evidence item, if any. */
  verification: EvidenceVerification | null;
}

export interface IssueDetail extends IssueListItem {
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  contact: string | null;
  evidence: EvidenceItem[];
  timeline: TimelineItem[];
  aiConfidence: number | null;
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