import { formatDate, formatRelativeTime } from '@/lib/utils';
import {
  CATEGORY_LABELS,
  SEVERITY_LABELS,
  STATUS_LABELS,
  toDisplayStatus,
} from '@/lib/issues/mapping';
import {
  AuditAction,
  type AuditLog,
  type Authority,
  type Evidence,
  type Issue,
  type Promise as CivicPromise,
} from '../../../generated/prisma/client';
import type {
  EvidenceItem,
  EvidenceQueueItem,
  EvidenceVerification,
  IssueDetail,
  IssueListItem,
  TimelineItem,
} from './types';

/** Evidence row optionally loaded with its full verification history. */
type EvidenceWithVerifications = Evidence & {
  verifications?: Array<{
    id: string;
    status: string;
    note: string | null;
    createdAt: Date;
    verifier?: { name: string | null; email: string } | null;
  }>;
};

interface IssueRowInput {
  issue: Issue;
  authority?: Authority | null;
  promise?: CivicPromise | null;
  evidence?: EvidenceWithVerifications[];
  auditLogs?: AuditLog[];
  viewerId?: string | null;
  reporter?: { name: string | null; email: string } | null;
}

export function serializeIssueListRow(input: IssueRowInput): IssueListItem {
  const { issue, authority, promise, viewerId, reporter } = input;
  const severity = issue.severity;
  return {
    id: issue.id,
    publicId: issue.publicId,
    title: issue.title,
    category: issue.category,
    categoryLabel: CATEGORY_LABELS[issue.category] ?? issue.category,
    status: issue.status,
    statusLabel: STATUS_LABELS[issue.status] ?? issue.status,
    displayStatus: toDisplayStatus(issue.status, promise),
    severity: severity ?? null,
    severityLabel: severity ? SEVERITY_LABELS[severity] : null,
    priority: issue.priority,
    location: issue.location,
    authority: authority?.name ?? authority?.department ?? null,
    promiseLabel: promise
      ? `Promise · ${formatDate(promise.deadline)}`
      : null,
    reportCount: 1,
    createdAt: issue.createdAt.toISOString(),
    timeLabel: formatRelativeTime(issue.createdAt),
    byCurrentUser: viewerId ? issue.reporterId === viewerId : false,
    hasLocation: issue.latitude !== null && issue.longitude !== null,
    latitude: issue.latitude,
    longitude: issue.longitude,
    accuracy: issue.accuracy,
    reporterName: reporter?.name ?? reporter?.email ?? null,
  };
}

const TIMELINE_LABELS: Partial<Record<AuditAction, string>> = {
  [AuditAction.REPORT_CREATED]: 'Issue reported',
  [AuditAction.REPORT_UPDATED]: 'Issue details updated',
  [AuditAction.STATUS_CHANGED]: 'Status updated',
  [AuditAction.EVIDENCE_ADDED]: 'Evidence added',
  [AuditAction.VERIFICATION_CREATED]: 'Verification created',
  [AuditAction.ESCALATION_CREATED]: 'Escalated',
  [AuditAction.AUTHORITY_ASSIGNED]: 'Authority assigned',
};

function toTimeline(auditLogs: AuditLog[] | undefined): TimelineItem[] {
  if (!auditLogs || auditLogs.length === 0) return [];
  return auditLogs
    .slice()
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((log, index, arr) => ({
      date: formatDate(log.createdAt),
      label: TIMELINE_LABELS[log.action] ?? log.action,
      state: index === arr.length - 1 ? 'current' : 'completed',
    }));
}

/** Latest recorded verification for an evidence item (most recent first). */
function latestVerification(ev: EvidenceWithVerifications): EvidenceVerification | null {
  const list = ev.verifications ?? [];
  if (list.length === 0) return null;
  const latest = list.reduce((a, b) =>
    b.createdAt.getTime() > a.createdAt.getTime() ? b : a,
  );
  return {
    id: latest.id,
    status: latest.status,
    note: latest.note ?? null,
    verifierName: latest.verifier?.name ?? latest.verifier?.email ?? null,
    createdAt: latest.createdAt.toISOString(),
  };
}

function toEvidenceItem(ev: EvidenceWithVerifications): EvidenceItem {
  const isUploaded = ev.type !== 'URL';
  return {
    id: ev.id,
    type: ev.type,
    // Uploaded files are private; the accessing route re-checks authorization.
    url: isUploaded ? `/api/evidence/${ev.id}/file` : ev.url,
    storageKey: isUploaded ? ev.url : null,
    fileName: ev.fileName,
    mimeType: ev.mimeType,
    sizeBytes: ev.sizeBytes,
    createdAt: ev.createdAt.toISOString(),
    verification: latestVerification(ev),
  };
}

/** Evidence row flattened with its owning issue for staff verification queues. */
export function serializeEvidenceQueueItem(
  ev: EvidenceWithVerifications,
  issue: Pick<Issue, 'id' | 'publicId' | 'title' | 'status'>,
): EvidenceQueueItem {
  return {
    ...toEvidenceItem(ev),
    issueId: issue.id,
    issuePublicId: issue.publicId,
    issueTitle: issue.title,
    issueStatus: issue.status,
  };
}

export function serializeIssueDetail(input: IssueRowInput): IssueDetail {
  const row = serializeIssueListRow(input);
  const { issue, evidence } = input;
  return {
    ...row,
    description: issue.description,
    latitude: issue.latitude,
    longitude: issue.longitude,
    contact: issue.contact,
    evidence: (evidence ?? []).map(toEvidenceItem),
    timeline: toTimeline(input.auditLogs),
    aiConfidence: null, // real AI analysis arrives in Phase 2 — never fabricated
  };
}