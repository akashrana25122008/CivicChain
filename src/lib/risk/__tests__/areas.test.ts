/**
 * Phase 11 — Risk intelligence: pure mapping + explanation tests.
 *
 * These exercise the deterministic pieces of the risk engine and the
 * aggregations that feed the API layer, WITHOUT a database connection.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toHotspot, categoryBreakdownFromIssues } from '../areas';
import { generateRiskExplanation, computeAreaRisk } from '../scoring';
import type { WardRiskSummary } from '../types';
import type { AreaRiskInput } from '../scoring';

function makeWard(overrides: Partial<WardRiskSummary> = {}): WardRiskSummary {
  return {
    wardId: 'ward-1',
    wardName: 'Ward 1',
    latitude: 27.49,
    longitude: 78.03,
    riskScore: 72,
    riskLevel: 'HIGH',
    activeIncidents: 6,
    criticalIssues: 2,
    totalIncidents: 9,
    repeatIssues: 3,
    slaBreaches: 2,
    slaAtRisk: 1,
    avgUnresolvedHours: 96,
    confirmVotes: 5,
    totalVotes: 9,
    averageResolutionTime: 12.5,
    topCategory: 'POTHOLE',
    trend: { direction: 'INCREASING', percentage: 40 },
    factors: [],
    explanation: 'Ward 1 is classified as HIGH (score 72/100).',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// toHotspot — hotspot mapping must carry REAL aggregate values.
// ---------------------------------------------------------------------------

describe('toHotspot', () => {
  it('preserves the real computed aggregate values (no fake zeros)', () => {
    const ward = makeWard();
    const hotspot = toHotspot(ward);

    assert.equal(hotspot.avgUnresolvedHours, 96);
    assert.equal(hotspot.confirmVotes, 5);
    assert.equal(hotspot.activeIncidents, 6);
    assert.equal(hotspot.slaBreaches, 2);
    assert.equal(hotspot.dominantCategory, 'POTHOLE');
    assert.equal(hotspot.explanation, ward.explanation);
  });

  it('mirrors the ward trend and coordinates', () => {
    const hotspot = toHotspot(makeWard());
    assert.deepEqual(hotspot.trend, { direction: 'INCREASING', percentage: 40 });
    assert.equal(hotspot.latitude, 27.49);
    assert.equal(hotspot.longitude, 78.03);
  });

  it('propagates the correct hotspot/level identity', () => {
    const hotspot = toHotspot(makeWard({ wardId: 'ward-x', wardName: 'Zone 3', riskLevel: 'CRITICAL' }));
    assert.equal(hotspot.hotspotId, 'ward-x');
    assert.equal(hotspot.areaName, 'Zone 3');
    assert.equal(hotspot.riskLevel, 'CRITICAL');
  });
});

// ---------------------------------------------------------------------------
// categoryBreakdownFromIssues — pure aggregation used by ward detail.
// ---------------------------------------------------------------------------

describe('categoryBreakdownFromIssues', () => {
  it('tallies issues per category and sorts by count descending', () => {
    const issues = [
      { category: 'POTHOLE' },
      { category: 'GARBAGE' },
      { category: 'POTHOLE' },
      { category: 'WATER' },
    ];
    assert.deepEqual(categoryBreakdownFromIssues(issues), [
      { category: 'POTHOLE', count: 2 },
      { category: 'GARBAGE', count: 1 },
      { category: 'WATER', count: 1 },
    ]);
  });

  it('returns an empty list for no issues', () => {
    assert.deepEqual(categoryBreakdownFromIssues([]), []);
  });
});

// ---------------------------------------------------------------------------
// generateRiskExplanation — human-readable, DB-derived reasoning.
// ---------------------------------------------------------------------------

describe('generateRiskExplanation', () => {
  const input: AreaRiskInput = {
    severityScore: 50,
    issueCount: 6,
    repeatCount: 3,
    slaBreaches: 2,
    slaAtRisk: 1,
    activeCount: 6,
    avgUnresolvedHours: 96,
    confirmVotes: 5,
    totalVotes: 9,
    populationExposure: null,
  };

  it('states the classification, count, repeats, SLA, and driver', () => {
    const result = computeAreaRisk(input);
    const explanation = generateRiskExplanation('Ward 1', result, input);

    assert.match(explanation, /Ward 1 is classified as/);
    assert.match(explanation, /6 active incidents/);
    assert.match(explanation, /3 repeat incidents/);
    assert.match(explanation, /2 SLA breaches/);
    assert.match(explanation, /Average unresolved duration/);
    assert.match(explanation, /Primary driver/);
  });

  it('notes genuinely unavailable data instead of inventing it', () => {
    const result = computeAreaRisk(input);
    const explanation = generateRiskExplanation('Ward 1', result, input);
    // population-exposure is absent in the local engine — must be flagged,
    // never fabricated.
    assert.match(explanation, /population-exposure data unavailable/);
  });
});