/**
 * Phase 11 — Risk Trend Calculation
 *
 * Compares current period metrics against previous equivalent period
 * to determine whether risk is INCREASING, STABLE, or DECREASING.
 */

export type TrendDirection = 'INCREASING' | 'STABLE' | 'DECREASING';

export interface RiskTrend {
  direction: TrendDirection;
  /** Percentage change from previous to current period. Positive = increasing. */
  percentage: number;
  /** Raw current period score. */
  current: number;
  /** Raw previous period score. */
  previous: number;
}

/** Threshold below which change is considered STABLE (absolute percentage points). */
const STABLE_THRESHOLD = 5;

/**
 * Calculate risk trend between two periods.
 * @param currentScore - Risk score / metric for the current period
 * @param previousScore - Risk score / metric for the previous equivalent period
 */
export function calculateTrend(currentScore: number, previousScore: number): RiskTrend {
  if (previousScore === 0 && currentScore === 0) {
    return { direction: 'STABLE', percentage: 0, current: currentScore, previous: previousScore };
  }

  const diff = currentScore - previousScore;
  let percentage: number;

  if (previousScore === 0) {
    // New data where there was none — any positive value is 100% increase
    percentage = currentScore > 0 ? 100 : 0;
  } else {
    percentage = (diff / previousScore) * 100;
  }

  const rounded = Math.round(percentage * 10) / 10;
  let direction: TrendDirection;

  if (rounded > STABLE_THRESHOLD) {
    direction = 'INCREASING';
  } else if (rounded < -STABLE_THRESHOLD) {
    direction = 'DECREASING';
  } else {
    direction = 'STABLE';
  }

  return { direction, percentage: rounded, current: currentScore, previous: previousScore };
}
