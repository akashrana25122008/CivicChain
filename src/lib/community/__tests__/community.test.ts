import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isVoteType, VOTE_TYPES } from '../votes';
import { KARMA_POINTS, buildDedupeKey } from '../karma';

test('vote type validation accepts only the four canonical types', () => {
  for (const t of VOTE_TYPES) assert.equal(isVoteType(t), true);
  assert.equal(isVoteType('CONFIRM'), true);
  assert.equal(isVoteType('PIZZA'), false);
  assert.equal(isVoteType(null), false);
  assert.equal(isVoteType(undefined), false);
  assert.equal(isVoteType(123), false);
});

test('karma point table has every event type with a defined value', () => {
  assert.equal(KARMA_POINTS.REPORT_VERIFIED, 20);
  assert.equal(KARMA_POINTS.EVIDENCE_VERIFIED, 15);
  assert.equal(KARMA_POINTS.HELPFUL_CONFIRMATION, 10);
  assert.equal(KARMA_POINTS.VALID_DUPLICATE, 8);
  assert.equal(KARMA_POINTS.FALSE_REPORT, -20);
  assert.equal(KARMA_POINTS.ABUSIVE_VOTE, -25);
});

test('dedupe key is deterministic and names its true source', () => {
  const a = buildDedupeKey('REPORT_VERIFIED', 'issue-1', 'user-1');
  const b = buildDedupeKey('REPORT_VERIFIED', 'issue-1', 'user-1');
  const c = buildDedupeKey('HELPFUL_CONFIRMATION', 'issue-1', 'user-1');
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.ok(a.includes('REPORT_VERIFIED'));
});
