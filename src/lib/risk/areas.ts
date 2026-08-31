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
import { IssueCategory } from '../../../generated/prisma/client';
import { extractWardFromText, gridCellKey } from '@/lib/server/geocode';
import { computeAreaRisk, severityToScore, getRiskConfig } from './scoring';
import { calculateTrend } from './trend';
import type {
  RiskHotspot,
  WardRiskSummary,
  RiskSummary,
  TrendResult,
  RiskQueryParams,
} from './types';

// ---------------------------------------------------------------------------
// Raw issue shape we query from DB
// ---------------------------------------------------------------------------

interface RawIssue {
  id: string;
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
// Trend calculation helper
// ---------------------------------------------------------------------------

async function computeAreaTrend(
  areaName: string,
  days: number,
): Promise<TrendResult> {
  const { prevFrom, prevTo } = dateRange(days);

  // Count active issues in previous period for this area
  const prevIssues = await prisma.issue.findMany({
    where: {
      createdAt: { gte: prevFrom, lte: prevTo },
      status: { notIn: ['REJECTED'] },
    },
    select: { location: true, latitude: true, longitude: true },
  });

  const prevGrouped = groupIssues(prevIssues as RawIssue[]);
  const prevArea = prevGrouped.find(a => a.areaName === areaName);
  const prevCount = prevArea ? prevArea.issues.length : 0;

  // Current period count (already fetched, passed as parameter in real usage)
  // For simplicity, re-query current count
  const { from, to } = dateRange(days);
  const currentIssues = await prisma.issue.findMany({
    where: {
      createdAt: { gte: from, lte: to },
      status: { notIn: ['REJECTED'] },
    },
    select: { location: true, latitude: true, longitude: true },
  });

  const currentGrouped = groupIssues(currentIssues as RawIssue[]);
  const currentArea = currentGrouped.find(a => a.areaName === areaName);
  const currentCount = currentArea ? currentArea.issues.length : 0;

  return calculateTrend(currentCount, prevCount);
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

  const results: WardRiskSummary[] = [];

  for (const area of grouped) {
    const agg = aggregateArea(area, now);
    const cfg = getRiskConfig();

    const riskResult = computeAreaRisk({
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
    }, cfg);

    const trend = await computeAreaTrend(area.areaName, days);

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
      averageResolutionTime: agg.avgResolutionTime,
      topCategory: agg.dominantCategory,
      trend: { direction: trend.direction, percentage: trend.percentage },
      factors: riskResult.factors.map(f => ({
        key: f.key,
        label: f.label,
        score: f.factorScore,
        weight: f.weight,
      })),
    });
  }

  // Sort by risk score descending
  results.sort((a, b) => b.riskScore - a.riskScore);

  // Filter by risk level if requested
  if (params.riskLevel) {
    return results.filter(r => r.riskLevel === params.riskLevel);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Public API: fetch hotspots (top risk areas)
// ---------------------------------------------------------------------------

export async function fetchHotspots(
  params: RiskQueryParams = {},
): Promise<RiskHotspot[]> {
  const wards = await fetchAreaRisks(params);
  const limit = params.limit ?? 20;

  return wards.slice(0, limit).map(w => ({
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
    avgUnresolvedHours: 0,
    confirmVotes: 0,
    trend: w.trend,
    explanation: `${w.wardName}: ${w.activeIncidents} active issues, ${w.slaBreaches} SLA breaches, risk score ${w.riskScore}/100.`,
  }));
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

  // Overall trend: compare current period total to previous
  const days = params.days ?? 30;
  const { prevFrom, prevTo } = dateRange(days);
  const { from, to } = dateRange(days);

  const [currentCount, prevCount] = await Promise.all([
    prisma.issue.count({
      where: { createdAt: { gte: from, lte: to }, status: { notIn: ['REJECTED'] } },
    }),
    prisma.issue.count({
      where: { createdAt: { gte: prevFrom, lte: prevTo }, status: { notIn: ['REJECTED'] } },
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
    topHotspots: wards.slice(0, 5).map(w => ({
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
      avgUnresolvedHours: 0,
      confirmVotes: 0,
      trend: w.trend,
      explanation: `${w.wardName}: ${w.activeIncidents} active, score ${w.riskScore}/100.`,
    })),
  };
}
