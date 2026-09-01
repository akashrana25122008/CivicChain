import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasRole,
  isAdmin,
  isAuthority,
  roleRank,
  canReadIssue,
  canMutateIssue,
  canEnterAdmin,
  canEnterDepartment,
  authorityOwnsIssue,
  type Role,
  type IssueScope,
} from '../accessControl';

const ALICE = 'user-alice';
const BOB = 'user-bob';
const DEPT_A = 'dept-a';
const DEPT_B = 'dept-b';

test('RBAC: role hierarchy ranks CITIZEN < AUTHORITY < ADMIN', () => {
  assert.ok(roleRank('CITIZEN') < roleRank('AUTHORITY'));
  assert.ok(roleRank('AUTHORITY') < roleRank('ADMIN'));
});

test('RBAC: hasRole matches own level and below, never above', () => {
  assert.equal(hasRole('ADMIN', 'ADMIN'), true);
  assert.equal(hasRole('ADMIN', 'AUTHORITY'), true);
  assert.equal(hasRole('ADMIN', 'CITIZEN'), true);
  assert.equal(hasRole('AUTHORITY', 'AUTHORITY'), true);
  assert.equal(hasRole('AUTHORITY', 'ADMIN'), false);
  assert.equal(hasRole('CITIZEN', 'CITIZEN'), true);
  assert.equal(hasRole('CITIZEN', 'AUTHORITY'), false);
  assert.equal(hasRole('CITIZEN', 'ADMIN'), false);
});

test('RBAC: surface gates are exclusive and deny below-required roles', () => {
  assert.equal(canEnterAdmin('ADMIN'), true);
  assert.equal(canEnterAdmin('AUTHORITY'), false);
  assert.equal(canEnterAdmin('CITIZEN'), false);
  assert.equal(canEnterDepartment('ADMIN'), true);
  assert.equal(canEnterDepartment('AUTHORITY'), true);
  assert.equal(canEnterDepartment('CITIZEN'), false);
});

test('RBAC: citizen reads own report', () => {
  assert.equal(canReadIssue('CITIZEN', ALICE, { reporterId: ALICE, authorityId: null }), true);
});

test('RBAC: citizen CANNOT read another citizen report (IDOR)', () => {
  assert.equal(canReadIssue('CITIZEN', ALICE, { reporterId: BOB, authorityId: null }), false);
  assert.equal(canReadIssue('CITIZEN', BOB, { reporterId: BOB, authorityId: null }), true);
});

test('RBAC: authority reads only reports assigned to their dept', () => {
  const assignedToMe: IssueScope = { reporterId: BOB, authorityId: DEPT_A };
  const assignedElsewhere: IssueScope = { reporterId: BOB, authorityId: DEPT_B };
  assert.equal(canReadIssue('AUTHORITY', DEPT_A, assignedToMe), true);
  assert.equal(canReadIssue('AUTHORITY', DEPT_A, assignedElsewhere), false);
});

test('RBAC: authority cannot read via reporter id alone (no cross-dept reach)', () => {
  const foreign: IssueScope = { reporterId: BOB, authorityId: DEPT_B };
  assert.equal(canReadIssue('AUTHORITY', DEPT_A, foreign), false);
});

test('RBAC: admin reads anything', () => {
  const other: IssueScope = { reporterId: BOB, authorityId: null };
  const elsewhere: IssueScope = { reporterId: BOB, authorityId: DEPT_B };
  assert.equal(canReadIssue('ADMIN', 'any-admin', other), true);
  assert.equal(canReadIssue('ADMIN', 'any-admin', elsewhere), true);
});

test('RBAC: unrelated intruder is denied regardless of guessed ids', () => {
  const target: IssueScope = { reporterId: BOB, authorityId: DEPT_A };
  assert.equal(canReadIssue('CITIZEN', 'intruder', target), false);
});

test('RBAC: canMutateIssue independently enforces write-path IDOR', () => {
  assert.equal(canMutateIssue('CITIZEN', ALICE, { reporterId: ALICE }), true);
  assert.equal(canMutateIssue('CITIZEN', ALICE, { reporterId: BOB }), false);
  assert.equal(canMutateIssue('AUTHORITY', DEPT_A, { reporterId: BOB, authorityId: DEPT_A }), true);
  assert.equal(canMutateIssue('AUTHORITY', DEPT_A, { reporterId: BOB, authorityId: DEPT_B }), false);
  assert.equal(canMutateIssue('ADMIN', 'adm', { reporterId: BOB }), true);
});

test('RBAC: authorityOwnsIssue blocks cross-department escalation', () => {
  assert.equal(authorityOwnsIssue('AUTHORITY', DEPT_A, { authorityId: DEPT_A }), true);
  assert.equal(authorityOwnsIssue('AUTHORITY', DEPT_A, { authorityId: DEPT_B }), false);
});

test('RBAC: authority with no resolved dept cannot act', () => {
  assert.equal(authorityOwnsIssue('AUTHORITY', null, { authorityId: DEPT_A }), false);
  assert.equal(authorityOwnsIssue('AUTHORITY', undefined, { authorityId: DEPT_A }), false);
});

test('RBAC: foreign authorityId cannot be supplied to escalate', () => {
  assert.equal(authorityOwnsIssue('AUTHORITY', DEPT_A, { authorityId: 'dept-victim' }), false);
});

test('RBAC: admin bypasses ownership; citizen never passes with an authority id', () => {
  assert.equal(authorityOwnsIssue('ADMIN', null, { authorityId: DEPT_B }), true);
  assert.equal(authorityOwnsIssue('CITIZEN', DEPT_A, { authorityId: DEPT_A }), false);
});

test('RBAC: helper predicates classify roles correctly', () => {
  assert.equal(isAdmin('ADMIN'), true);
  assert.equal(isAdmin('AUTHORITY'), false);
  assert.equal(isAuthority('AUTHORITY'), true);
  assert.equal(isAuthority('ADMIN'), false);
  assert.equal(isAuthority('CITIZEN'), false);
});

test('RBAC: roleRank is total over the Role union', () => {
  const roles: Role[] = ['CITIZEN', 'AUTHORITY', 'ADMIN'];
  for (const r of roles) assert.equal(Number.isFinite(roleRank(r)), true);
});
