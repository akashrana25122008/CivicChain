/**
 * Phase 11 — Area Aggregation Service
 *
 * Queries real issue data from the database and groups issues into geographic
 * areas (grid cells or extracted ward names). Feeds the risk scoring engine
 * with real per-area data.
 *
 * Area grouping strategy:
 *  1. First try to extract ward names from the free-text `location` field.
 *  2. For issues without a recognizable ward, bin by ~1km grid cell.
 *  3. Each area becomes a hotspot with a computed risk score.
 *
 * No Ward model is required — area identity is derived from real data.
 */

import { prisma } from '@/lib/db';
import { IssueCategory, IssueStatus, type Prisma } from '../../../generated/prisma/client';
import { extractWardFromText, gridCellKey } from '@/lib/server/geocode';
import {
  computeAreaRisk,
  generateRiskExplanation,
  severityToScore,
  getRiskConfig,
  type AreaRiskInput,
} from './scoring';
import { calculateTrend } from './trend';
import type {
  RiskHotspot,
  WardRiskSummary,
  WardRiskDetail,
  RiskSummary,
  TrendResult,
  RiskQueryParams,
} from './types';

// ---------------------------------------------------------------------------
// Raw issue shape we query from DB
// ---------------------------------------------------------------------------

interface RawIssue {
  id: string;
  publicId: string;
  title: string;
  category: string;
  severity: string | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
  location: string | null;
  priority: number | null;
  createdAt: Date;
  updatedAt: Date;
  promise: {
    deadline: Date;
    status: string;
  } | null;
  votes: { type: string }[];
}

interface GroupedArea {
  areaId: string;
  areaName: string;
  issues: RawIssue[];
  centroidLat: number;
  centroidLng: number;
}

// ---------------------------------------------------------------------------
// Time window helpers
// ---------------------------------------------------------------------------

function dateRange(days: number): { from: Date; to: Date; prevFrom: Date; prevTo: Date } {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  const prevTo = new Date(from.getTime());
  const prevFrom = new Date(prevTo.getTime() - days * 24 * 60 * 60 * 1000);
  return { from, to, prevFrom, prevTo };
}

// ---------------------------------------------------------------------------
// Group issues into areas
// ---------------------------------------------------------------------------

function groupIssues(issues: RawIssue[]): GroupedArea[] {
  const groups = new Map<string, RawIssue[]>();

  for (const issue of issues) {
    // Try ward name extraction first
    const wardName = extractWardFromText(issue.location);
    if (wardName) {
      const existing = groups.get(wardName);
      if (existing) {
        existing.push(issue);
      } else {
        groups.set(wardName, [issue]);
      }
      continue;
    }

    // Fall back to grid cell grouping
    if (issue.latitude != null && issue.longitude != null) {
      const key = gridCellKey(issue.latitude, issue.longitude);
      const existing = groups.get(key);
      if (existing) {
        existing.push(issue);
      } else {
        groups.set(key, [issue]);
      }
    } else {
      // No location at all — group under "Unknown Location"
      const key = 'unknown_location';
      const existing = groups.get(key);
      if (existing) {
        existing.push(issue);
      } else {
        groups.set(key, [issue]);
      }
    }
  }

  // Convert to GroupedArea with centroids
  return Array.from(groups.entries()).map(([areaId, areaIssues]) => {
    const withCoords = areaIssues.filter(i => i.latitude != null && i.longitude != null);
    const centroidLat = withCoords.length > 0
      ? withCoords.reduce((s, i) => s + (i.latitude ?? 0), 0) / withCoords.length
      : 27.4924; // Default to Agra
    const centroidLng = withCoords.length > 0
      ? withCoords.reduce((s, i) => s + (i.longitude ?? 0), 0) / withCoords.length
      : 78.0322;

    // Area name: ward name or human-readable grid label
    let areaName = areaId;
    if (areaId.startsWith('area_')) {
      areaName = `Area (${centroidLat.toFixed(3)}, ${centroidLng.toFixed(3)})`;
    }
    if (areaId === 'unknown_location') {
      areaName = 'Unknown Location';
    }

    return { areaId, areaName, issues: areaIssues, centroidLat, centroidLng };
  });
}

// ---------------------------------------------------------------------------
// Aggregate area data into risk inputs
// ---------------------------------------------------------------------------

function aggregateArea(area: GroupedArea, now: Date) {
  const issues = area.issues;
  const activeIssues = issues.filter(i =>
    !['RESOLVED', 'REJECTED'].includes(i.status),
  );

  // Severity average
  const severities = issues.filter(i => i.severity).map(i => severityToScore(i.severity));
  const severityScore = severities.length > 0
    ? severities.reduce((s, v) => s + v, 0) / severities.length
    : 0;

  // SLA calculation
  let slaBreaches = 0;
  let slaAtRisk = 0;
  const resolvedTimes: number[] = [];

  for (const issue of activeIssues) {
    if (issue.promise) {
      const deadline = new Date(issue.promise.deadline);
      if (deadline < now) {
        slaBreaches++;
      } else {
        const total = deadline.getTime() - new Date(issue.createdAt).getTime();
        const elapsed = now.getTime() - new Date(issue.createdAt).getTime();
        if (total > 0 && elapsed / total >= 0.8) {
          slaAtRisk++;
        }
      }
    }
  }

  for (const issue of issues) {
    if (issue.status === 'RESOLVED' || issue.status === 'VERIFIED') {
      const created = new Date(issue.createdAt).getTime();
      const resolved = new Date(issue.updatedAt).getTime();
      resolvedTimes.push((resolved - created) / (1000 * 60 * 60)); // hours
    }
  }

  // Unresolved duration
  const unresolvedIssues = activeIssues;
  const unresolvedHours = unresolvedIssues.map(i =>
    (now.getTime() - new Date(i.createdAt).getTime()) / (1000 * 60 * 60),
  );
  const avgUnresolvedHours = unresolvedHours.length > 0
    ? unresolvedHours.reduce((s, v) => s + v, 0) / unresolvedHours.length
    : 0;

  // Repeat detection: count categories with >1 occurrence
  const categoryCounts = new Map<string, number>();
  for (const issue of activeIssues) {
    categoryCounts.set(issue.category, (categoryCounts.get(issue.category) ?? 0) + 1);
  }
  const repeatCount = Array.from(categoryCounts.values()).reduce(
    (sum, count) => sum + (count > 1 ? count : 0), 0,
  );

  // Dominant category
  let dominantCategory = 'NONE';
  let maxCount = 0;
  for (const [cat, count] of categoryCounts) {
    if (count > maxCount) { maxCount = count; dominantCategory = cat; }
  }

  // Votes
  const confirmVotes = issues.reduce((sum, i) =>
    sum + i.votes.filter(v => v.type === 'CONFIRM').length, 0);
  const totalVotes = issues.reduce((sum, i) => sum + i.votes.length, 0);

  // Average resolution time
  const avgResolutionTime = resolvedTimes.length > 0
    ? resolvedTimes.reduce((s, v) => s + v, 0) / resolvedTimes.length
    : null;

  return {
    severityScore,
    issueCount: activeIssues.length,
    totalIssues: issues.length,
    repeatCount,
    slaBreaches,
    slaAtRisk,
    activeCount: activeIssues.length,
    avgUnresolvedHours,
    confirmVotes,
    totalVotes,
    dominantCategory,
    avgResolutionTime,
  };
}

// ---------------------------------------------------------------------------
// Trend calculation (batched — one query per period, not per area)
// ---------------------------------------------------------------------------

interface PeriodCounts {
  areaName: string;
  count: number;
}

async function loadPeriodCounts(
  from: Date,
  to: Date,
  category?: string,
): Promise<PeriodCounts[]> {
  const issues = await prisma.issue.findMany({
    where: {
      createdAt: { gte: from, lte: to },
      status: { notIn: ['REJECTED'] },
      ...(category ? { category: category as IssueCategory } : {}),
    },
    select: { location: true, latitude: true, longitude: true },
  });
  const grouped = groupIssues(issues as RawIssue[]);
  return grouped.map(a => ({ areaName: a.areaName, count: a.issues.length }));
}

async function computeAreaTrends(
  areaNames: string[],
  days: number,
  category?: string,
): Promise<Map<string, TrendResult>> {
  const { from, to, prevFrom, prevTo } = dateRange(days);

  const [current, previous] = await Promise.all([
    loadPeriodCounts(from, to, category),
    loadPeriodCounts(prevFrom, prevTo, category),
  ]);

  const currentMap = new Map(current.map(p => [p.areaName, p.count]));
  const prevMap = new Map(previous.map(p => [p.areaName, p.count]));

  const results = new Map<string, TrendResult>();
  for (const name of areaNames) {
    const currentCount = currentMap.get(name) ?? 0;
    const prevCount = prevMap.get(name) ?? 0;
    results.set(name, calculateTrend(currentCount, prevCount));
  }
  return results;
}

// ---------------------------------------------------------------------------
// Public API: fetch and compute all area risks
// ---------------------------------------------------------------------------

export async function fetchAreaRisks(
  params: RiskQueryParams = {},
): Promise<WardRiskSummary[]> {
  const days = params.days ?? 30;
  const { from } = dateRange(days);
  const now = new Date();

  // Fetch all issues in the time window with related data
  const issues = await prisma.issue.findMany({
    where: {
      createdAt: { gte: from },
      status: { notIn: ['REJECTED'] },
      ...(params.category ? { category: params.category as IssueCategory } : {}),
      ...(params.departmentId ? { departmentId: params.departmentId } : {}),
    },
    include: {
      promise: {
        select: { deadline: true, status: true },
      },
      votes: {
        select: { type: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (issues.length === 0) return [];

  const rawIssues = issues as unknown as RawIssue[];
  const grouped = groupIssues(rawIssues);

  // Batch the trend comparison: two queries total, not one per area.
  const trends = await computeAreaTrends(
    grouped.map(a => a.areaName),
    days,
    params.category,
  );

  const results: WardRiskSummary[] = [];

  for (const area of grouped) {
    const agg = aggregateArea(area, now);
    const cfg = getRiskConfig();

    const input: AreaRiskInput = {
      severityScore: agg.severityScore,
      issueCount: agg.issueCount,
      repeatCount: agg.repeatCount,
      slaBreaches: agg.slaBreaches,
      slaAtRisk: agg.slaAtRisk,
      activeCount: agg.activeCount,
      avgUnresolvedHours: agg.avgUnresolvedHours,
      confirmVotes: agg.confirmVotes,
      totalVotes: agg.totalVotes,
      populationExposure: null,
    };

    const riskResult = computeAreaRisk(input, cfg);
    const trend = trends.get(area.areaName) ?? { direction: 'STABLE' as const, percentage: 0 };

    results.push({
      wardId: area.areaId,
      wardName: area.areaName,
      latitude: area.centroidLat,
      longitude: area.centroidLng,
      riskScore: riskResult.score,
      riskLevel: riskResult.level,
      activeIncidents: agg.issueCount,
      totalIncidents: agg.totalIssues,
      repeatIssues: agg.repeatCount,
      slaBreaches: agg.slaBreaches,
      slaAtRisk: agg.slaAtRisk,
      avgUnresolvedHours: Math.round(agg.avgUnresolvedHours),
      confirmVotes: agg.confirmVotes,
      totalVotes: agg.totalVotes,
      averageResolutionTime: agg.avgResolutionTime,
      topCategory: agg.dominantCategory,
      trend: { direction: trend.direction, percentage: trend.percentage },
      factors: riskResult.factors.map(f => ({
        key: f.key,
        label: f.label,
        score: f.factorScore,
        weight: f.weight,
      })),
      explanation: generateRiskExplanation(area.areaName, riskResult, input),
    });
  }

  // Sort by risk score descending
  results.sort((a, b) => b.riskScore - a.riskScore);

  // Filter by risk level if requested
  if (params.riskLevel) {
    return results.filter(r => r.riskLevel === params.riskLevel);
  }

  // Apply pagination (limit/offset) only after level-filtering so callers get a
  // predictable page shape.
  if (params.limit != null || params.offset != null) {
    const start = params.offset ?? 0;
    const end = params.limit != null ? start + params.limit : undefined;
    return results.slice(start, end);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Public API: fetch hotspots (top risk areas)
// ---------------------------------------------------------------------------

/**
 * Shape a ward summary into a hotspot record. Exported for unit testing —
 * a hotspot must carry the REAL aggregate values this risk engine computes.
 */
export function toHotspot(w: WardRiskSummary): RiskHotspot {
  return {
    hotspotId: w.wardId,
    areaName: w.wardName,
    latitude: w.latitude,
    longitude: w.longitude,
    riskScore: w.riskScore,
    riskLevel: w.riskLevel,
    activeIncidents: w.activeIncidents,
    totalIncidents: w.totalIncidents,
    repeatIncidentCount: w.repeatIssues,
    slaBreaches: w.slaBreaches,
    slaAtRisk: w.slaAtRisk,
    dominantCategory: w.topCategory,
    avgUnresolvedHours: w.avgUnresolvedHours,
    confirmVotes: w.confirmVotes,
    trend: w.trend,
    explanation: w.explanation,
  };
}

export async function fetchHotspots(
  params: RiskQueryParams = {},
): Promise<RiskHotspot[]> {
  const wards = await fetchAreaRisks(params);
  return wards.map(toHotspot);
}

// ---------------------------------------------------------------------------
// Public API: risk summary
// ---------------------------------------------------------------------------

export async function fetchRiskSummary(
  params: RiskQueryParams = {},
): Promise<RiskSummary> {
  const wards = await fetchAreaRisks(params);

  const lowRiskAreas = wards.filter(w => w.riskLevel === 'LOW').length;
  const mediumRiskAreas = wards.filter(w => w.riskLevel === 'MEDIUM').length;
  const highRiskAreas = wards.filter(w => w.riskLevel === 'HIGH').length;
  const criticalRiskAreas = wards.filter(w => w.riskLevel === 'CRITICAL').length;

  const totalActiveIssues = wards.reduce((s, w) => s + w.activeIncidents, 0);
  const totalSlaBreaches = wards.reduce((s, w) => s + w.slaBreaches, 0);

  const avgScore = wards.length > 0
    ? Math.round(wards.reduce((s, w) => s + w.riskScore, 0) / wards.length)
    : 0;

  // Overall trend: compare current period total to previous (honoring filters)
  const days = params.days ?? 30;
  const now = new Date();
  const { prevFrom, prevTo } = dateRange(days);
  const { from, to } = dateRange(days);

  const trendWhere: Prisma.IssueWhereInput = {
    status: { notIn: [IssueStatus.REJECTED] },
    ...(params.category ? { category: params.category as IssueCategory } : {}),
    ...(params.departmentId ? { departmentId: params.departmentId } : {}),
  };

  const [currentCount, prevCount] = await Promise.all([
    prisma.issue.count({
      where: { createdAt: { gte: from, lte: to }, ...trendWhere },
    }),
    prisma.issue.count({
      where: { createdAt: { gte: prevFrom, lte: prevTo }, ...trendWhere },
    }),
  ]);

  const overallTrend = calculateTrend(currentCount, prevCount);

  return {
    totalAreas: wards.length,
    lowRiskAreas,
    mediumRiskAreas,
    highRiskAreas,
    criticalRiskAreas,
    totalActiveIssues,
    totalSlaBreaches,
    averageRiskScore: avgScore,
    overallTrend: { direction: overallTrend.direction, percentage: overallTrend.percentage },
    topHotspots: wards.slice(0, 5).map(toHotspot),
    computedAt: now.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Public API: full ward/area detail for GET /api/risk/wards/:wardId
// ---------------------------------------------------------------------------

/** Pure: tally issues by category, highest count first. Unit-tested. */
export function categoryBreakdownFromIssues(
  issues: Array<{ category: string }>,
): Array<{ category: string; count: number }> {
  const counts = new Map<string, number>();
  for (const issue of issues) {
    counts.set(issue.category, (counts.get(issue.category) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}

export async function fetchWardDetail(
  wardId: string,
  params: RiskQueryParams = {},
): Promise<WardRiskDetail | null> {
  const requestedWardByAreaId = wardId;
  const days = params.days ?? 30;
  const { from } = dateRange(days);
  const now = new Date();

  const issues = await prisma.issue.findMany({
    where: {
      createdAt: { gte: from },
      status: { notIn: ['REJECTED'] },
      ...(params.category ? { category: params.category as IssueCategory } : {}),
      ...(params.departmentId ? { departmentId: params.departmentId } : {}),
    },
    include: {
      promise: {
        select: { deadline: true, status: true },
      },
      votes: {
        select: { type: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (issues.length === 0) return null;

  const grouped = groupIssues(issues as unknown as RawIssue[]);
  const area = grouped.find(a => a.areaId === requestedWardByAreaId);
  if (!area) return null;

  const agg = aggregateArea(area, now);
  const cfg = getRiskConfig();

  const input: AreaRiskInput = {
    severityScore: agg.severityScore,
    issueCount: agg.issueCount,
    repeatCount: agg.repeatCount,
    slaBreaches: agg.slaBreaches,
    slaAtRisk: agg.slaAtRisk,
    activeCount: agg.activeCount,
    avgUnresolvedHours: agg.avgUnresolvedHours,
    confirmVotes: agg.confirmVotes,
    totalVotes: agg.totalVotes,
    populationExposure: null,
  };
  const riskResult = computeAreaRisk(input, cfg);

  const trends = await computeAreaTrends([area.areaName], days, params.category);
  const trend = trends.get(area.areaName) ?? { direction: 'STABLE' as const, percentage: 0 };

  // Category breakdown within this ward.
  const categoryBreakdown = categoryBreakdownFromIssues(area.issues);

  // Symptom issues (recent, still relevant) driving this ward's risk.
  const issuesForWard = area.issues
    .slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 10)
    .map(i => ({
      id: i.id,
      publicId: i.publicId ?? i.id,
      title: i.title,
      category: i.category,
      severity: i.severity ?? null,
      status: i.status,
      createdAt: i.createdAt,
      promiseDeadline: i.promise?.deadline ?? null,
      promiseStatus: i.promise?.status ?? null,
    }));

  return {
    wardId: area.areaId,
    wardName: area.areaName,
    latitude: area.centroidLat,
    longitude: area.centroidLng,
    riskScore: riskResult.score,
    riskLevel: riskResult.level,
    activeIncidents: agg.issueCount,
    totalIncidents: agg.totalIssues,
    repeatIssues: agg.repeatCount,
    slaBreaches: agg.slaBreaches,
    slaAtRisk: agg.slaAtRisk,
    avgUnresolvedHours: Math.round(agg.avgUnresolvedHours),
    confirmVotes: agg.confirmVotes,
    totalVotes: agg.totalVotes,
    averageResolutionTime: agg.avgResolutionTime,
    topCategory: agg.dominantCategory,
    trend: { direction: trend.direction, percentage: trend.percentage },
    factors: riskResult.factors.map(f => ({
      key: f.key,
      label: f.label,
      score: f.factorScore,
      weight: f.weight,
    })),
    explanation: generateRiskExplanation(area.areaName, riskResult, input),
    issues: issuesForWard,
    categoryBreakdown,
  };
}
