/**
 * Phase 16 — Department Command Center aggregation service.
 *
 * Builds the operator dashboard data for a single AUTHORITY user, strictly
 * scoped to their own authority record (RBAC is enforced by the caller via
 * `requireOwnAuthority`; this service never takes a department/scope from the
 * browser).
 *
 * Everything here is computed from REAL data:
 *   - KPIs (ACTIVE / AT-RISK / BREACHED) reuse the Phase 6 SLA evaluator.
 *   - SLA performance percentages come from real resolution outcomes.
 *   - Per-issue risk reuses the Phase 11 risk engine (computeAreaRisk) — the
 *     risk formula is never duplicated, only re-consumed at department scope.
 *   - The queue ordering reuses the pure `sortQueue` (src/lib/department/queue).
 */

import { prisma } from '@/lib/db';
import { calculateSlaState } from '@/lib/sla/state';
import { severityToScore, computeAreaRisk, getRiskConfig, type RiskLevel } from '@/lib/risk/scoring';
import { extractWardFromText } from '@/lib/server/geocode';
import { sortQueue, type QueueIssueInput, type QueueRank } from '@/lib/department/queue';
import {
  CATEGORY_LABELS,
  SEVERITY_LABELS,
  STATUS_LABELS,
  toDisplayStatus,
} from '@/lib/issues/mapping';
import type {
  IssueCategory,
  IssueStatus,
  PriorityLevel,
  PromiseStatus,
  Severity,
} from '../../../../generated/prisma/client';

export type SlaState = 'ON_TRACK' | 'AT_RISK' | 'BREACHED' | 'RESOLVED';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DepartmentKpis {
  total: number;
  active: number;
  resolved: number;
  rejected: number;
  /** Active promises whose SLA is currently BREACHED. */
  breached: number;
  /** Active promises currently AT_RISK. */
  atRisk: number;
  /** Active promises currently ON_TRACK. */
  onTrack: number;
  /** Active promises with no deadline at all (not SLA-tracked). */
  noSla: number;
  /** Open escalations. */
  escalationsOpen: number;
  /** Promises owed to citizens (active). */
  promisesActive: number;
  /** Promises completed on time. */
  promisesOnTime: number;
  /** Promises broken (deadline missed). */
  promisesBroken: number;
  /** SLA performance: % of completed/closed promises honoured on time. */
  slaPerformancePct: number | null;
}

export interface CommandCenterMapMarker {
  id: string;
  publicId: string;
  title: string;
  category: IssueCategory;
  categoryLabel: string;
  status: IssueStatus;
  displayStatus: string;
  severity: Severity | null;
  severityLabel: string | null;
  priority: number | null;
  priorityLevel: PriorityLevel | null;
  latitude: number;
  longitude: number;
  ward: string | null;
  riskLevel: string | null;
  slaState: SlaState;
}

export interface CommandCenterQueueItem {
  id: string;
  publicId: string;
  title: string;
  category: IssueCategory;
  categoryLabel: string;
  status: IssueStatus;
  statusLabel: string;
  displayStatus: string;
  severity: Severity | null;
  severityLabel: string | null;
  priority: number | null;
  priorityLevel: PriorityLevel | null;
  ward: string | null;
  location: string | null;
  riskLevel: string | null;
  slaState: SlaState;
  deadline: string | null;
  createdAt: string;
  timeLabel: string;
  queueScore: number;
  queueLevel: string;
  queueComponents: QueueRank['components'];
}

export interface CommandCenterEscalation {
  id: string;
  issueId: string;
  issuePublicId: string;
  issueTitle: string;
  level: number;
  status: string;
  reason: string | null;
  timeLabel: string;
}

export interface CommandCenterResult {
  authority: { name: string; department: string; jurisdiction: string | null };
  kpis: DepartmentKpis;
  queue: CommandCenterQueueItem[];
  queueTotal: number;
  map: CommandCenterMapMarker[];
  escalations: CommandCenterEscalation[];
  /** Total located (mapped) issues. */
  mappedCount: number;
  filters: {
    categories: Array<{ value: IssueCategory; label: string }>;
    statuses: Array<{ value: IssueStatus; label: string }>;
    severity: Array<{ value: Severity; label: string }>;
    wards: Array<{ value: string; label: string }>;
    priorityLevels: Array<{ value: PriorityLevel; label: string }>;
  };
}

// ---------------------------------------------------------------------------
// Raw issue loader (department-scoped)
// ---------------------------------------------------------------------------

interface EscalationRow {
  id: string;
  issueId: string;
  level: number;
  status: string;
  reason: string | null;
  createdAt: Date;
  issue: { publicId: string; title: string } | null;
}

export interface CommandIssueRow {
  id: string;
  publicId: string;
  title: string;
  category: IssueCategory;
  status: IssueStatus;
  severity: Severity | null;
  priority: number | null;
  priorityLevel: PriorityLevel | null;
  latitude: number | null;
  longitude: number | null;
  location: string | null;
  createdAt: Date;
  updatedAt: Date;
  promise: { deadline: Date; status: PromiseStatus } | null;
  incident: { issues: { id: string }[] } | null;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function deadlineOf(promise: { deadline: Date; status: PromiseStatus } | null): Date | null {
  if (!promise) return null;
  return promise.deadline;
}

// ---------------------------------------------------------------------------
// Department-scoped risk (reuses the Phase 11 risk engine)
// ---------------------------------------------------------------------------

interface WardRiskResult {
  ward: string;
  riskLevel: RiskLevel;
  riskScore: number;
}

/**
 * Compute risk for each ward within the department's own jurisdiction, reusing
 * the canonical Phase 11 `computeAreaRisk`. This does NOT duplicate the risk
 * formula — it only feeds department-scoped inputs into the existing engine.
 */
export function computeDepartmentWardRisks(
  issues: CommandIssueRow[],
  now = new Date(),
): WardRiskResult[] {
  const byWard = new Map<string, CommandIssueRow[]>();
  for (const issue of issues) {
    const ward = extractWardFromText(issue.location) ?? 'Unknown';
    const list = byWard.get(ward) ?? [];
    list.push(issue);
    byWard.set(ward, list);
  }

  const cfg = getRiskConfig();
  const results: WardRiskResult[] = [];

  for (const [ward, rows] of byWard) {
    const active = rows.filter((i) => i.status !== 'RESOLVED' && i.status !== 'REJECTED');
    if (active.length === 0) continue;

    let slaBreaches = 0;
    let slaAtRisk = 0;
    const confirmVotes = 0;
    const totalVotes = 0;
    const severities: number[] = [];
    let unresolvedHours = 0;

    for (const issue of active) {
      if (issue.severity) severities.push(severityToScore(issue.severity));
      const nowMs = now.getTime();
      unresolvedHours += Math.max(0, (nowMs - issue.createdAt.getTime()) / (1000 * 60 * 60));

      if (issue.promise?.deadline) {
        const snap = calculateSlaState({
          deadline: issue.promise.deadline,
          createdAt: issue.createdAt,
          resolved: issue.status === 'RESOLVED' || issue.status === 'REJECTED',
          now,
        });
        if (snap.slaState === 'BREACHED') slaBreaches += 1;
        else if (snap.slaState === 'AT_RISK') slaAtRisk += 1;
      }
    }

    const severityScore = severities.length > 0
      ? severities.reduce((s, v) => s + v, 0) / severities.length
      : 0;
    const avgUnresolvedHours = active.length > 0 ? unresolvedHours / active.length : 0;

    // Repeat incidents: issues with the same category AND ward are the signal.
    const categoryCounts = new Map<string, number>();
    for (const issue of active) {
      categoryCounts.set(issue.category, (categoryCounts.get(issue.category) ?? 0) + 1);
    }
    const repeatCount = Array.from(categoryCounts.values()).reduce(
      (sum, count) => sum + (count > 1 ? count : 0),
      0,
    );

    const result = computeAreaRisk(
      {
        severityScore,
        issueCount: active.length,
        repeatCount,
        slaBreaches,
        slaAtRisk,
        activeCount: active.length,
        avgUnresolvedHours,
        confirmVotes,
        totalVotes,
        populationExposure: null,
      },
      cfg,
    );

    results.push({ ward, riskLevel: result.level, riskScore: result.score });
  }

  results.sort((a, b) => b.riskScore - a.riskScore);
  return results;
}

// ---------------------------------------------------------------------------
// Public aggregation
// ---------------------------------------------------------------------------

function toMapMarker(
  issue: CommandIssueRow,
  wardRisk: Map<string, WardRiskResult>,
  slaState: SlaState,
): CommandCenterMapMarker {
  const ward = extractWardFromText(issue.location) ?? null;
  return {
    id: issue.id,
    publicId: issue.publicId,
    title: issue.title,
    category: issue.category,
    categoryLabel: CATEGORY_LABELS[issue.category] ?? issue.category,
    status: issue.status,
    displayStatus: toDisplayStatus(issue.status, issue.promise),
    severity: issue.severity,
    severityLabel: issue.severity ? (SEVERITY_LABELS[issue.severity] ?? issue.severity) : null,
    priority: issue.priority,
    priorityLevel: issue.priorityLevel ?? null,
    latitude: issue.latitude as number,
    longitude: issue.longitude as number,
    ward,
    riskLevel: ward ? (wardRisk.get(ward)?.riskLevel ?? null) : null,
    slaState,
  };
}

const ACTIVE_STATUSES: IssueStatus[] = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'VERIFIED',
  'ASSIGNED',
  'IN_PROGRESS',
];

function resolveSlaState(issue: CommandIssueRow, now: Date): SlaState {
  const promise = issue.promise;
  if (!promise) return 'ON_TRACK' as SlaState; // no deadline tracked
  const resolved = issue.status === 'RESOLVED' || issue.status === 'REJECTED';
  return calculateSlaState({
    deadline: promise.deadline,
    createdAt: issue.createdAt,
    resolved,
    now,
  }).slaState as SlaState;
}

export interface CommandCenterParams {
  authorityId: string;
  /** Filters — all optional, validated upstream. */
  category?: IssueCategory | null;
  status?: IssueStatus | null;
  severity?: Severity | null;
  priorityLevel?: PriorityLevel | null;
  ward?: string | null;
  slaState?: SlaState | null;
  riskLevel?: string | null;
  q?: string | null;
  /** Queue page size for the frontend list. */
  limit?: number;
  /** Include closed issues in the queue (default false). */
  includeClosed?: boolean;
}

export async function getCommandCenter(
  params: CommandCenterParams & { authority: { name: string; department: string; jurisdiction: string | null } },
): Promise<CommandCenterResult> {
  const { authorityId, authority } = params;
  const now = new Date();
  const limit = Math.min(200, Math.max(1, params.limit ?? 50));

  const where = { authorityId };

  // We load the department's issues once and derive KPIs, risk, queue, and map
  // from the same real rows (single source of truth, no count drift).
  const issues = await prisma.issue.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      promise: { select: { deadline: true, status: true } },
      incident: { select: { issues: { select: { id: true } } } },
    },
  }) as unknown as CommandIssueRow[];

  const escalations = await prisma.escalation.findMany({
    where: { issue: { authorityId } },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { issue: { select: { publicId: true, title: true } } },
  }) as unknown as EscalationRow[];

  // Promises for SLA performance (authority-scoped).
  const [promisesActive, promisesCompleted, promisesBroken, escalationsOpen] = await Promise.all([
    prisma.promise.count({ where: { authorityId, status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    prisma.promise.count({ where: { authorityId, status: 'COMPLETED' } }),
    prisma.promise.count({ where: { authorityId, status: 'BROKEN' } }),
    prisma.escalation.count({ where: { issue: { authorityId }, status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
  ]);

  // --- KPIs ---
  const resolved = issues.filter((i) => i.status === 'RESOLVED').length;
  const rejected = issues.filter((i) => i.status === 'REJECTED').length;
  const active = issues.filter((i) => ACTIVE_STATUSES.includes(i.status)).length;

  let breached = 0;
  let atRisk = 0;
  let onTrack = 0;
  let noSla = 0;
  for (const issue of issues) {
    if (!ACTIVE_STATUSES.includes(issue.status)) continue;
    if (!issue.promise?.deadline) {
      noSla += 1;
      continue;
    }
    const st = resolveSlaState(issue, now);
    if (st === 'BREACHED') breached += 1;
    else if (st === 'AT_RISK') atRisk += 1;
    else if (st === 'ON_TRACK') onTrack += 1;
  }

  // SLA performance: % of promises honoured on time among closed ones.
  const closedPromises = promisesCompleted + promisesBroken;
  const slaPerformancePct =
    closedPromises > 0 ? Math.round((promisesCompleted / closedPromises) * 1000) / 10 : null;

  const kpis: DepartmentKpis = {
    total: issues.length,
    active,
    resolved,
    rejected,
    breached,
    atRisk,
    onTrack,
    noSla,
    escalationsOpen,
    promisesActive,
    promisesOnTime: promisesCompleted,
    promisesBroken,
    slaPerformancePct,
  };

  // --- Ward risk (department-scoped, Phase 11 engine) ---
  const wardRisks = computeDepartmentWardRisks(issues, now);
  const wardRiskMap = new Map(wardRisks.map((w) => [w.ward, w]));

  // --- Queue ---
  const queueInputs: QueueIssueInput[] = issues.map((issue) => {
    const ward = extractWardFromText(issue.location) ?? null;
    const openEscalationLevel = escalations
      .filter((e) => e.issueId === issue.id && e.status !== 'RESOLVED')
      .reduce((max, e) => Math.max(max, e.level), 0);
    return {
      id: issue.id,
      status: issue.status,
      severity: issue.severity,
      priority: issue.priority,
      escalationLevel: openEscalationLevel,
      riskLevel: wardRiskMap.get(ward ?? '')?.riskLevel ?? null,
      createdAt: issue.createdAt,
      slaDeadline: deadlineOf(issue.promise),
      slaCreatedAt: issue.createdAt,
      now,
    };
  });

  const term = params.q?.trim().toLowerCase();
  let filtered = queueInputs.filter((input) => {
    const issue = issues.find((i) => i.id === input.id)!;
    if (params.category && issue.category !== params.category) return false;
    if (params.status && issue.status !== params.status) return false;
    if (params.severity && issue.severity !== params.severity) return false;
    if (params.priorityLevel && issue.priorityLevel !== params.priorityLevel) return false;
    const ward = extractWardFromText(issue.location) ?? null;
    if (params.ward && ward !== params.ward) return false;
    if (params.slaState && resolveSlaState(issue, now) !== params.slaState) return false;
    const iRisk = wardRiskMap.get(ward ?? '')?.riskLevel ?? null;
    if (params.riskLevel && iRisk !== params.riskLevel) return false;
    if (term) {
      const hay = `${issue.publicId} ${issue.title} ${issue.location ?? ''}`.toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  });

  if (!params.includeClosed) {
    filtered = filtered.filter((i) => i.status !== 'RESOLVED' && i.status !== 'REJECTED');
  }

  filtered = sortQueue({ issues: filtered, now }).map((s) => s.input);
  const rankedSlice = sortQueue({ issues: filtered.slice(0, limit), now });

  const queue: CommandCenterQueueItem[] = rankedSlice.map(({ input, rank }) => {
    const issue = issues.find((i) => i.id === input.id)!;
    const ward = extractWardFromText(issue.location) ?? null;
    return {
      id: issue.id,
      publicId: issue.publicId,
      title: issue.title,
      category: issue.category,
      categoryLabel: CATEGORY_LABELS[issue.category] ?? issue.category,
      status: issue.status,
      statusLabel: STATUS_LABELS[issue.status] ?? issue.status,
      displayStatus: toDisplayStatus(issue.status, issue.promise),
      severity: issue.severity,
      severityLabel: issue.severity ? (SEVERITY_LABELS[issue.severity] ?? issue.severity) : null,
      priority: issue.priority,
      priorityLevel: issue.priorityLevel ?? null,
      ward,
      location: issue.location,
      riskLevel: wardRiskMap.get(ward ?? '')?.riskLevel ?? null,
      slaState: resolveSlaState(issue, now),
      deadline: issue.promise?.deadline?.toISOString() ?? null,
      createdAt: issue.createdAt.toISOString(),
      timeLabel: formatRelativeTime(issue.createdAt),
      queueScore: rank.score,
      queueLevel: rank.level,
      queueComponents: rank.components,
    };
  });

  // --- Map markers (only located issues) ---
  const map = issues
    .filter((i) => i.latitude != null && i.longitude != null)
    .map((issue) => toMapMarker(issue, wardRiskMap, resolveSlaState(issue, now)));

  // --- Filters for the UI ---
  const wards = Array.from(
    new Set(
      issues
        .map((i) => extractWardFromText(i.location))
        .filter((w): w is string => Boolean(w)),
    ),
  ).map((w) => ({ value: w, label: w }));

  const escalationsOpenList = escalations
    .filter((e) => e.status !== 'RESOLVED')
    .slice(0, 10)
    .map((e) => ({
      id: e.id,
      issueId: e.issueId,
      issuePublicId: e.issue?.publicId ?? e.issueId,
      issueTitle: e.issue?.title ?? 'Unknown report',
      level: e.level,
      status: e.status,
      reason: e.reason,
      timeLabel: formatRelativeTime(e.createdAt),
    }));

  return {
    authority: {
      name: authority.name,
      department: authority.department,
      jurisdiction: authority.jurisdiction,
    },
    kpis,
    queue,
    queueTotal: filtered.length,
    map,
    mappedCount: map.length,
    escalations: escalationsOpenList,
    filters: {
      categories: (Object.entries(CATEGORY_LABELS) as Array<[IssueCategory, string]>).map(([value, label]) => ({ value, label })),
      statuses: (Object.entries(STATUS_LABELS) as Array<[IssueStatus, string]>).map(([value, label]) => ({ value, label })),
      severity: (Object.entries(SEVERITY_LABELS) as Array<[Severity, string]>).map(([value, label]) => ({ value, label })),
      wards,
      priorityLevels: [
        { value: 'CRITICAL' as PriorityLevel, label: 'Critical' },
        { value: 'HIGH' as PriorityLevel, label: 'High' },
        { value: 'MEDIUM' as PriorityLevel, label: 'Medium' },
        { value: 'LOW' as PriorityLevel, label: 'Low' },
      ],
    },
  };
}