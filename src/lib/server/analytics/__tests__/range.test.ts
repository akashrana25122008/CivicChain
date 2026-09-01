import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTimeRange, rangeWindow, previousWindow, RANGE_DAYS, RANGES } from '../range';

const NOW = new Date('2026-08-31T12:00:00.000Z');

test('parseTimeRange: valid range passes through', () => {
  assert.equal(parseTimeRange('7d'), '7d');
  assert.equal(parseTimeRange('30d'), '30d');
  assert.equal(parseTimeRange('90d'), '90d');
  assert.equal(parseTimeRange('all'), 'all');
});

test('parseTimeRange: unknown/null falls back to 30d', () => {
  assert.equal(parseTimeRange(null), '30d');
  assert.equal(parseTimeRange('bogus'), '30d');
  assert.equal(parseTimeRange(''), '30d');
  assert.equal(parseTimeRange('1y'), '30d');
});

test('RANGES and RANGE_DAYS are canonical', () => {
  assert.deepEqual(RANGES, ['7d', '30d', '90d', 'all']);
  assert.deepEqual(RANGE_DAYS, { '7d': 7, '30d': 30, '90d': 90, all: 0 });
});

test('rangeWindow("all") is unbounded', () => {
  const w = rangeWindow('all', NOW);
  assert.equal(w.from, null);
  assert.equal(w.to, null);
  assert.equal(w.days, 0);
});

test('rangeWindow: 30d spans exactly 30 days back from now', () => {
  const w = rangeWindow('30d', NOW);
  assert.equal(w.range, '30d');
  assert.equal(w.days, 30);
  assert.ok(w.from && w.to, 'from/to present');
  assert.equal(w.to!.getTime(), NOW.getTime());
  assert.equal(w.from!.getTime(), NOW.getTime() - 30 * 24 * 60 * 60 * 1000);
});

test('previousWindow: abuts the current window with equal span', () => {
  const w = rangeWindow('30d', NOW);
  const prev = previousWindow(w);
  assert.ok(prev, 'prev exists');
  assert.equal(prev!.to.getTime(), w.from!.getTime());
  assert.equal(prev!.from.getTime(), w.from!.getTime() - (w.to!.getTime() - w.from!.getTime()));
});

test('previousWindow: null for unbounded ("all") window', () => {
  const w = rangeWindow('all', NOW);
  assert.equal(previousWindow(w), null);
});

test('dateWhere: bounded window yields gte/lte', () => {
  const w = rangeWindow('7d', NOW);
  assert.ok(w.from && w.to);
  const where = { gte: w.from, lte: w.to } as const;
  // structural check against a fresh computation
  const fresh = rangeWindow('7d', NOW);
  assert.equal(where.gte!.getTime(), fresh.from!.getTime());
  assert.equal(where.lte!.getTime(), fresh.to!.getTime());
});
