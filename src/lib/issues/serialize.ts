import { formatDate, formatRelativeTime } from '@/lib/utils';
import {
  AI_CATEGORY_LABELS,
  CATEGORY_LABELS,
  INFRASTRUCTURE_TYPE_LABELS,
  PRIORITY_LEVEL_LABELS,
  SAFETY_RISK_LABELS,
  SEVERITY_LABELS,
  STATUS_LABELS,
  toDisplayStatus,
} from '@/lib/issues/mapping';
import {
  AuditAction,
  type AIAnalysis,
  type AuditLog,
  type Authority,
  type Evidence,
  type Incident,
  type Issue,
  type Promise as CivicPromise,
} from '../../../generated/prisma/client';
import type {
  AiAnalysisItem,
  EvidenceItem,
  EvidenceQueueItem,
  EvidenceVerification,
  IncidentSummary,
  IssueDetail,
  IssueListItem,
  PriorityBreakdown,
  TimelineItem,
} from './types';
import { computePriorityScore, evidenceConfidenceScore } from '@/lib/server/intelligence/priority/engine';

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

/** Issue as loaded by the report handlers with Phase 3/4 relations included. */
export type SerializerIssue = Issue & {
  aiAnalysis?: AIAnalysis | null;
  incident?: (Incident & {
    issues?: Array<{ id: string; publicId: string; status: string }>;
  }) | null;
};

interface IssueRowInput {
  issue: SerializerIssue;
  authority?: Authority | null;
  promise?: CivicPromise | null;
  evidence?: EvidenceWithVerifications[];
  auditLogs?: AuditLog[];
  viewerId?: string | null;
  reporter?: { name: string | null; email: string } | null;
  /**
   * Allow the viewer to see the reporter's identity. Defaults to only the
   * issue's owner (privacy: reporter name/email must not leak to the public
   * community feed). Staff surfaces (department/admin) set this explicitly.
   */
  revealReporter?: boolean;
  /**
   * Allow the viewer to see the reporter's confidential follow-up contact.
   * Defaults to only the issue's owner. Any community/transparency view keeps
   * this hidden.
   */
  revealContact?: boolean;
  /**
   * Lifecycle statuses the viewer is authorized to request next, derived from
   * the transition graph + RBAC (see allowedTransitionsFor). Empty = read-only.
   */
  allowedTransitions?: string[];
}

/** Whether a viewer may see an issue reporter's identity/contact. */
function canSeeReporterData(input: IssueRowInput, field: 'reporter' | 'contact'): boolean {
  if (input.revealContact === true || input.revealReporter === true) return true;
  if (!input.viewerId) return false;
  return input.issue.reporterId === input.viewerId;
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
    priorityLevel: issue.priorityLevel ?? null,
    location: issue.location,
    authority: authority?.name ?? authority?.department ?? null,
    promiseLabel: promise
      ? `Promise · ${formatDate(promise.deadline)}`
      : null,
    reportCount: 1,
    createdAt: issue.createdAt.toISOString(),
    updatedAt: issue.updatedAt.toISOString(),
    timeLabel: formatRelativeTime(issue.createdAt),
    promiseDeadline: promise?.deadline?.toISOString() ?? null,
    byCurrentUser: viewerId ? issue.reporterId === viewerId : false,
    hasLocation: issue.latitude !== null && issue.longitude !== null,
    latitude: issue.latitude,
    longitude: issue.longitude,
    accuracy: issue.accuracy,
    reporterName: canSeeReporterData(input, 'reporter')
      ? (reporter?.name ?? reporter?.email ?? null)
      : null,
    incidentId: issue.incidentId ?? null,
  };
}

function toAiAnalysisItem(
  analysis: NonNullable<AIAnalysis>,
): AiAnalysisItem {
  return {
    status: analysis.status,
    category: analysis.category ?? null,
    categoryLabel: analysis.category ? AI_CATEGORY_LABELS[analysis.category] ?? analysis.category : null,
    severity: analysis.severity ?? null,
    severityLabel: analysis.severity ? SEVERITY_LABELS[analysis.severity] ?? analysis.severity : null,
    confidence: analysis.confidence ?? null,
    safetyRisk: analysis.safetyRisk ?? null,
    safetyRiskLabel: analysis.safetyRisk ? SAFETY_RISK_LABELS[analysis.safetyRisk] ?? analysis.safetyRisk : null,
    infrastructureType: analysis.infrastructureType ?? null,
    infrastructureTypeLabel: analysis.infrastructureType
      ? INFRASTRUCTURE_TYPE_LABELS[analysis.infrastructureType] ?? analysis.infrastructureType
      : null,
    reasoningSummary: analysis.reasoningSummary ?? null,
    modelName: analysis.modelName ?? null,
    errorMessage: analysis.errorMessage ?? null,
    analyzedAt: analysis.completedAt?.toISOString() ?? null,
  };
}

type SerializerIncident = NonNullable<Incident> & {
  issues?: Array<{ id: string; publicId: string; status: string }>;
};

function toIncidentSummary(
  incident: SerializerIncident,
): IncidentSummary {
  const members = incident.issues ?? [];
  return {
    id: incident.id,
    publicId: incident.publicId,
    title: incident.title,
    memberCount: members.length,
    memberPublicIds: members.map((m) => m.publicId),
  };
}

function toPriorityBreakdown(
  issue: SerializerIssue,
  evidence: EvidenceWithVerifications[] | undefined,
): PriorityBreakdown {
  if (issue.priority == null) return null;
  if (issue.aiAnalysis && issue.aiAnalysis.status === 'PROCESSING') return null;
  const items = evidence ?? [];
  const evidenceConfidence = evidenceConfidenceScore({
    hasImage: items.some((e) => e.type === 'IMAGE'),
    hasCoordinates: issue.latitude != null && issue.longitude != null,
    accuracy: issue.accuracy,
    evidenceCount: items.length,
    descriptionLength: issue.description?.length ?? 0,
  });
  const result = computePriorityScore({
    severity: issue.severity,
    reports: Math.max(1, issue.incident?.issues?.length ?? 1),
    safetyRisk: issue.aiAnalysis?.safetyRisk ?? null,
    evidenceConfidence,
  });
  return {
    score: result.score,
    level: result.level,
    components: result.components,
    unavailable: result.unavailable,
  };
}

function priorityLevelLabel(issue: SerializerIssue): string | null {
  if (!issue.priorityLevel) return null;
  return PRIORITY_LEVEL_LABELS[issue.priorityLevel] ?? issue.priorityLevel;
}

export function serializeIssueDetail(input: IssueRowInput): IssueDetail {
  const row = serializeIssueListRow(input);
  const { issue, evidence } = input;
  const ai = issue.aiAnalysis ?? null;
  return {
    ...row,
    priorityLevel: priorityLevelLabel(issue),
    description: issue.description,
    latitude: issue.latitude,
    longitude: issue.longitude,
    contact: canSeeReporterData(input, 'contact') ? issue.contact : null,
    evidence: (evidence ?? []).map(toEvidenceItem),
    timeline: toTimeline(input.auditLogs),
    aiConfidence: ai?.confidence ?? null, // back-compat alias
    analysisStatus: ai?.status ?? null,
    aiAnalysis: ai ? toAiAnalysisItem(ai) : null,
    incident: issue.incident ? toIncidentSummary(issue.incident) : null,
    priorityBreakdown: toPriorityBreakdown(issue, evidence),
    allowedTransitions: input.allowedTransitions ?? [],
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

export function toEvidenceItem(ev: EvidenceWithVerifications): EvidenceItem {
  const isUploaded = ev.type !== 'URL';  return {
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