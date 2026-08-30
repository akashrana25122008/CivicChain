import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateSlaState } from '../state';
import { slaDeadlinesFor, isSeverityKey } from '../policy';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function now(ms: number): Date {
  return new Date(ms);
}

test('SLA state is ON_TRACK well before the deadline', () => {
  const createdAt = new Date(0);
  const deadline = new Date(100 * HOUR);
  const snap = calculateSlaState({
    deadline,
    createdAt,
    resolved: false,
    now: now(10 * HOUR), // 10%
  });
  assert.equal(snap.slaState, 'ON_TRACK');
  assert.ok(snap.slaPctElapsed < 20);
});

test('SLA state is AT_RISK at/after the configured threshold', () => {
  const createdAt = new Date(0);
  const deadline = new Date(100 * HOUR);
  const snap = calculateSlaState({
    deadline,
    createdAt,
    now: now(85 * HOUR), // 85%
  });
  assert.equal(snap.slaState, 'AT_RISK');
  assert.ok(snap.slaPctElapsed >= 80);
});

test('SLA state is BREACHED after the deadline passes', () => {
  const createdAt = new Date(0);
  const deadline = new Date(100 * HOUR);
  const snap = calculateSlaState({
    deadline,
    createdAt,
    now: now(101 * HOUR),
  });
  assert.equal(snap.slaState, 'BREACHED');
  assert.equal(snap.timeRemainingMs, 0);
  assert.equal(snap.slaPctElapsed, 100);
});

test('SLA state is RESOLVED when the lifecycle is resolved', () => {
  const createdAt = new Date(0);
  const deadline = new Date(100 * HOUR);
  const snap = calculateSlaState({
    deadline,
    createdAt,
    resolved: true,
    now: now(2 * HOUR),
  });
  assert.equal(snap.slaState, 'RESOLVED');
});

test('a deadline in the past / zero window is treated as BREACHED', () => {
  const createdAt = new Date(0);
  const snap = calculateSlaState({
    deadline: createdAt, // zero-length window
    createdAt,
    now: now(0),
  });
  assert.equal(snap.slaState, 'BREACHED');
});

test('SLA deadline never elapses above 100% elapsed', () => {
  const snap = calculateSlaState({
    deadline: new Date(50 * HOUR),
    createdAt: new Date(0),
    now: now(500 * HOUR),
  });
  assert.equal(snap.slaPctElapsed, 100);
  assert.equal(snap.slaState, 'BREACHED');
});

test('policy yields real, non-decreasing deadlines by severity', () => {
  const critical = slaDeadlinesFor('CRITICAL');
  const high = slaDeadlinesFor('HIGH');
  const medium = slaDeadlinesFor('MEDIUM');
  const low = slaDeadlinesFor('LOW');
  // More critical severity -> same or shorter resolution window
  // (LOW >= MEDIUM >= HIGH >= CRITICAL).
  assert.ok(low.resolutionMinutes >= medium.resolutionMinutes);
  assert.ok(medium.resolutionMinutes >= high.resolutionMinutes);
  assert.ok(high.resolutionMinutes >= critical.resolutionMinutes);
  // Every severity returns a positive, finite deadline.
  for (const d of [critical, high, medium, low]) {
    assert.ok(Number.isFinite(d.resolutionMinutes) && d.resolutionMinutes > 0);
    assert.ok(Number.isFinite(d.acknowledgementMinutes) && d.acknowledgementMinutes > 0);
  }
});

test('unknown severity falls back to a safe default', () => {
  const fallback = slaDeadlinesFor('BOGUS' as never);
  const medium = slaDeadlinesFor('MEDIUM');
  assert.equal(fallback.resolutionMinutes, medium.resolutionMinutes);
  assert.equal(isSeverityKey('BOGUS'), false);
  assert.equal(isSeverityKey('HIGH'), true);
});
