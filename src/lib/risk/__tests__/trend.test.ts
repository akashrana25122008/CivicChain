import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateTrend } from '../trend';

describe('calculateTrend', () => {
  it('returns STABLE when both periods are zero', () => {
    const t = calculateTrend(0, 0);
    assert.equal(t.direction, 'STABLE');
    assert.equal(t.percentage, 0);
  });

  it('returns INCREASING when current > previous', () => {
    const t = calculateTrend(120, 100);
    assert.equal(t.direction, 'INCREASING');
    assert.ok(t.percentage > 0);
  });

  it('returns DECREASING when current < previous', () => {
    const t = calculateTrend(80, 100);
    assert.equal(t.direction, 'DECREASING');
    assert.ok(t.percentage < 0);
  });

  it('returns STABLE for small changes', () => {
    const t = calculateTrend(103, 100);
    assert.equal(t.direction, 'STABLE');
  });

  it('returns INCREASING when previous is 0 and current > 0', () => {
    const t = calculateTrend(5, 0);
    assert.equal(t.direction, 'INCREASING');
    assert.equal(t.percentage, 100);
  });

  it('calculates correct percentage', () => {
    const t = calculateTrend(150, 100);
    assert.equal(t.percentage, 50);
  });

  it('handles large decreases', () => {
    const t = calculateTrend(10, 100);
    assert.equal(t.direction, 'DECREASING');
    assert.equal(t.percentage, -90);
  });

  it('includes raw values', () => {
    const t = calculateTrend(75, 50);
    assert.equal(t.current, 75);
    assert.equal(t.previous, 50);
  });
});
