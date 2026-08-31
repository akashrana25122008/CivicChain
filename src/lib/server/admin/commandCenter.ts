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
import type { IssueStatus, Severity } from '../../../../generated/prisma/client';

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
  authority: { department: string } | null;
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
      authority: e.authority?.department ?? null,
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
// Aggregation
// ---------------------------------------------------------------------------

export async function getAdminCommandCenter(): Promise<AdminCommandCenterData> {
  const now = new Date();

  // --- KPIs ---------------------------------------------------------------
  const [citizens, authorities, departmentsRows, incidentCount, promiseRows, escalations, verifCount, pendingVerif, evidenceCount, pendingEvidence, issueAgg] =
    await Promise.all([
      prisma.user.count({ where: { role: 'CITIZEN' } }),
      prisma.authority.count(),
      prisma.authority.groupBy({ by: ['department'] }),
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
          authority: { select: { department: true } },
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

  return {
    kpis: {
      citizens,
      authorities,
      departments: departmentsRows.length,
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
  };
}
