import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCivicImpact,
  impactVerdictFor,
  IMPACT_FACTOR_MAX,
} from '../scoring';

test('a clean, just-reported LOW severity issue scores low', () => {
  const r = computeCivicImpact({
    severity: 'LOW',
    reports: 1,
    populationImpact: null,
    locationCriticality: null,
    unresolvedHours: 0,
  });
  assert.equal(r.verdict, 'LOW');
  assert.ok(r.score < 35);
  // Fresh single report: barely any duration/reports, neutral population.
  assert.equal(r.factors.find((f) => f.key === 'severity')?.earned, 8);
  assert.equal(r.factors.find((f) => f.key === 'reports')?.earned, 4);
});

test('a CRITICAL severity near a school with 5 reports ranks CRITICAL', () => {
  const r = computeCivicImpact({
    severity: 'CRITICAL',
    reports: 5,
    populationImpact: 95,
    locationCriticality: 100,
    unresolvedHours: 48,
  });
  assert.equal(r.verdict, 'CRITICAL');
  assert.ok(r.score >= 75);
  assert.equal(r.verdictLabel, 'CRITICAL CIVIC PRIORITY');
  assert.equal(r.factors.find((f) => f.key === 'severity')?.earned, 30);
  assert.equal(r.factors.find((f) => f.key === 'location')?.earned, 20);
  assert.deepEqual(r.unavailable, []);
});

test('unknown severity is flagged unavailable and shown neutral, not invented', () => {
  const r = computeCivicImpact({ severity: null, reports: 1 });
  assert.ok(r.unavailable.includes('severity'));
  assert.equal(r.factors.find((f) => f.key === 'severity')?.earned, 0);
});

test('reports use a soft log so fact 6+ still nudges but never dominates', () => {
  const one = computeCivicImpact({ severity: 'MEDIUM', reports: 1 });
  const five = computeCivicImpact({ severity: 'MEDIUM', reports: 5 });
  const twenty = computeCivicImpact({ severity: 'MEDIUM', reports: 20 });
  assert.ok(five.factors.find((f) => f.key === 'reports')!.earned > one.factors.find((f) => f.key === 'reports')!.earned);
  // Soft saturation means 20 reports is close to 5 reports — never the whole story.
  assert.ok(twenty.factors.find((f) => f.key === 'reports')!.earned - five.factors.find((f) => f.key === 'reports')!.earned <= 4);
});

test('sub-scores never exceed their factor max', () => {
  const r = computeCivicImpact({
    severity: 'CRITICAL',
    reports: 999,
    populationImpact: 100,
    locationCriticality: 100,
    unresolvedHours: 10000,
  });
  for (const f of r.factors) {
    assert.ok(f.earned <= f.max, `${f.key} earned ${f.earned} > max ${f.max}`);
  }
  assert.ok(r.score <= 100);
});

test('impactVerdictFor thresholds are monotonic', () => {
  assert.equal(impactVerdictFor(100), 'CRITICAL');
  assert.equal(impactVerdictFor(75), 'CRITICAL');
  assert.equal(impactVerdictFor(74), 'HIGH');
  assert.equal(impactVerdictFor(55), 'HIGH');
  assert.equal(impactVerdictFor(54), 'MEDIUM');
  assert.equal(impactVerdictFor(35), 'MEDIUM');
  assert.equal(impactVerdictFor(34), 'LOW');
  assert.equal(impactVerdictFor(0), 'LOW');
});

test('the five canonical factors and their caps are stable', () => {
  const r = computeCivicImpact({ severity: 'HIGH', reports: 3 });
  const keys = r.factors.map((f) => f.key).sort();
  assert.deepEqual(keys, ['duration', 'location', 'population', 'reports', 'severity']);
  assert.equal(IMPACT_FACTOR_MAX.severity, 30);
  assert.equal(IMPACT_FACTOR_MAX.population, 25);
  assert.equal(IMPACT_FACTOR_MAX.location, 20);
  assert.equal(IMPACT_FACTOR_MAX.reports, 15);
  assert.equal(IMPACT_FACTOR_MAX.duration, 10);
});
