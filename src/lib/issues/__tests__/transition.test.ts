import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ISSUE_TRANSITIONS, nextStatuses, isValidTransition } from '../transition';
import type { IssueStatus } from '../../../../generated/prisma/client';

// Use the string values of the enum (Prisma string enums === their literal).
const S = 'SUBMITTED';
const UR = 'UNDER_REVIEW';
const V = 'VERIFIED';
const A = 'ASSIGNED';
const IP = 'IN_PROGRESS';
const RES = 'RESOLVED';
const REJ = 'REJECTED';
const ALL: IssueStatus[] = [S, UR, V, A, IP, RES, REJ] as IssueStatus[];

const as = (s: string) => s as IssueStatus;

test('valid transitions', () => {
  const valid: Array<[string, string]> = [
    [S, UR],
    [S, REJ],
    [UR, V],
    [UR, REJ],
    [V, A],
    [V, REJ],
    [V, UR],
    [A, IP],
    [A, REJ],
    [IP, RES],
    [IP, REJ],
    [RES, IP], // reopen
    [REJ, UR], // reopen rejected
  ];
  for (const [from, to] of valid) {
    assert.ok(isValidTransition(as(from), as(to)), `expected ${from} -> ${to} to be valid`);
  }
});

test('invalid transitions (arbitrary jumps blocked)', () => {
  const invalid: Array<[string, string]> = [
    [S, RES], // straight to resolved
    [S, V],
    [S, A],
    [S, IP],
    [UR, RES],
    [UR, A],
    [UR, IP],
    [V, RES], // must go through IN_PROGRESS
    [V, IP],
    [A, RES],
    [A, V],
    [IP, V], // cannot "verify" from in-progress
    [IP, A],
    [RES, S],
    [RES, UR],
    [RES, REJ],
    [REJ, RES],
    [REJ, IP],
  ];
  for (const [from, to] of invalid) {
    assert.ok(!isValidTransition(as(from), as(to)), `expected ${from} -> ${to} to be invalid`);
  }
});

test('no self-loops', () => {
  for (const from of ALL) {
    assert.ok(!isValidTransition(from, from), `expected no self loop on ${from}`);
  }
});

test('every status has an out-edge in the graph definition', () => {
  for (const from of ALL) {
    assert.ok(nextStatuses(from).length > 0, `status ${from} should have at least one transition`);
  }
});

test('every status is a fully-defined key in the transition graph', () => {
  for (const from of ALL) {
    assert.ok(from in ISSUE_TRANSITIONS, `missing graph entry for ${from}`);
  }
});

test('transitions never reference a state outside the enum', () => {
  for (const from of ALL) {
    for (const to of nextStatuses(from)) {
      assert.ok((ALL as string[]).includes(to), `${from} -> ${to} references unknown state`);
    }
  }
});

test('rejection is always available as an exit, and reopen restores the issue', () => {
  // Every active state can be rejected.
  for (const from of [S, UR, V, A, IP] as IssueStatus[]) {
    assert.ok(isValidTransition(from, as(REJ)), `expected ${from} -> REJECTED`);
  }
  // Rejected issues can be reopened back into review.
  assert.ok(isValidTransition(as(REJ), as(UR)));
  // Resolved issues reopen into in-progress.
  assert.ok(isValidTransition(as(RES), as(IP)));
});
