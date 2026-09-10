import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDepartmentWardRisks, civicImpactOf, type CommandIssueRow } from '../commandCenter';

type Row = CommandIssueRow;

const NOW = new Date('2026-08-31T12:00:00Z');

function row(overrides: Partial<Row> = {}): Row {
  return {
    id: 'i',
    publicId: 'CC-1',
    title: 'test',
    category: 'POTHOLE',
    status: 'IN_PROGRESS',
    severity: 'MEDIUM',
    priority: 50,
    priorityLevel: 'MEDIUM',
    latitude: 21.17,
    longitude: 72.83,
    location: 'Ward 12, near market',
    createdAt: new Date(NOW.getTime() - 1000 * 60 * 60 * 24),
    updatedAt: NOW,
    promise: null,
    incident: null,
    ...overrides,
  };
}

test('computeDepartmentWardRisks: groups by ward and produces a ranked risk level', () => {
  const issues = [
    row({ id: 'a', severity: 'CRITICAL', location: 'Ward 5, main road' }),
    row({ id: 'b', severity: 'HIGH', location: 'Ward 5, market' }),
    row({ id: 'c', severity: 'LOW', location: 'Ward 9, park' }),
  ];
  const result = computeDepartmentWardRisks(issues, NOW);
  assert.equal(result.length, 2);
  assert.equal(result[0].ward, 'Ward 5');
  // Ward 5 with CRITICAL+HIGH outranks Ward 9 with only LOW.
  assert.ok(result[0].riskScore >= result[1].riskScore);
  assert.equal(result[0].riskLevel, 'MEDIUM');
  assert.equal(result[1].riskLevel, 'LOW');
});

test('computeDepartmentWardRisks: no SLA breach in a fast-resolving ward keeps risk lower', () => {
  const now = NOW;
  const a = row({
    id: 'a',
    severity: 'MEDIUM',
    location: 'Ward 3',
    createdAt: new Date(now.getTime() - 1000 * 60 * 30),
  });
  const loneLow = computeDepartmentWardRisks([a], now);
  // ~30 min old medium issue, no SLA → low-ish risk.
  assert.ok(loneLow[0].riskScore < 50);
});

test('civicImpactOf: severity drives a higher impact score (real factor contribution)', () => {
  const critical = civicImpactOf(row({ id: 'a', severity: 'CRITICAL', incident: { issues: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] } }), NOW);
  const low = civicImpactOf(row({ id: 'b', severity: 'LOW', incident: { issues: [{ id: 'b' }] } }), NOW);
  assert.ok(critical.score != null, 'critical should have a score');
  assert.ok(low.score != null, 'low should have a score');
  // Same age, same missing population/location signals → severity dominates.
  assert.ok(critical.score > low.score, `expected critical (${critical.score}) > low (${low.score})`);
  assert.equal(critical.level, 'MEDIUM');
});

test('civicImpactOf: an issue with no severity yields no score (not invented)', () => {
  const issue = row({ id: 'a', severity: null });
  const { score, level } = civicImpactOf(issue, NOW);
  assert.equal(score, null);
  assert.equal(level, null);
});