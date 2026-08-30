import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRule, type RuleSnapshot } from '../rules';
import { nextEscalationLevel, escalationLevelLabel } from '../levels';

const baseSnapshot = (over: Partial<RuleSnapshot> = {}): RuleSnapshot => ({
  status: 'IN_PROGRESS',
  severity: 'HIGH',
  priority: 80,
  level: 0,
  slaPct: 60,
  ...over,
});

function rule(over: Record<string, unknown> = {}) {
  return {
    enabled: true,
    fromLevel: 0,
    minSeverity: null as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null,
    minPriority: null as number | null,
    conditions: null,
    ...over,
  };
}

test('rule disabled never fires', () => {
  assert.equal(evaluateRule(rule({ enabled: false, conditions: { slaPctGte: 60 } }), baseSnapshot()).matches, false);
});

test('severity below threshold does not fire', () => {
  const fast = baseSnapshot({ severity: 'MEDIUM' });
  assert.equal(evaluateRule(rule({ minSeverity: 'HIGH' }), fast).matches, false);
});

test('SLA 79% does not fire an 80% gate; 81% does', () => {
  const cond = { slaPctGte: 80, statusNotIn: ['RESOLVED', 'REJECTED'] };
  assert.equal(evaluateRule(rule({ conditions: cond }), baseSnapshot({ slaPct: 79 })).matches, false);
  assert.equal(evaluateRule(rule({ conditions: cond }), baseSnapshot({ slaPct: 84 })).matches, true);
});

test('SLA 81% + HIGH escalates (matches rule)', () => {
  const cond = { slaPctGte: 80, statusNotIn: ['RESOLVED', 'REJECTED'] };
  assert.equal(
    evaluateRule(rule({ minSeverity: 'HIGH', conditions: cond }), baseSnapshot({ slaPct: 84, severity: 'HIGH' })).matches,
    true,
  );
});

test('no SLA available never fires an SLA gate', () => {
  assert.equal(evaluateRule(rule({ conditions: { slaPctGte: 80 } }), baseSnapshot({ slaPct: null })).matches, false);
});

test('already escalated to this step does not re-fire', () => {
  // level 1 already reached; a rule with fromLevel 0 targeting that step is skipped.
  assert.equal(evaluateRule(rule({ fromLevel: 1 }), baseSnapshot({ level: 2 })).matches, false);
});

test('status excluded by rule never fires', () => {
  const r = rule({ conditions: { statusNotIn: ['RESOLVED', 'REJECTED'] } });
  assert.equal(evaluateRule(r, baseSnapshot({ status: 'RESOLVED' })).matches, false);
  assert.equal(evaluateRule(r, baseSnapshot({ status: 'IN_PROGRESS' })).matches, true);
});

test('escalation level ladder clamps at MAX and advances one step', () => {
  assert.equal(nextEscalationLevel(0), 1);
  assert.equal(nextEscalationLevel(1), 2);
  assert.equal(nextEscalationLevel(3), 4);
  assert.equal(nextEscalationLevel(4), 4); // never exceeds Level 4
  assert.equal(escalationLevelLabel(1), 'Department Officer');
  assert.equal(escalationLevelLabel(3), 'Municipal Authority');
});
