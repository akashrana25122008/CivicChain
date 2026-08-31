import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSlaControl,
  mapEscalationItems,
  computeActionCenter,
  type SlaPromiseRow,
  type EscalationRow,
} from '../commandCenter';

const NOW = new Date('2026-08-31T12:00:00Z');

function slaRow(overrides: Partial<SlaPromiseRow> = {}): SlaPromiseRow {
  return {
    deadline: new Date(NOW.getTime() - 1000 * 60 * 60), // passed an hour ago
    issue: { createdAt: new Date(NOW.getTime() - 1000 * 60 * 60 * 48), status: 'IN_PROGRESS' },
    ...overrides,
  };
}

test('computeSlaControl: buckets on-track / at-risk / breached promises', () => {
  const rows = [
    slaRow({ deadline: new Date(NOW.getTime() - 1000 * 60 * 5) }), // breached
    slaRow({ deadline: new Date(NOW.getTime() - 1000 * 60 * 5) }), // breached
    slaRow({
      deadline: new Date(NOW.getTime() + 1000 * 60 * 60 * 24),
      issue: { createdAt: new Date(NOW.getTime() - 1000 * 60 * 60 * 96), status: 'IN_PROGRESS' }, // 96h of 120h elapsed = 80% -> at risk
    }),
    slaRow({
      deadline: new Date(NOW.getTime() + 1000 * 60 * 60 * 240),
      issue: { createdAt: new Date(NOW.getTime() - 1000 * 60 * 60 * 24), status: 'IN_PROGRESS' }, // ~10% elapsed -> on track
    }),
    slaRow({ issue: null }), // skipped entirely
  ];
  const sla = computeSlaControl(rows, NOW);
  assert.equal(sla.breached, 2);
  assert.equal(sla.atRisk, 1);
  assert.equal(sla.onTrack, 1);
  assert.equal(sla.total, 4); // null-issue row excluded
  assert.equal(sla.onTimePct, 25);
});

test('computeSlaControl: resolved issues are not counted as breached', () => {
  const rows = [
    slaRow({
      deadline: new Date(NOW.getTime() - 1000 * 60 * 60),
      issue: { createdAt: new Date(NOW.getTime() - 1000 * 60 * 60 * 24), status: 'RESOLVED' },
    }),
  ];
  const sla = computeSlaControl(rows, NOW);
  assert.equal(sla.breached, 0);
  assert.equal(sla.onTrack, 0);
  assert.equal(sla.total, 0);
  assert.equal(sla.onTimePct, null);
});

test('computeSlaControl: empty input yields no counts and null percentage', () => {
  const sla = computeSlaControl([], NOW);
  assert.deepEqual(sla, { onTrack: 0, atRisk: 0, breached: 0, total: 0, onTimePct: null });
});

function escRow(overrides: Partial<EscalationRow> = {}): EscalationRow {
  return {
    id: 'e',
    level: 1,
    status: 'OPEN',
    createdAt: new Date(NOW.getTime() - 1000 * 60 * 60 * 2),
    issue: { publicId: 'CC-9' },
    caller: { name: 'Alice' },
    authority: { department: 'Water' },
    ...overrides,
  };
}

test('mapEscalationItems: sorts by level desc then age desc and labels levels', () => {
  const items = mapEscalationItems(
    [
      escRow({ id: 'a', level: 1, createdAt: new Date(NOW.getTime() - 1000 * 60 * 60 * 4) }),
      escRow({ id: 'b', level: 3, createdAt: new Date(NOW.getTime() - 1000 * 60 * 5) }),
      escRow({ id: 'c', level: 2, createdAt: new Date(NOW.getTime() - 1000 * 60 * 60 * 20) }),
    ],
    NOW,
  );
  assert.equal(items[0].id, 'b'); // highest level first
  assert.equal(items[1].id, 'c'); // then level 2
  assert.equal(items[2].id, 'a'); // then level 1
  // Level-3 item should carry a non-empty human label.
  assert.ok(items[0].levelLabel.length > 0);
  assert.equal(items[1].ageHours, 20);
});

test('mapEscalationItems: null relations degrade gracefully', () => {
  const items = mapEscalationItems(
    [escRow({ issue: null, caller: null, authority: null })],
    NOW,
  );
  assert.equal(items[0].issuePublicId, null);
  assert.equal(items[0].issuer, null);
  assert.equal(items[0].authority, null);
});

test('computeActionCenter: passes attention buckets through', () => {
  const actions = computeActionCenter({
    breached: 3,
    openEscalations: 2,
    highRiskWards: 1,
    criticalRiskWards: 1,
    pendingVerifications: 9,
    failedAi: 4,
  });
  assert.deepEqual(actions, {
    criticalSlaBreaches: 3,
    openEscalations: 2,
    highRiskWards: 1,
    criticalRiskWards: 1,
    pendingVerifications: 9,
    failedAi: 4,
  });
});
