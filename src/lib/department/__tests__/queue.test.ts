import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankQueueItem, sortQueue, type QueueIssueInput } from '../queue';

const NOW = new Date('2026-08-31T12:00:00Z');

function issue(overrides: Partial<QueueIssueInput> = {}): QueueIssueInput {
  return {
    id: 'i1',
    status: 'IN_PROGRESS',
    severity: 'MEDIUM',
    priority: 50,
    escalationLevel: 0,
    riskLevel: 'LOW',
    createdAt: new Date(NOW.getTime() - 1000 * 60 * 60 * 5),
    slaDeadline: null,
    slaCreatedAt: null,
    now: NOW,
    ...overrides,
  };
}

test('rankQueueItem: SLA breach dominates the queue score', () => {
  const breached = rankQueueItem(
    issue({ slaDeadline: new Date(NOW.getTime() - 1000 * 60), slaCreatedAt: new Date(NOW.getTime() - 1000 * 60 * 60 * 24) }),
  );
  const onTrack = rankQueueItem(
    issue({ slaDeadline: new Date(NOW.getTime() + 1000 * 60 * 60 * 24 * 6), slaCreatedAt: new Date(NOW.getTime() - 1000 * 60 * 60) }),
  );
  assert.equal(breached.slaState, 'BREACHED');
  assert.ok(breached.score > onTrack.score, 'breached should outrank on track');
});

test('rankQueueItem: resolved/rejected issues rank at the floor', () => {
  const resolved = rankQueueItem(
    issue({ status: 'RESOLVED', slaDeadline: new Date(NOW.getTime() - 1000 * 60) }),
  );
  const rejected = rankQueueItem(issue({ status: 'REJECTED' }));
  const active = rankQueueItem(issue());
  assert.equal(resolved.score, 0);
  assert.equal(rejected.score, 0);
  assert.ok(active.score > 0);
});

test('rankQueueItem: critical severity + high risk + escalation outrank neutral', () => {
  const hot = rankQueueItem(
    issue({ severity: 'CRITICAL', riskLevel: 'CRITICAL', escalationLevel: 4 }),
  );
  const cool = rankQueueItem(issue({ severity: 'LOW', riskLevel: 'LOW' }));
  assert.ok(hot.score > cool.score);
});

test('rankQueueItem: a fully stacked issue reaches CRITICAL, no signal is LOW', () => {
  // Severity+risk maxed but no SLA/escalation/age pressure lands in MEDIUM.
  assert.equal(rankQueueItem(issue({ severity: 'CRITICAL', riskLevel: 'CRITICAL' })).level, 'MEDIUM');
  // Neutral everything ranks LOW.
  assert.equal(rankQueueItem(issue()).level, 'LOW');
  // Everything stacked (breached SLA too) hits the top of the scale.
  const stacked = rankQueueItem(
    issue({
      severity: 'CRITICAL',
      riskLevel: 'CRITICAL',
      escalationLevel: 4,
      createdAt: new Date(NOW.getTime() - 1000 * 60 * 60 * 24 * 20),
      slaDeadline: new Date(NOW.getTime() - 1000 * 60),
      slaCreatedAt: new Date(NOW.getTime() - 1000 * 60 * 60 * 24 * 2),
    }),
  );
  assert.ok(stacked.score >= 90);
  assert.equal(stacked.level, 'CRITICAL');
});

test('sortQueue: orders by score desc, active before closed', () => {
  const a = issue({ id: 'a', severity: 'LOW', riskLevel: 'LOW', slaDeadline: null });
  const b = issue({ id: 'b', severity: 'CRITICAL', riskLevel: 'CRITICAL', slaDeadline: new Date(NOW.getTime() - 1000 * 30) });
  const c = issue({ id: 'c', status: 'RESOLVED' });
  const sorted = sortQueue({ issues: [a, b, c], now: NOW });
  assert.deepEqual(sorted.map((s) => s.input.id), ['b', 'a', 'c']);
});

test('sortQueue: activeOnly excludes closed issues', () => {
  const a = issue({ id: 'a' });
  const c = issue({ id: 'c', status: 'RESOLVED' });
  const sorted = sortQueue({ issues: [a, c], now: NOW, activeOnly: true });
  assert.deepEqual(sorted.map((s) => s.input.id), ['a']);
});

test('sortQueue: statuses filter narrows the set', () => {
  const a = issue({ id: 'a', status: 'SUBMITTED' });
  const b = issue({ id: 'b', status: 'RESOLVED' });
  const sorted = sortQueue({ issues: [a, b], now: NOW, statuses: ['SUBMITTED'] });
  assert.deepEqual(sorted.map((s) => s.input.id), ['a']);
});
