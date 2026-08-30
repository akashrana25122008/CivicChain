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
  IssueDetail,
  IssueListItem,
  TimelineItem,
} from './types';

interface IssueRowInput {
  issue: Issue;
  authority?: Authority | null;
  promise?: CivicPromise | null;
  evidence?: Evidence[];
  auditLogs?: AuditLog[];
  viewerId?: string | null;
}

export function serializeIssueListRow(input: IssueRowInput): IssueListItem {
  const { issue, authority, promise, viewerId } = input;
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

export function serializeIssueDetail(input: IssueRowInput): IssueDetail {
  const row = serializeIssueListRow(input);
  const { issue, evidence } = input;
  const evidenceItems: EvidenceItem[] = (evidence ?? []).map((ev) => ({
    id: ev.id,
    type: ev.type,
    url: ev.url,
    fileName: ev.fileName,
    mimeType: ev.mimeType,
    sizeBytes: ev.sizeBytes,
    createdAt: ev.createdAt.toISOString(),
  }));
  return {
    ...row,
    description: issue.description,
    latitude: issue.latitude,
    longitude: issue.longitude,
    contact: issue.contact,
    evidence: evidenceItems,
    timeline: toTimeline(input.auditLogs),
    aiConfidence: null, // real AI analysis arrives in Phase 2 — never fabricated
  };
}