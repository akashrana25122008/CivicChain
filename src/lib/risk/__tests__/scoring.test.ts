import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAreaRisk,
  classifyRisk,
  severityToScore,
  calcSeverityFactor,
  calcFrequencyFactor,
  calcRecurrenceFactor,
  calcSlaImpact,
  calcDurationFactor,
  calcConfirmationFactor,
  getRiskConfig,
} from '../scoring';
import type { AreaRiskInput } from '../scoring';

const DEFAULT_CONFIG = getRiskConfig();

function makeInput(overrides: Partial<AreaRiskInput> = {}): AreaRiskInput {
  return {
    severityScore: 50,
    issueCount: 10,
    repeatCount: 2,
    slaBreaches: 1,
    slaAtRisk: 1,
    activeCount: 10,
    avgUnresolvedHours: 24,
    confirmVotes: 3,
    totalVotes: 8,
    populationExposure: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// severityToScore
// ---------------------------------------------------------------------------
describe('severityToScore', () => {
  it('maps known severities to scores', () => {
    assert.equal(severityToScore('LOW'), 20);
    assert.equal(severityToScore('MEDIUM'), 50);
    assert.equal(severityToScore('HIGH'), 80);
    assert.equal(severityToScore('CRITICAL'), 100);
  });

  it('returns neutral for unknown/null', () => {
    assert.equal(severityToScore(null), 50);
    assert.equal(severityToScore(undefined), 50);
    assert.equal(severityToScore('UNKNOWN'), 50);
  });

  it('is case-insensitive', () => {
    assert.equal(severityToScore('high'), 80);
    assert.equal(severityToScore('Critical'), 100);
  });
});

// ---------------------------------------------------------------------------
// Factor calculations
// ---------------------------------------------------------------------------
describe('calcSeverityFactor', () => {
  it('returns the severity score directly', () => {
    assert.equal(calcSeverityFactor(makeInput({ severityScore: 80 })), 80);
  });

  it('clamps to 0-100', () => {
    assert.equal(calcSeverityFactor(makeInput({ severityScore: -10 })), 0);
    assert.equal(calcSeverityFactor(makeInput({ severityScore: 150 })), 100);
  });
});

describe('calcFrequencyFactor', () => {
  it('returns 0 for no issues', () => {
    assert.equal(calcFrequencyFactor(makeInput({ issueCount: 0 }), DEFAULT_CONFIG), 0);
  });

  it('scales logarithmically toward 100', () => {
    const atCap = calcFrequencyFactor(makeInput({ issueCount: DEFAULT_CONFIG.frequencyCap }), DEFAULT_CONFIG);
    assert.ok(atCap >= 95, `Expected ≥95 at cap, got ${atCap}`);
  });

  it('increases with more issues', () => {
    const low = calcFrequencyFactor(makeInput({ issueCount: 2 }), DEFAULT_CONFIG);
    const high = calcFrequencyFactor(makeInput({ issueCount: 20 }), DEFAULT_CONFIG);
    assert.ok(high > low, `${high} should be > ${low}`);
  });
});

describe('calcRecurrenceFactor', () => {
  it('returns 0 for no repeats', () => {
    assert.equal(calcRecurrenceFactor(makeInput({ repeatCount: 0 }), DEFAULT_CONFIG), 0);
  });

  it('scales linearly to 100 at cap', () => {
    const atCap = calcRecurrenceFactor(makeInput({ repeatCount: DEFAULT_CONFIG.recurrenceCap }), DEFAULT_CONFIG);
    assert.equal(atCap, 100);
  });
});

describe('calcSlaImpact', () => {
  it('returns 0 for no active issues', () => {
    assert.equal(calcSlaImpact(makeInput({ activeCount: 0, slaBreaches: 0, slaAtRisk: 0 })), 0);
  });

  it('returns 70 when all issues are breached (70% breach weight)', () => {
    assert.equal(calcSlaImpact(makeInput({ activeCount: 10, slaBreaches: 10, slaAtRisk: 0 })), 70);
  });

  it('breaches weigh more than at-risk', () => {
    // 5/10 breaches = 0.5*70 = 35
    const breachOnly = calcSlaImpact(makeInput({ activeCount: 10, slaBreaches: 5, slaAtRisk: 0 }));
    // 5/10 at-risk = 0.5*30 = 15
    const riskOnly = calcSlaImpact(makeInput({ activeCount: 10, slaBreaches: 0, slaAtRisk: 5 }));
    assert.equal(breachOnly, 35);
    assert.equal(riskOnly, 15);
    assert.ok(breachOnly > riskOnly, `${breachOnly} should be > ${riskOnly}`);
  });
});

describe('calcDurationFactor', () => {
  it('returns 0 for zero hours', () => {
    assert.equal(calcDurationFactor(makeInput({ avgUnresolvedHours: 0 }), DEFAULT_CONFIG), 0);
  });

  it('returns 100 at cap', () => {
    assert.equal(
      calcDurationFactor(makeInput({ avgUnresolvedHours: DEFAULT_CONFIG.durationCapHours }), DEFAULT_CONFIG),
      100,
    );
  });
});

describe('calcConfirmationFactor', () => {
  it('returns 0 for no votes', () => {
    assert.equal(calcConfirmationFactor(makeInput({ totalVotes: 0, confirmVotes: 0 })), 0);
  });

  it('returns 100 when all votes are confirms', () => {
    assert.equal(calcConfirmationFactor(makeInput({ totalVotes: 10, confirmVotes: 10 })), 100);
  });
});

// ---------------------------------------------------------------------------
// classifyRisk
// ---------------------------------------------------------------------------
describe('classifyRisk', () => {
  it('classifies LOW correctly', () => {
    assert.equal(classifyRisk(10), 'LOW');
    assert.equal(classifyRisk(24), 'LOW');
  });

  it('classifies MEDIUM correctly', () => {
    assert.equal(classifyRisk(25), 'MEDIUM');
    assert.equal(classifyRisk(49), 'MEDIUM');
  });

  it('classifies HIGH correctly', () => {
    assert.equal(classifyRisk(50), 'HIGH');
    assert.equal(classifyRisk(74), 'HIGH');
  });

  it('classifies CRITICAL correctly', () => {
    assert.equal(classifyRisk(75), 'CRITICAL');
    assert.equal(classifyRisk(100), 'CRITICAL');
  });
});

// ---------------------------------------------------------------------------
// computeAreaRisk (composite)
// ---------------------------------------------------------------------------
describe('computeAreaRisk', () => {
  it('returns a score between 0 and 100', () => {
    const result = computeAreaRisk(makeInput());
    assert.ok(result.score >= 0 && result.score <= 100);
  });

  it('classifies the score into a level', () => {
    const result = computeAreaRisk(makeInput());
    assert.ok(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(result.level));
  });

  it('includes factor breakdown', () => {
    const result = computeAreaRisk(makeInput());
    assert.ok(result.factors.length >= 6);
    for (const f of result.factors) {
      assert.ok(f.key);
      assert.ok(f.label);
      assert.ok(typeof f.weight === 'number');
      assert.ok(typeof f.factorScore === 'number');
    }
  });

  it('produces higher score for more severe/frequent issues', () => {
    const lowInput = makeInput({
      severityScore: 20, issueCount: 2, repeatCount: 0,
      slaBreaches: 0, slaAtRisk: 0, avgUnresolvedHours: 2,
      confirmVotes: 0, totalVotes: 0,
    });
    const highInput = makeInput({
      severityScore: 100, issueCount: 40, repeatCount: 15,
      slaBreaches: 10, slaAtRisk: 5, avgUnresolvedHours: 120,
      confirmVotes: 8, totalVotes: 10,
    });
    const lowResult = computeAreaRisk(lowInput);
    const highResult = computeAreaRisk(highInput);
    assert.ok(highResult.score > lowResult.score,
      `High (${highResult.score}) should be > Low (${lowResult.score})`);
  });

  it('marks population as unavailable when null', () => {
    const result = computeAreaRisk(makeInput({ populationExposure: null }));
    assert.ok(result.unavailable.includes('population-exposure'));
  });

  it('handles zero-input gracefully', () => {
    const result = computeAreaRisk(makeInput({
      severityScore: 0, issueCount: 0, repeatCount: 0,
      slaBreaches: 0, slaAtRisk: 0, activeCount: 0,
      avgUnresolvedHours: 0, confirmVotes: 0, totalVotes: 0,
    }));
    assert.equal(result.score, 0);
    assert.equal(result.level, 'LOW');
  });
});

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
describe('getRiskConfig', () => {
  it('returns default config with valid ranges', () => {
    const cfg = getRiskConfig();
    assert.ok(cfg.lowThreshold < cfg.mediumThreshold);
    assert.ok(cfg.mediumThreshold < cfg.highThreshold);
    assert.ok(cfg.frequencyCap > 0);
    assert.ok(cfg.durationCapHours > 0);
    // Weights should sum close to 1.0
    const totalWeight = cfg.severityWeight + cfg.frequencyWeight + cfg.recurrenceWeight +
      cfg.slaImpactWeight + cfg.durationWeight + cfg.confirmationWeight + cfg.populationWeight;
    assert.ok(totalWeight >= 0.9 && totalWeight <= 1.1,
      `Weights sum to ${totalWeight}, expected ~1.0`);
  });
});
