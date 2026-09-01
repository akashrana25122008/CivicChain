import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIntelligence, type LandingIntelligence } from '../landing';
import type { AnalyticsPayload } from '../analytics';

function payload(overrides: Partial<{
  active: number;
  total: number;
  avgResolutionMinutes: number | null;
  onTrack: number;
  atRisk: number;
  breached: number;
  verified: number;
  highRiskAreas: number;
  criticalRiskAreas: number;
  avgConfidence: number | null;
  resolutionRatePct: number | null;
}> = {}): AnalyticsPayload {
  return {
    generatedAt: '2026-08-31T00:00:00.000Z',
    range: 'all',
    issues: {
      total: overrides.total ?? 100,
      active: overrides.active ?? 10,
      resolved: 40,
      rejected: 5,
      byStatus: [],
      byCategory: [],
      byDepartment: [],
      overTime: [],
      trend: { direction: 'STABLE', percentage: 0, current: 0, previous: 0 },
    },
    resolution: {
      resolutionRatePct: overrides.resolutionRatePct ?? 40,
      avgResolutionMinutes: overrides.avgResolutionMinutes ?? 120,
      resolvedCount: 40,
      avgFirstResponseMinutes: null,
      reopenCount: 0,
      reopenRatePct: null,
      trend: null,
    },
    sla: {
      onTrack: overrides.onTrack ?? 50,
      atRisk: overrides.atRisk ?? 30,
      breached: overrides.breached ?? 10,
      activePromises:
        (overrides.onTrack ?? 50) +
        (overrides.atRisk ?? 30) +
        (overrides.breached ?? 10),
      breachRatePct: null,
      byDepartment: [],
    },
    duplicate: {
      totalIncidents: 0,
      duplicateCoveragePct: null,
      countsByIncidentSize: [],
      avgReportsPerIncident: null,
      duplicateMarkedReports: 0,
    },
    verification: {
      pending: 0,
      verified: overrides.verified ?? 25,
      rejected: 0,
      total: 25,
      verificationRatePct: null,
      avgVerifyTimeMinutes: null,
    },
    escalation: {
      total: 0,
      active: 0,
      resolved: 0,
      byLevel: [],
      avgEscalationsPerIssue: null,
      escalationsResolvedPct: null,
    },
    department: { rank: [] },
    wardRisk: {
      totalAreas: 10,
      lowRiskAreas: 2,
      mediumRiskAreas: 3,
      highRiskAreas: overrides.highRiskAreas ?? 3,
      criticalRiskAreas: overrides.criticalRiskAreas ?? 1,
      totalActiveIssues: 0,
      totalSlaBreaches: 0,
      avgScore: 0,
      topAreas: [],
    },
    satisfaction: {
      confirmVotes: 0,
      supportVotes: 0,
      disputeVotes: 0,
      duplicateVotes: 0,
      totalVotes: 0,
      netSatisfactionPct: null,
      totalKarmaAwarded: 0,
    },
    ai: {
      totalAnalyses: 10,
      completed: 8,
      failed: 1,
      pending: 1,
      avgConfidence: overrides.avgConfidence ?? 0.86,
      categoryAccuracyPct: null,
    },
    anomalies: [],
    insights: [],
  };
}

test('buildIntelligence: maps all fields onto the public shape', () => {
  const out = buildIntelligence(payload(), { resolvedToday: 7, promisesTracked: 300 }, 'ts');
  const expected: LandingIntelligence = {
    liveIssues: 10,
    resolvedToday: 7,
    promisesTracked: 300,
    brokenPromises: 10,
    activeRiskZones: 4, // 3 high + 1 critical
    averageResolutionTime: 120,
    slaSuccessRatePct: 55.56, // 50 / (50+30+10) = 55.56
    verifiedResolutions: 25,
    aiConfidence: 0.86,
    resolutionRatePct: 40,
    totalIssues: 100,
    resolvedIssues: 40,
    generatedAt: 'ts',
  };
  assert.deepEqual(out, expected);
});

test('buildIntelligence: computes SLA success rate from onTrack share', () => {
  const p = payload({ onTrack: 60, atRisk: 20, breached: 20 });
  const out = buildIntelligence(p, { resolvedToday: 0, promisesTracked: 0 });
  assert.equal(out.slaSuccessRatePct, 60); // 60 / (60+20+20) = 60%
  assert.equal(out.brokenPromises, 20);
});

test('buildIntelligence: zero active promises yields null SLA rate', () => {
  const out = buildIntelligence(payload({ onTrack: 0, atRisk: 0, breached: 0 }), {
    resolvedToday: 0,
    promisesTracked: 0,
  });
  assert.equal(out.slaSuccessRatePct, null);
});

test('buildIntelligence: activeRiskZones sums high + critical only', () => {
  const out = buildIntelligence(payload({ highRiskAreas: 5, criticalRiskAreas: 0 }), {
    resolvedToday: 0,
    promisesTracked: 0,
  });
  assert.equal(out.activeRiskZones, 5);
});
