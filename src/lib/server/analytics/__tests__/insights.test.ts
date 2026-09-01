import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectAnomalies, buildInsights } from '../insights';
import type {
  IssueMetric,
  ResolutionMetric,
  SlaMetric,
  WardRiskMetric,
  VerificationMetric,
  EscalationMetric,
  AiMetric,
} from '../types';

function issueMetric(over: Partial<IssueMetric> = {}): IssueMetric {
  return {
    total: 100,
    active: 40,
    resolved: 50,
    rejected: 10,
    byStatus: [],
    byCategory: [],
    byDepartment: [],
    overTime: [],
    trend: { current: 100, previous: 100, percentage: 0, direction: 'STABLE' },
    ...over,
  };
}

function resolutionMetric(over: Partial<ResolutionMetric> = {}): ResolutionMetric {
  return {
    resolutionRatePct: 50,
    avgResolutionMinutes: 480,
    resolvedCount: 50,
    avgFirstResponseMinutes: 120,
    reopenCount: 2,
    reopenRatePct: 4,
    trend: null,
    ...over,
  };
}

function slaMetric(over: Partial<SlaMetric> = {}): SlaMetric {
  return {
    onTrack: 10,
    atRisk: 5,
    breached: 3,
    activePromises: 18,
    breachRatePct: 16.67,
    byDepartment: [],
    ...over,
  };
}

function wardRiskMetric(over: Partial<WardRiskMetric> = {}): WardRiskMetric {
  return {
    totalAreas: 10,
    lowRiskAreas: 5,
    mediumRiskAreas: 3,
    highRiskAreas: 1,
    criticalRiskAreas: 1,
    totalActiveIssues: 40,
    totalSlaBreaches: 5,
    avgScore: 45,
    topAreas: [],
    ...over,
  };
}

function verificationMetric(over: Partial<VerificationMetric> = {}): VerificationMetric {
  return {
    pending: 4,
    verified: 8,
    rejected: 2,
    total: 14,
    verificationRatePct: 57.14,
    avgVerifyTimeMinutes: 600,
    ...over,
  };
}

function escalationMetric(over: Partial<EscalationMetric> = {}): EscalationMetric {
  return {
    total: 10,
    active: 8,
    resolved: 2,
    byLevel: [],
    avgEscalationsPerIssue: 3,
    escalationsResolvedPct: 20,
    ...over,
  };
}

function aiMetric(over: Partial<AiMetric> = {}): AiMetric {
  return {
    totalAnalyses: 10,
    completed: 9,
    failed: 1,
    pending: 0,
    avgConfidence: 0.82,
    categoryAccuracyPct: 66.67,
    ...over,
  };
}

test('detectAnomalies: flags a volume surge above swing threshold', () => {
  const issues = issueMetric({ trend: { current: 150, previous: 100, percentage: 50, direction: 'INCREASING' } });
  const out = detectAnomalies(issues, resolutionMetric(), slaMetric(), verificationMetric(), escalationMetric(), aiMetric());
  assert.ok(out.some((a) => a.key === 'issue_volume_surge' && a.severity === 'HIGH'));
});

test('detectAnomalies: flags volume drop below negative swing', () => {
  const issues = issueMetric({ trend: { current: 60, previous: 100, percentage: -40, direction: 'DECREASING' } });
  const out = detectAnomalies(issues, resolutionMetric(), slaMetric(), verificationMetric(), escalationMetric(), aiMetric());
  assert.ok(out.some((a) => a.key === 'issue_volume_drop'));
});

test('detectAnomalies: flags high SLA breach rate', () => {
  const sla = slaMetric({ breachRatePct: 60, breached: 12, activePromises: 20 });
  const out = detectAnomalies(issueMetric(), resolutionMetric(), sla, verificationMetric(), escalationMetric(), aiMetric());
  assert.ok(out.some((a) => a.key === 'sla_breach_high' && a.severity === 'HIGH'));
});

test('detectAnomalies: no SLA anomaly when breach rate is low', () => {
  const sla = slaMetric({ breachRatePct: 10 });
  const out = detectAnomalies(issueMetric(), resolutionMetric(), sla, verificationMetric(), escalationMetric(), aiMetric());
  assert.ok(!out.some((a) => a.key === 'sla_breach_high'));
});

test('detectAnomalies: flags escalation backlog when resolution < 20%', () => {
  const esc = escalationMetric({ escalationsResolvedPct: 10 });
  const out = detectAnomalies(issueMetric(), resolutionMetric(), slaMetric(), verificationMetric(), esc, aiMetric());
  assert.ok(out.some((a) => a.key === 'escalation_backlog'));
});

test('detectAnomalies: flags AI failure rate above 30%', () => {
  const ai = aiMetric({ totalAnalyses: 10, failed: 4, completed: 6 });
  const out = detectAnomalies(issueMetric(), resolutionMetric(), slaMetric(), verificationMetric(), escalationMetric(), ai);
  assert.ok(out.some((a) => a.key === 'ai_failure_rate'));
});

test('detectAnomalies: returns empty for healthy metrics', () => {
  const out = detectAnomalies(issueMetric(), resolutionMetric(), slaMetric(), verificationMetric(), escalationMetric(), aiMetric());
  assert.equal(out.length, 0);
});

test('buildInsights: positive tone for high resolution rate', () => {
  const res = resolutionMetric({ resolutionRatePct: 80 });
  const out = buildInsights(issueMetric(), res, slaMetric(), wardRiskMetric(), verificationMetric(), escalationMetric(), aiMetric());
  const resInsight = out.find((i) => i.id === 'resolution_rate');
  assert.ok(resInsight, 'resolution insight present');
  assert.equal(resInsight!.tone, 'positive');
});

test('buildInsights: negative tone for low resolution rate', () => {
  const res = resolutionMetric({ resolutionRatePct: 20 });
  const out = buildInsights(issueMetric(), res, slaMetric(), wardRiskMetric(), verificationMetric(), escalationMetric(), aiMetric());
  const resInsight = out.find((i) => i.id === 'resolution_rate');
  assert.ok(resInsight);
  assert.equal(resInsight!.tone, 'negative');
});

test('buildInsights: ward insight appears when high/critical areas exist', () => {
  const ward = wardRiskMetric({ highRiskAreas: 2, criticalRiskAreas: 1, totalAreas: 8 });
  const out = buildInsights(issueMetric(), resolutionMetric(), slaMetric(), ward, verificationMetric(), escalationMetric(), aiMetric());
  assert.ok(out.some((i) => i.id === 'ward_risk' && i.tone === 'negative'));
});

test('buildInsights: AI accuracy insight reflects >=70% threshold', () => {
  const good = aiMetric({ categoryAccuracyPct: 85 });
  const outGood = buildInsights(issueMetric(), resolutionMetric(), slaMetric(), wardRiskMetric(), verificationMetric(), escalationMetric(), good);
  assert.equal(outGood.find((i) => i.id === 'ai_accuracy')?.tone, 'positive');

  const poor = aiMetric({ categoryAccuracyPct: 40 });
  const outPoor = buildInsights(issueMetric(), resolutionMetric(), slaMetric(), wardRiskMetric(), verificationMetric(), escalationMetric(), poor);
  assert.equal(outPoor.find((i) => i.id === 'ai_accuracy')?.tone, 'negative');
});

test('buildInsights: issue trend insight reflects direction', () => {
  const inc = issueMetric({ trend: { current: 150, previous: 100, percentage: 50, direction: 'INCREASING' } });
  const out = buildInsights(inc, resolutionMetric(), slaMetric(), wardRiskMetric(), verificationMetric(), escalationMetric(), aiMetric());
  const insight = out.find((i) => i.id === 'issue_trend');
  assert.ok(insight);
  assert.equal(insight!.tone, 'negative');
});
