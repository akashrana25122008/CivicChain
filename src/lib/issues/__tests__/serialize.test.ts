import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  serializeIssueDetail,
  serializeIssueListRow,
  type SerializerIssue,
} from '../serialize';
import type { AuditEvent } from '../../../../generated/prisma/client';

function makeIssue(partial: Partial<SerializerIssue> = {}): SerializerIssue {
  return {
    id: 'i-1',
    publicId: 'CC-9999',
    title: 'Test pothole',
    description: null,
    category: 'POTHOLE',
    status: 'SUBMITTED',
    severity: null,
    priority: null,
    latitude: 21.1218,
    longitude: 73.7612,
    accuracy: null,
    location: 'Bus Stand Road, Navapur',
    contact: 'test contact',
    reporterId: 'u-1',
    authorityId: 'a-1',
    departmentId: null,
    incidentId: null,
    incidentMatch: null,
    priorityLevel: null,
    geoLocation: null,
    createdAt: new Date('2026-08-31T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
    ...partial,
  } as SerializerIssue;
}

function makeAuthority(
  overrides: Partial<{ name: string; department: { name: string } | null }> = {},
) {
  return {
    id: 'a-1',
    name: 'Municipal Corporation of Navapur — Water Supply Department',
    email: 'op@civicchain.dev',
    phone: null,
    jurisdiction: 'Navapur, Maharashtra',
    userId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    departmentId: null,
    department: null,
    ...overrides,
  };
}

function makeAuditEvent(
  overrides: Partial<AuditEvent> = {},
): AuditEvent {
  return {
    id: 'ae-1',
    actorId: 'u-1',
    issueId: 'i-1',
    action: 'REPORT_CREATED',
    entityType: 'Issue',
    entityId: 'i-1',
    metadata: null,
    ipAddress: null,
    seq: 1,
    prevHash: null,
    hash: 'abc',
    createdAt: new Date('2026-08-31T00:00:00.000Z'),
    ...overrides,
  } as AuditEvent;
}

test('serializeIssueListRow: authority label resolves the department relation (Phase 23)', () => {
  const row = serializeIssueListRow({
    issue: makeIssue(),
    authority: makeAuthority({ department: { name: 'Roads & Infrastructure Department' } }),
    viewerId: 'u-1',
  });
  assert.equal(row.authority, 'Roads & Infrastructure Department');
});

test('serializeIssueListRow: scalar-only authority (list feeds) falls back to authority.name', () => {
  const row = serializeIssueListRow({
    issue: makeIssue(),
    authority: makeAuthority(),
    viewerId: 'u-1',
  });
  assert.equal(row.authority, 'Municipal Corporation of Navapur — Water Supply Department');
});

test('serializeIssueListRow: unassigned issues render a null authority label', () => {
  const row = serializeIssueListRow({ issue: makeIssue(), authority: null, viewerId: 'u-1' });
  assert.equal(row.authority, null);
});

test('serializeIssueDetail: timeline derives from auditEvents, oldest first, last is current', () => {
  const detail = serializeIssueDetail({
    issue: makeIssue(),
    authority: makeAuthority({ department: { name: 'Roads & Infrastructure Department' } }),
    evidence: [],
    auditEvents: [
      makeAuditEvent({
        id: 'ae-2',
        action: 'STATUS_CHANGED',
        seq: 2,
        createdAt: new Date('2026-09-01T00:00:00.000Z'),
      }),
      makeAuditEvent({ id: 'ae-1', action: 'REPORT_CREATED', seq: 1 }),
    ],
    viewerId: 'u-1',
  });

  assert.equal(detail.timeline.length, 2);
  assert.equal(detail.timeline[0].label, 'Issue reported');
  assert.equal(detail.timeline[1].state, 'current');
  assert.equal(detail.timeline[0].state, 'completed');
});

test('serializeIssueDetail: missing audit events yields an empty timeline', () => {
  const detail = serializeIssueDetail({
    issue: makeIssue(),
    authority: null,
    evidence: [],
    auditEvents: undefined,
    viewerId: 'u-1',
  });
  assert.deepEqual(detail.timeline, []);
});

test('serializeIssueDetail: voteSummary rolls up vote types (Phase 24)', () => {
  const detail = serializeIssueDetail({
    issue: makeIssue({ votes: [
      { type: 'CONFIRM' }, { type: 'CONFIRM' },
      { type: 'SUPPORT' },
      { type: 'DISPUTE' }, { type: 'DISPUTE' }, { type: 'DISPUTE' },
      { type: 'DUPLICATE' },
    ] }),
    authority: null,
    evidence: [],
    auditEvents: [],
    viewerId: 'u-1',
  });

  assert.deepEqual(detail.voteSummary, {
    confirm: 2,
    dispute: 3,
    support: 1,
    duplicate: 1,
    total: 7,
  });
});

test('serializeIssueDetail: voteSummary defaults to zeros without votes', () => {
  const detail = serializeIssueDetail({
    issue: makeIssue(),
    authority: null,
    evidence: [],
    auditEvents: [],
    viewerId: 'u-1',
  });

  assert.deepEqual(detail.voteSummary, { confirm: 0, dispute: 0, support: 0, duplicate: 0, total: 0 });
});

test('serializeIssueDetail: canVerify only for the reporter of a RESOLVED issue (Phase 24)', () => {
  const resolved = (overrides = {}) =>
    serializeIssueDetail({
      issue: makeIssue({ reporterId: 'u-1', status: 'RESOLVED', ...overrides }),
      authority: null,
      evidence: [],
      auditEvents: [],
      viewerId: 'u-1',
    });

  assert.equal(resolved().canVerify, true);
  assert.equal(
    resolved({ reporterId: 'u-2' }).canVerify,
    false,
    'non-reporter cannot verify',
  );
  assert.equal(
    resolved({ status: 'IN_PROGRESS' }).canVerify,
    false,
    'only a RESOLVED lifecycle exposes verification',
  );
  assert.equal(
    resolved({ status: 'VERIFIED' }).canVerify,
    false,
    'already-verified lifecycle has nothing left to confirm',
  );
});