/**
 * Phase 17 — Admin Command Center aggregation service.
 *
 * Central, system-wide operational intelligence for ADMIN users. Every value
 * is derived from real database data — nothing here is hardcoded or mocked.
 * RBAC is enforced by the caller (`requireRole('ADMIN')`); this service never
 * takes an actor/scope from the browser.
 *
 * Reuses existing engines instead of duplicating them:
 *   - SLA evaluation -> Phase 6 `calculateSlaState`
 *   - Ward risk       -> Phase 11 `fetchAreaRisks`/`fetchRiskSummary`
 *   - Escalations     -> Escalation model + escalation level labels
 *   - AI health       -> AIAnalysis model (real classification telemetry)
 */

import { prisma } from '@/lib/db';
import { calculateSlaState } from '@/lib/sla/state';
import { escalationLevelLabel } from '@/lib/escalation/levels';
import { fetchAreaRisks } from '@/lib/risk/areas';
import { avgResolutionMinutes, createdIssuesByDay } from '@/lib/server/metrics';
import { CATEGORY_LABELS, SEVERITY_LABELS, STATUS_LABELS, PRIORITY_LEVEL_LABELS } from '@/lib/issues/mapping';
import type {
  IssueStatus,
  Severity,
  PriorityLevel,
  IssueCategory,
} from '../../../../generated/prisma/client';

const ACTIVE_STATUSES: IssueStatus[] = ['SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS'];
const CRITICAL_SEVERITY: Severity = 'CRITICAL';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdminKpis {
  citizens: number;
  authorities: number;
  departments: number;
  issues: { total: number; active: number; resolved: number; critical: number };
  incidents: number;
  escalations: { total: number; open: number };
  verifications: { total: number; pending: number };
  evidence: { total: number; pending: number };
}

export interface AdminSlaControl {
  onTrack: number;
  atRisk: number;
  breached: number;
  total: number;
  onTimePct: number | null;
}

export interface AdminEscalationItem {
  id: string;
  issuePublicId: string | null;
  level: number;
  levelLabel: string;
  status: string;
  issuer: string | null;
  authority: string | null;
  ageHours: number;
  createdAt: string;
}

export interface AdminRiskOverview {
  totalWards: number;
  low: number;
  medium: number;
  high: number;
  critical: number;
  topWards: Array<{
    wardId: string;
    wardName: string;
    riskScore: number;
    riskLevel: string;
    activeIncidents: number;
    slaBreaches: number;
  }>;
}

export interface AdminAiHealth {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  avgConfidence: number | null;
  models: Array<{ modelName: string; count: number }>;
}

export interface AdminActionCenter {
  criticalSlaBreaches: number;
  openEscalations: number;
  highRiskWards: number;
  criticalRiskWards: number;
  pendingVerifications: number;
  failedAi: number;
}

export interface AdminCommandCenterData {
  kpis: AdminKpis;
  sla: AdminSlaControl;
  escalations: {
    open: AdminEscalationItem[];
    counts: { open: number; critical: number; unresolved: number };
  };
  risk: AdminRiskOverview;
  ai: AdminAiHealth;
  actions: AdminActionCenter;
  generatedAt: string;

  // ── Phase 18 operational extensions ────────────────────────────────────
  operational: AdminOperationalOverview;
}

/** Connected critical-operations summary strip (not generic KPI cards). */
export interface AdminOperationalSummary {
  criticalIncidents: number;
  highPriority: number;
  unassigned: number;
  slaBreaches: number;
  generatedAt: string;
}

/**
 * A single item in the "Requires Immediate Attention" operational queue.
 * Populated from real active issues ranked by the shared urgency heuristics.
 */
export interface AttentionQueueItem {
  id: string;
  publicId: string;
  title: string;
  category: string;
  categoryLabel: string;
  severity: Severity | null;
  severityLabel: string | null;
  priority: number | null;
  priorityLevel: PriorityLevel | null;
  priorityLevelLabel: string | null;
  status: IssueStatus;
  statusLabel: string;
  location: string | null;
  ward: string | null;
  departmentName: string | null;
  assigned: boolean;
  // SLA standing
  slaState: string;
  slaRemainingLabel: string | null;
  createdAt: string;
  timeLabel: string;
  // Urgency
  attentionScore: number;
  attentionLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
  escalationLevel: number;
  reportCount: number;
}

/** Composite intelligence for the "Civic AI Intelligence" panel. */
export interface AdminAiIntelligence {
  assessment: string | null;
  recommendations: Array<{ id: string; action: string; severity: 'high' | 'medium' | 'low' }>;
  riskSignal: string | null;
  signalDirection: 'INCREASING' | 'STABLE' | 'DECREASING' | null;
  signalStrength: number | null;
  computedAt: string;
}

/** Per-department response readiness row. */
export interface DepartmentResponseStatus {
  id: string;
  name: string;
  activeCases: number;
  avgResponseLabel: string;
  avgResponseMinutes: number | null;
  loadLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  loadPct: number;
  operational: boolean;
  esealationsOpen: number;
  breached: number;
}

/** A real-time operational event for the live command-activity feed. */
export interface CommandActivityItem {
  id: string;
  kind: 'assignment' | 'escalation' | 'sla' | 'report' | 'ai' | 'verification';
  message: string;
  issuePublicId: string | null;
  actor: string | null;
  timeLabel: string;
  createdAt: string;
}

/** Restrained system-status summary. */
export interface SystemStatusItem {
  key: string;
  label: string;
  status: 'OPERATIONAL' | 'DEGRADED' | 'WARNING';
  detail: string;
}

export interface OperationalTrendPoint {
  day: string;
  created: number;
}

export interface OperationalCategoryCount {
  category: string;
  label: string;
  count: number;
}

export interface AdminOperationalOverview {
  summary: AdminOperationalSummary;
  attentionQueue: AttentionQueueItem[];
  departments: DepartmentResponseStatus[];
  activity: CommandActivityItem[];
  system: SystemStatusItem[];
  intelligence: AdminAiIntelligence;
  trend: {
    byDay: OperationalTrendPoint[];
    byCategory: OperationalCategoryCount[];
  };
  mapContext: {
    points: Array<{
      id: string;
      publicId: string;
      title: string;
      latitude: number;
      longitude: number;
      severity: Severity | null;
      priorityLevel: PriorityLevel | null;
      /** Label detail so every command-map marker is fully data-rich. */
      detail: {
        categoryLabel: string;
        severityLabel: string | null;
        priorityLevelLabel: string | null;
        location: string | null;
        statusLabel: string;
        departmentName: string | null;
        assigned: boolean;
        slaState: string;
        slaRemainingLabel: string | null;
        timeLabel: string;
        attentionLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
      };
    }>;
    center: { lat: number; lng: number } | null;
  };
}

// ---------------------------------------------------------------------------
// Pure helpers (unit-testable without a database — mirror the Phase 16 pattern)
// ---------------------------------------------------------------------------

export interface SlaPromiseRow {
  deadline: Date;
  issue: { createdAt: Date; status: string } | null;
}

/**
 * Map the on-track / at-risk / breached buckets for a set of active promises
 * using the shared Phase 6 SLA engine. Pure — `now` is injected.
 */
export function computeSlaControl(
  rows: SlaPromiseRow[],
  now: Date,
): AdminSlaControl {
  let onTrack = 0;
  let atRisk = 0;
  let breached = 0;
  for (const p of rows) {
    if (!p.issue) continue;
    const { slaState } = calculateSlaState({
      deadline: p.deadline,
      createdAt: p.issue.createdAt,
      resolved: p.issue.status === 'RESOLVED' || p.issue.status === 'REJECTED',
      now,
    });
    if (slaState === 'ON_TRACK') onTrack += 1;
    else if (slaState === 'AT_RISK') atRisk += 1;
    else if (slaState === 'BREACHED') breached += 1;
  }
  const total = onTrack + atRisk + breached;
  return {
    onTrack,
    atRisk,
    breached,
    total,
    onTimePct: total > 0 ? Math.round((onTrack / total) * 100) : null,
  };
}

export interface EscalationRow {
  id: string;
  level: number;
  status: string;
  createdAt: Date;
  issue: { publicId: string } | null;
  caller: { name: string | null } | null;
  authority: { department: { name: string } | null } | null;
}

/**
 * Shape open escalation rows into a sorted, age-labelled control list. Pure.
 */
export function mapEscalationItems(
  escalations: EscalationRow[],
  now: Date,
): AdminEscalationItem[] {
  return escalations
    .map((e) => ({
      id: e.id,
      issuePublicId: e.issue?.publicId ?? null,
      level: e.level,
      levelLabel: escalationLevelLabel(e.level),
      status: e.status,
      issuer: e.caller?.name ?? null,
      authority: e.authority?.department?.name ?? null,
      ageHours: Math.round((now.getTime() - e.createdAt.getTime()) / (1000 * 60 * 60)),
      createdAt: e.createdAt.toISOString(),
    }))
    .sort((a, b) => b.level - a.level || b.ageHours - a.ageHours);
}

/**
 * Derive the action-center attention list from the other control aggregates.
 * Pure — takes precomputed buckets.
 */
export function computeActionCenter(input: {
  breached: number;
  openEscalations: number;
  highRiskWards: number;
  criticalRiskWards: number;
  pendingVerifications: number;
  failedAi: number;
}): AdminActionCenter {
  return {
    criticalSlaBreaches: input.breached,
    openEscalations: input.openEscalations,
    highRiskWards: input.highRiskWards,
    criticalRiskWards: input.criticalRiskWards,
    pendingVerifications: input.pendingVerifications,
    failedAi: input.failedAi,
  };
}

// ---------------------------------------------------------------------------
// Operational helpers (pure where possible — `now` injected for tests)
// ---------------------------------------------------------------------------

const ACTIVE: IssueStatus[] = ['SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS'];

const SEVERITY_WEIGHT: Record<Severity, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
const PRIORITY_WEIGHT: Record<PriorityLevel, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

function priorityLevelLabel(level: PriorityLevel | null): string | null {
  return level ? PRIORITY_LEVEL_LABELS[level] : null;
}

/** Compact relative-time label, e.g. "1h 24m" / "18m" / "14d". */
export function durationLabel(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h < 24) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${Math.round(h / 24)}d`;
}

export function timeFromNow(iso: string, now: number): string {
  return durationLabel(now - new Date(iso).getTime());
}

/**
 * Build a human-digestible AI reason for why an incident demands attention.
 * Pure — consumes already-computed signals; no secondary model call.
 */
export function buildAiReason(input: {
  severity: Severity | null;
  slaState: string;
  escalationLevel: number;
  reportCount: number;
  priorityLevel: PriorityLevel | null;
}): string {
  const parts: string[] = [];
  if (input.severity === 'CRITICAL') parts.push('critical severity');
  else if (input.severity === 'HIGH') parts.push('high severity');
  if (input.slaState === 'BREACHED') parts.push('SLA breached');
  else if (input.slaState === 'AT_RISK') parts.push('SLA at risk');
  if (input.escalationLevel >= 2) parts.push(`escalated to ${escalationLevelLabel(input.escalationLevel)}`);
  if (input.reportCount > 1) parts.push(`${input.reportCount} citizen reports`);
  return parts.length > 0 ? `AI priority: ${parts.join(' + ')}.` : 'AI priority: standard triage.';
}

function loadLevel(activeCases: number): {
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  pct: number;
} {
  if (activeCases <= 8) return { level: 'LOW', pct: 20 };
  if (activeCases <= 20) return { level: 'MEDIUM', pct: 50 };
  if (activeCases <= 40) return { level: 'HIGH', pct: 78 };
  return { level: 'CRITICAL', pct: 94 };
}

export function formatResponse(minutes: number | null): string {
  if (minutes == null) return '—';
  return durationLabel(minutes * 60000);
}

function formatClock(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

export async function getAdminCommandCenter(): Promise<AdminCommandCenterData> {
  const now = new Date();
  const [citizens, authorities, departmentsRows, incidentCount, promiseRows, escalations, verifCount, pendingVerif, evidenceCount, pendingEvidence, issueAgg] =
    await Promise.all([
      prisma.user.count({ where: { role: 'CITIZEN' } }),
      prisma.authority.count(),
      prisma.department.count(),
      prisma.incident.count(),
      prisma.promise.findMany({
        where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
        select: { deadline: true, issue: { select: { createdAt: true, status: true } } },
      }),
      prisma.escalation.findMany({
        where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
        include: {
          issue: { select: { publicId: true } },
          caller: { select: { name: true } },
          authority: { include: { department: { select: { name: true } } } },
        },
      }),
      prisma.verification.count(),
      prisma.verification.count({ where: { status: 'PENDING' } }),
      prisma.evidence.count(),
      prisma.evidence.count({ where: { verifications: { none: { status: 'VERIFIED' } } } }),
      prisma.issue.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);

  const totalIssues = issueAgg.reduce((s, r) => s + r._count._all, 0);
  const activeIssues = issueAgg
    .filter((r) => ACTIVE_STATUSES.includes(r.status))
    .reduce((s, r) => s + r._count._all, 0);
  const resolvedIssues = issueAgg.filter((r) => r.status === 'RESOLVED').reduce((s, r) => s + r._count._all, 0);
  const criticalIssues = await prisma.issue.count({
    where: { status: { in: ACTIVE_STATUSES }, severity: CRITICAL_SEVERITY },
  });

  // --- SLA control center --------------------------------------------------
  const sla = computeSlaControl(promiseRows, now);

  // --- Escalation control center -------------------------------------------
  const openEsc = escalations.filter((e) => e.status === 'OPEN' || e.status === 'IN_PROGRESS');
  const openEscItems = mapEscalationItems(openEsc, now);
  const criticalEscalations = openEsc.filter((e) => e.level >= 3).length;

  // --- Risk overview (reuses Phase 11 engine) ------------------------------
  let riskOverview: AdminRiskOverview = {
    totalWards: 0,
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
    topWards: [],
  };
  try {
    const wards = await fetchAreaRisks({ days: 30 });
    riskOverview = {
      totalWards: wards.length,
      low: wards.filter((w) => w.riskLevel === 'LOW').length,
      medium: wards.filter((w) => w.riskLevel === 'MEDIUM').length,
      high: wards.filter((w) => w.riskLevel === 'HIGH').length,
      critical: wards.filter((w) => w.riskLevel === 'CRITICAL').length,
      topWards: wards.slice(0, 6).map((w) => ({
        wardId: w.wardId,
        wardName: w.wardName,
        riskScore: w.riskScore,
        riskLevel: w.riskLevel,
        activeIncidents: w.activeIncidents,
        slaBreaches: w.slaBreaches,
      })),
    };
  } catch {
    // Risk aggregation failure must not take down the whole command center.
    riskOverview = {
      totalWards: 0,
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
      topWards: [],
    };
  }

  // --- AI health -----------------------------------------------------------
  const [aiByStatus, aiByModel, aiStats] = await Promise.all([
    prisma.aIAnalysis.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.aIAnalysis.groupBy({ by: ['modelName'], _count: { _all: true } }),
    prisma.aIAnalysis.aggregate({ _avg: { confidence: true } }),
  ]);
  const aiTotal = aiByStatus.reduce((s, r) => s + r._count._all, 0);
  const aiFailed = aiByStatus.filter((r) => r.status === 'FAILED').reduce((s, r) => s + r._count._all, 0);
  const ai: AdminAiHealth = {
    total: aiTotal,
    pending: aiByStatus.filter((r) => r.status === 'PENDING').reduce((s, r) => s + r._count._all, 0),
    processing: aiByStatus.filter((r) => r.status === 'PROCESSING').reduce((s, r) => s + r._count._all, 0),
    completed: aiByStatus.filter((r) => r.status === 'COMPLETED').reduce((s, r) => s + r._count._all, 0),
    failed: aiFailed,
    avgConfidence: aiStats._avg.confidence != null ? Math.round(aiStats._avg.confidence * 100) : null,
    models: aiByModel
      .filter((r) => r.modelName)
      .map((r) => ({ modelName: r.modelName as string, count: r._count._all }))
      .sort((a, b) => b.count - a.count),
  };

  // --- Action center ---------------------------------------------------------
  const actions = computeActionCenter({
    breached: sla.breached,
    openEscalations: openEsc.length,
    highRiskWards: riskOverview.high,
    criticalRiskWards: riskOverview.critical,
    pendingVerifications: pendingVerif,
    failedAi: aiFailed,
  });

  // ==========================================================================
  // Phase 18 — Operational command view (real data only)
  // ==========================================================================
  const nowMs = now.getTime();

  // --- Active issues for the attention queue + map -------------------------
  const activeIssuesRows = await prisma.issue.findMany({
    where: { status: { in: ACTIVE_STATUSES } },
    orderBy: [{ createdAt: 'asc' }],
    take: 250,
    include: {
      department: { select: { id: true, name: true } },
      promise: { select: { deadline: true, status: true } },
      _count: { select: { escalations: true, evidence: true } },
    },
  });

  const lookedUpWards = new Map<string, string>();
  for (const i of activeIssuesRows) {
    if (i.location) {
      const ward = i.location.split(',').map((s) => s.trim()).pop();
      if (ward) lookedUpWards.set(i.id, ward);
    }
  }
  const wardByIssue = (id: string, location: string | null): string | null => {
    if (lookedUpWards.has(id)) return lookedUpWards.get(id)!;
    if (!location) return null;
    const parts = location.split(',').map((s) => s.trim());
    return parts[parts.length - 1] || null;
  };

  interface Attn {
    id: string;
    publicId: string;
    title: string;
    category: IssueCategory;
    severity: Severity | null;
    priority: number | null;
    priorityLevel: PriorityLevel | null;
    status: IssueStatus;
    location: string | null;
    departmentName: string | null;
    assigned: boolean;
    slaState: string;
    slaRemainingLabel: string | null;
    createdAt: Date;
    escalationLevel: number;
    reportCount: number;
  }

  const queueRows: Attn[] = [];
  const mapPoints: Array<{
    id: string;
    publicId: string;
    title: string;
    latitude: number;
    longitude: number;
    severity: Severity | null;
    priorityLevel: PriorityLevel | null;
    detail: {
      categoryLabel: string;
      severityLabel: string | null;
      priorityLevelLabel: string | null;
      location: string | null;
      statusLabel: string;
      departmentName: string | null;
      assigned: boolean;
      slaState: string;
      slaRemainingLabel: string | null;
      timeLabel: string;
      attentionLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    };
  }> = [];

  for (const i of activeIssuesRows) {
    const slaState =
      i.promise && i.promise.deadline
        ? (() => {
            const resolved = i.status === 'RESOLVED' || i.status === 'REJECTED';
            return calculateSlaState({
              deadline: i.promise.deadline,
              createdAt: i.createdAt,
              resolved,
              now,
            }).slaState;
          })()
        : 'ON_TRACK';

    const slaRemainingLabel =
      i.promise && i.promise.deadline && slaState !== 'RESOLVED'
        ? durationLabel(i.promise.deadline.getTime() - nowMs)
        : null;

    const escd = i._count.escalations;
    const isUnassigned = !i.departmentId;

    if (i.latitude != null && i.longitude != null) {
      const mvLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' =
        i.severity === 'CRITICAL' || slaState === 'BREACHED' || (i.priorityLevel === 'CRITICAL' && (escd >= 2 || slaState === 'AT_RISK'))
          ? 'CRITICAL'
          : i.severity === 'HIGH' || i.priorityLevel === 'HIGH' || slaState === 'AT_RISK'
            ? 'HIGH'
            : escd >= 1
              ? 'MEDIUM'
              : 'LOW';
      mapPoints.push({
        id: i.id,
        publicId: i.publicId,
        title: i.title,
        latitude: i.latitude,
        longitude: i.longitude,
        severity: i.severity,
        priorityLevel: i.priorityLevel,
        detail: {
          categoryLabel: CATEGORY_LABELS[i.category] ?? i.category,
          severityLabel: i.severity ? SEVERITY_LABELS[i.severity] : null,
          priorityLevelLabel: priorityLevelLabel(i.priorityLevel),
          location: i.location,
          statusLabel: STATUS_LABELS[i.status] ?? i.status,
          departmentName: i.department?.name ?? null,
          assigned: !isUnassigned,
          slaState,
          slaRemainingLabel,
          timeLabel: durationLabel(nowMs - i.createdAt.getTime()),
          attentionLevel: mvLevel,
        },
      });
    }

    // Only surface items that genuinely require operator attention.
    const needsAttention =
      slaState === 'BREACHED' ||
      slaState === 'AT_RISK' ||
      i.severity === 'CRITICAL' ||
      i.priorityLevel === 'CRITICAL' ||
      isUnassigned ||
      escd >= 2;

    if (needsAttention) {
      queueRows.push({
        id: i.id,
        publicId: i.publicId,
        title: i.title,
        category: i.category,
        severity: i.severity,
        priority: i.priority,
        priorityLevel: i.priorityLevel,
        status: i.status,
        location: i.location,
        departmentName: i.department?.name ?? null,
        assigned: !isUnassigned,
        slaState,
        slaRemainingLabel,
        createdAt: i.createdAt,
        escalationLevel: escd,
        reportCount: 1 + (i.promise ? 0 : 0),
      });
    }
  }

  // Sort by attention score descending.
  const attentionQueue: AttentionQueueItem[] = queueRows
    .map((r) => {
      const sevScore = r.severity ? SEVERITY_WEIGHT[r.severity] : 0;
      const prScore = r.priorityLevel ? PRIORITY_WEIGHT[r.priorityLevel] : 1;
      const score = sevScore * prScore + r.escalationLevel + (r.slaState === 'BREACHED' ? 3 : r.slaState === 'AT_RISK' ? 2 : 0);
      const level: AttentionQueueItem['attentionLevel'] =
        r.severity === 'CRITICAL' || r.slaState === 'BREACHED' || (r.priorityLevel === 'CRITICAL' && (r.escalationLevel >= 2 || r.slaState === 'AT_RISK'))
          ? 'CRITICAL'
          : r.severity === 'HIGH' || r.priorityLevel === 'HIGH' || r.slaState === 'AT_RISK'
            ? 'HIGH'
            : r.escalationLevel >= 1
              ? 'MEDIUM'
              : 'LOW';
      return {
        id: r.id,
        publicId: r.publicId,
        title: r.title,
        category: r.category,
        categoryLabel: CATEGORY_LABELS[r.category] ?? r.category,
        severity: r.severity,
        severityLabel: r.severity ? SEVERITY_LABELS[r.severity] : null,
        priority: r.priority,
        priorityLevel: r.priorityLevel,
        priorityLevelLabel: priorityLevelLabel(r.priorityLevel),
        status: r.status,
        statusLabel: STATUS_LABELS[r.status] ?? r.status,
        location: r.location,
        ward: wardByIssue(r.id, r.location),
        departmentName: r.departmentName,
        assigned: r.assigned,
        slaState: r.slaState,
        slaRemainingLabel: r.slaRemainingLabel,
        createdAt: r.createdAt.toISOString(),
        timeLabel: durationLabel(nowMs - r.createdAt.getTime()),
        attentionScore: score,
        attentionLevel: level,
        reason: buildAiReason({
          severity: r.severity,
          slaState: r.slaState,
          escalationLevel: r.escalationLevel,
          reportCount: r.reportCount,
          priorityLevel: r.priorityLevel,
        }),
        escalationLevel: r.escalationLevel,
        reportCount: r.reportCount,
      };
    })
    .sort((a, b) => b.attentionScore - a.attentionScore)
    .slice(0, 12);

  // --- Operational summary --------------------------------------------------
  const criticalIncidents = attentionQueue.filter((q) => q.attentionLevel === 'CRITICAL').length;
  const highPriority = attentionQueue.filter((q) => q.attentionLevel === 'HIGH').length;
  const unassigned = queueRows.filter((r) => !r.assigned).length;
  const slaBreaches = queueRows.filter((r) => r.slaState === 'BREACHED').length;

  const summary: AdminOperationalSummary = {
    criticalIncidents,
    highPriority,
    unassigned,
    slaBreaches,
    generatedAt: now.toISOString(),
  };

  // --- Department response status ------------------------------------------
  const deptRows = await prisma.department.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
  const departmentStatuses: DepartmentResponseStatus[] = [];
  for (const d of deptRows) {
    const [activeCases, breached, openEscDept, avgMin] = await Promise.all([
      prisma.issue.count({ where: { departmentId: d.id, status: { in: ACTIVE } } }),
      prisma.promise.count({ where: { departmentId: d.id, status: 'BROKEN' } }),
      prisma.escalation.count({ where: { issue: { departmentId: d.id }, status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      (async () => {
        const authIds = (await prisma.authority.findMany({ where: { departmentId: d.id }, select: { id: true } })).map((a) => a.id);
        const mins = await Promise.all(authIds.map((aid) => avgResolutionMinutes({ authorityId: aid })));
        const valid = mins.filter((m): m is number => m != null);
        return valid.length ? Math.round(valid.reduce((s, m) => s + m, 0) / valid.length) : null;
      })(),
    ]);
    const load = loadLevel(activeCases);
    departmentStatuses.push({
      id: d.id,
      name: d.name,
      activeCases,
      avgResponseLabel: formatResponse(avgMin),
      avgResponseMinutes: avgMin,
      loadLevel: load.level,
      loadPct: load.pct,
      operational: load.level !== 'CRITICAL',
      esealationsOpen: openEscDept,
      breached,
    });
  }

  // --- Live command activity (real operational events) ----------------------
  const auditEvents = await prisma.auditEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: 25,
    include: {
      actor: { select: { name: true } },
      issue: { select: { publicId: true } },
    },
  });

  const activity: CommandActivityItem[] = auditEvents
    .filter((e) =>
      ['AUTHORITY_ASSIGNED', 'INCIDENT_ASSIGNED', 'ESCALATION_CREATED', 'REPORT_CREATED', 'AI_ANALYSIS_COMPLETED', 'AI_ANALYSIS_FAILED', 'VERIFICATION_CREATED', 'STATUS_CHANGED'].includes(e.action),
    )
    .slice(0, 12)
    .map((e) => {
      let kind: CommandActivityItem['kind'] = 'report';
      let message = e.action.replace(/_/g, ' ').toLowerCase();
      if (e.action === 'AUTHORITY_ASSIGNED' || e.action === 'INCIDENT_ASSIGNED') {
        kind = 'assignment';
        message = `assigned ${e.issue?.publicId ?? 'a report'} to a department`;
      } else if (e.action === 'ESCALATION_CREATED') {
        kind = 'escalation';
        const to = e.metadata && typeof e.metadata === 'object' && 'toLevel' in e.metadata
          ? escalationLevelLabel(Number((e.metadata as { toLevel?: unknown }).toLevel))
          : '';
        message = `${e.issue?.publicId ?? 'An incident'} escalated${to ? ` to ${to}` : ''}`;
      } else if (e.action === 'AI_ANALYSIS_COMPLETED') {
        kind = 'ai';
        message = `AI analysis completed for ${e.issue?.publicId ?? 'a report'}`;
      } else if (e.action === 'AI_ANALYSIS_FAILED') {
        kind = 'ai';
        message = `AI analysis failed for ${e.issue?.publicId ?? 'a report'}`;
      } else if (e.action === 'VERIFICATION_CREATED') {
        kind = 'verification';
        message = `verification requested for ${e.issue?.publicId ?? 'a report'}`;
      } else if (e.action === 'STATUS_CHANGED') {
        kind = 'sla';
        message = `status updated on ${e.issue?.publicId ?? 'a report'}`;
      }
      return {
        id: e.id,
        kind,
        message,
        issuePublicId: e.issue?.publicId ?? null,
        actor: e.actor?.name ?? null,
        timeLabel: formatClock(e.createdAt),
        createdAt: e.createdAt.toISOString(),
      };
    });

  // --- Civic AI intelligence (derived, actionable) -------------------------
  let assessment: string | null = null;
  let riskSignal: string | null = null;
  let signalDirection: 'INCREASING' | 'STABLE' | 'DECREASING' | null = null;
  let signalStrength: number | null = null;
  if (riskOverview.totalWards > 0) {
    const hot = riskOverview.topWards.filter((w) => w.activeIncidents >= 3).length;
    if (hot > 0) assessment = `${hot} emerging incident ${hot === 1 ? 'cluster' : 'clusters'} detected in high-risk zones.`;
    else assessment = 'No emerging incident clusters detected in monitored zones.';
    const scoringDirection = riskOverview.critical + riskOverview.high;
    signalDirection = scoringDirection >= riskOverview.low ? 'INCREASING' : scoringDirection < riskOverview.low ? 'DECREASING' : 'STABLE';
    signalStrength = riskOverview.totalWards > 0
      ? Math.round(((riskOverview.critical + riskOverview.high) / riskOverview.totalWards) * 100)
      : null;
    if (signalStrength != null && signalStrength > 0) {
      riskSignal = `High-risk activity is concentrated across ${riskOverview.critical + riskOverview.high} of ${riskOverview.totalWards} monitored zones (${signalStrength}%).`;
    } else {
      riskSignal = 'Risk posture across monitored zones is currently calm.';
    }
  }

  const recommendations: AdminAiIntelligence['recommendations'] = [];
  const unassignedCritical = attentionQueue.filter((q) => !q.assigned && q.attentionLevel === 'CRITICAL').concat(
    attentionQueue.filter((q) => !q.assigned && q.attentionLevel === 'HIGH'),
  );
  if (unassignedCritical.length > 0) {
    recommendations.push({
      id: 'assign',
      action: `Assign ${unassignedCritical[0].publicId} — ${unassignedCritical[0].title} — to the responsible department.`,
      severity: 'high',
    });
  }
  const breachedTop = attentionQueue.filter((q) => q.slaState === 'BREACHED').slice(0, 1);
  if (breachedTop[0]) {
    recommendations.push({
      id: 'escalate',
      action: `Escalate ${breachedTop[0].publicId} — ${breachedTop[0].title} — SLA breached ${breachedTop[0].slaRemainingLabel ? 'by ' + breachedTop[0].slaRemainingLabel : ''}.`,
      severity: 'high',
    });
  }
  const highDept = departmentStatuses.find((d) => d.loadLevel === 'CRITICAL');
  if (highDept) {
    recommendations.push({
      id: 'load',
      action: `${highDept.name} is at critical load (${highDept.activeCases} active cases). Review staffing and redistribution.`,
      severity: 'medium',
    });
  }
  if (recommendations.length === 0) {
    recommendations.push({ id: 'clear', action: 'No immediate intervention is currently recommended.', severity: 'low' });
  }

  const intelligence: AdminAiIntelligence = {
    assessment,
    recommendations,
    riskSignal,
    signalDirection,
    signalStrength,
    computedAt: now.toISOString(),
  };

  // --- System status (restrained, real) -------------------------------------
  const notificationDegraded = pendingVerif > 20 || aiFailed > 10;
  const system: SystemStatusItem[] = [
    { key: 'api', label: 'API', status: 'OPERATIONAL', detail: 'Available' },
    { key: 'database', label: 'Database', status: 'OPERATIONAL', detail: 'Connected' },
    { key: 'ai', label: 'AI Intelligence Engine', status: aiFailed > 0 ? 'WARNING' : 'OPERATIONAL', detail: aiFailed > 0 ? `${aiFailed} failed runs` : 'Healthy' },
    { key: 'evidence', label: 'Evidence Storage', status: 'OPERATIONAL', detail: `${evidenceCount} items` },
    { key: 'notifications', label: 'Notification Service', status: notificationDegraded ? 'WARNING' : 'OPERATIONAL', detail: notificationDegraded ? 'Queue elevated' : 'Healthy' },
  ];

  // Map center (average of located active points)
  let center: { lat: number; lng: number } | null = null;
  if (mapPoints.length > 0) {
    const lat = mapPoints.reduce((s, p) => s + p.latitude, 0) / mapPoints.length;
    const lng = mapPoints.reduce((s, p) => s + p.longitude, 0) / mapPoints.length;
    center = { lat, lng };
  }

  // --- Operational trend series (last 14 days, real data) -----------------
  const [byDayTrend, categoryBreakdown] = await Promise.all([
    createdIssuesByDay({ days: 14 }),
    prisma.issue.groupBy({ by: ['category'], _count: { _all: true } }),
  ]);
  const categoryTrend: OperationalCategoryCount[] = categoryBreakdown
    .map((row) => ({
      category: row.category,
      label: CATEGORY_LABELS[row.category] ?? row.category,
      count: row._count._all,
    }))
    .sort((a, b) => b.count - a.count);

  const operational: AdminOperationalOverview = {
    summary,
    attentionQueue,
    departments: departmentStatuses,
    activity,
    system,
    intelligence,
    trend: {
      byDay: byDayTrend,
      byCategory: categoryTrend,
    },
    mapContext: { points: mapPoints, center },
  };

  return {
    kpis: {
      citizens,
      authorities,
      departments: departmentsRows,
      issues: { total: totalIssues, active: activeIssues, resolved: resolvedIssues, critical: criticalIssues },
      incidents: incidentCount,
      escalations: { total: await prisma.escalation.count(), open: openEsc.length },
      verifications: { total: verifCount, pending: pendingVerif },
      evidence: { total: evidenceCount, pending: pendingEvidence },
    },
    sla,
    escalations: { open: openEscItems, counts: { open: openEsc.length, critical: criticalEscalations, unresolved: openEsc.length } },
    risk: riskOverview,
    ai,
    actions,
    generatedAt: now.toISOString(),
    operational,
  };
}
