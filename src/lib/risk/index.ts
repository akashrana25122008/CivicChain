/**
 * Phase 11 — Risk Intelligence Engine
 *
 * Public API for the risk module.
 */

export {
  computeAreaRisk,
  classifyRisk,
  severityToScore,
  generateRiskExplanation,
  getRiskConfig,
  calcSeverityFactor,
  calcFrequencyFactor,
  calcRecurrenceFactor,
  calcSlaImpact,
  calcDurationFactor,
  calcConfirmationFactor,
  calcPopulationFactor,
} from './scoring';

export type {
  RiskConfig,
  AreaRiskInput,
  RiskLevel,
  RiskFactor,
  AreaRiskResult,
} from './scoring';

export { calculateTrend } from './trend';
export type { TrendDirection, RiskTrend } from './trend';

export {
  fetchAreaRisks,
  fetchHotspots,
  fetchRiskSummary,
  fetchWardDetail,
} from './areas';

export type {
  RiskHotspot,
  WardRiskSummary,
  WardRiskDetail,
  RiskSummary,
  TrendResult,
  RiskQueryParams,
  WardRiskFactor,
} from './types';
