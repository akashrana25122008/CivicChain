import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalLedgerJson,
  computeLedgerHash,
  verifyLedgerChain,
  type LedgerRow,
} from '../../ledger/hashchain';

function row(partial: Partial<LedgerRow>): LedgerRow {
  return {
    seq: 1,
    prevHash: null,
    hash: '',
    createdAt: new Date('2026-08-31T00:00:00.000Z'),
    action: 'REPORT_CREATED',
    entityType: 'Issue',
    entityId: 'cc-1',
    ...partial,
  };
}

test('canonicalLedgerJson: fixed shape, no spaces, sorted-property order', () => {
  const out = canonicalLedgerJson({
    createdAt: new Date('2026-08-31T00:00:00.000Z'),
    action: 'REPORT_CREATED',
    entityType: 'Issue',
    entityId: 'cc-1',
    prevHash: null,
  });
  assert.equal(
    out,
    '{"createdAt":1788134400000,"action":"REPORT_CREATED","entityType":"Issue","entityId":"cc-1","prevHash":null}',
  );
});

test('canonicalLedgerJson: createdAt is integer epoch milliseconds', () => {
  const a = canonicalLedgerJson({ createdAt: new Date('2026-08-31T00:00:00.000Z'), action: 'X', entityType: 'Y' });
  const b = canonicalLedgerJson({ createdAt: '2026-08-31T00:00:00.000Z', action: 'X', entityType: 'Y' });
  const c = canonicalLedgerJson({ createdAt: 1788134400000, action: 'X', entityType: 'Y' });
  assert.equal(a, b);
  assert.equal(a, c);
});

test('computeLedgerHash: deterministic and length-stable (64 hex)', () => {
  const h1 = computeLedgerHash({ createdAt: new Date('2026-08-31T00:00:00.000Z'), action: 'REPORT_CREATED', entityType: 'Issue' });
  const h2 = computeLedgerHash({ createdAt: new Date('2026-08-31T00:00:00.000Z'), action: 'REPORT_CREATED', entityType: 'Issue' });
  assert.equal(h1, h2);
  assert.match(h1, /^[0-9a-f]{64}$/);
});

test('computeLedgerHash: embedding prevHash changes the fingerprint', () => {
  const base = { createdAt: new Date('2026-08-31T00:00:00.000Z'), action: 'STATUS_CHANGED', entityType: 'Issue' };
  const withPrev = computeLedgerHash({ ...base, prevHash: 'abc123' });
  const withoutPrev = computeLedgerHash({ ...base, prevHash: null });
  assert.notEqual(withPrev, withoutPrev);
});

test('verifyLedgerChain: a valid 3-row chain passes', () => {
  const t0 = new Date('2026-08-31T00:00:00.000Z');
  const r1 = row({ seq: 1, createdAt: t0, hash: 'g1' });
  r1.hash = computeLedgerHash({ createdAt: t0, action: r1.action, entityType: r1.entityType, entityId: r1.entityId, prevHash: null });

  const t1 = new Date(t0.getTime() + 1000);
  const r2 = row({ seq: 2, prevHash: r1.hash, hash: '', createdAt: t1 });
  r2.hash = computeLedgerHash({ createdAt: t1, action: r2.action, entityType: r2.entityType, entityId: r2.entityId, prevHash: r1.hash });

  const t2 = new Date(t0.getTime() + 2000);
  const r3 = row({ seq: 3, prevHash: r2.hash, hash: '', createdAt: t2 });
  r3.hash = computeLedgerHash({ createdAt: t2, action: r3.action, entityType: r3.entityType, entityId: r3.entityId, prevHash: r2.hash });

  const v = verifyLedgerChain([r1, r2, r3]);
  assert.equal(v.valid, true);
  assert.equal(v.tampered, 0);
  assert.equal(v.brokenLinks, 0);
  assert.equal(v.gaps, 0);
  assert.equal(v.genesisOk, true);
  assert.equal(v.firstInvalidSeq, null);
});

test('verifyLedgerChain: mutating an earlier record breaks the chain', () => {
  const t0 = new Date('2026-08-31T00:00:00.000Z');
  const r1 = row({ seq: 1, createdAt: t0, hash: '' });
  r1.hash = computeLedgerHash({ createdAt: t0, action: r1.action, entityType: r1.entityType, entityId: r1.entityId, prevHash: null });

  const t1 = new Date(t0.getTime() + 1000);
  const r2 = row({ seq: 2, prevHash: r1.hash, hash: '', createdAt: t1 });
  r2.hash = computeLedgerHash({ createdAt: t1, action: r2.action, entityType: r2.entityType, entityId: r2.entityId, prevHash: r1.hash });

  // Tamper with record 1's identity WITHOUT updating its stored hash.
  r1.entityId = 'cc-tampered';
  const v = verifyLedgerChain([r1, r2]);
  assert.equal(v.valid, false);
  assert.equal(v.tampered, 1); // r1 hash no longer matches its (edited) fields
  // Downstream links are still intact because r1's *stored* hash was untouched.
  assert.equal(v.brokenLinks, 0);
  assert.equal(v.firstInvalidSeq, 1);
});

test('verifyLedgerChain: rewriting a stored hash breaks the downstream link', () => {
  const t0 = new Date('2026-08-31T00:00:00.000Z');
  const r1 = row({ seq: 1, createdAt: t0, hash: '' });
  r1.hash = computeLedgerHash({ createdAt: t0, action: r1.action, entityType: r1.entityType, entityId: r1.entityId, prevHash: null });

  const t1 = new Date(t0.getTime() + 1000);
  const r2 = row({ seq: 2, prevHash: r1.hash, hash: '', createdAt: t1 });
  r2.hash = computeLedgerHash({ createdAt: t1, action: r2.action, entityType: r2.entityType, entityId: r2.entityId, prevHash: r1.hash });

  // An attacker edits r1's hash to a forgery.
  r1.hash = 'forged-hash';
  const v = verifyLedgerChain([r1, r2]);
  assert.equal(v.valid, false);
  assert.equal(v.tampered, 1); // forged r1.hash fails recompute
  assert.equal(v.brokenLinks, 1); // r2.prevHash no longer equals the forged r1.hash
  assert.equal(v.firstInvalidSeq, 1);
});

test('verifyLedgerChain: genesis must have a null prevHash', () => {
  const t0 = new Date('2026-08-31T00:00:00.000Z');
  const bad = row({ seq: 1, prevHash: 'not-null', createdAt: t0, hash: '' });
  bad.hash = computeLedgerHash({ createdAt: t0, action: bad.action, entityType: bad.entityType, entityId: bad.entityId, prevHash: 'not-null' });
  const v = verifyLedgerChain([bad]);
  assert.equal(v.valid, false);
  assert.equal(v.genesisOk, false);
});

test('verifyLedgerChain: sequence gap is reported', () => {
  const t0 = new Date('2026-08-31T00:00:00.000Z');
  const r1 = row({ seq: 1, createdAt: t0, hash: '' });
  r1.hash = computeLedgerHash({ createdAt: t0, action: r1.action, entityType: r1.entityType, entityId: r1.entityId, prevHash: null });
  const t1 = new Date(t0.getTime() + 1000);
  // r3 skips seq 2.
  const r3 = row({ seq: 3, prevHash: r1.hash, hash: '', createdAt: t1 });
  r3.hash = computeLedgerHash({ createdAt: t1, action: r3.action, entityType: r3.entityType, entityId: r3.entityId, prevHash: r1.hash });
  const v = verifyLedgerChain([r1, r3]);
  assert.equal(v.gaps, 1);
  assert.equal(v.brokenLinks, 0);
  assert.equal(v.tampered, 0);
});

test('verifyLedgerChain: empty input is valid by convention', () => {
  const v = verifyLedgerChain([]);
  assert.equal(v.valid, true);
  assert.equal(v.count, 0);
});
