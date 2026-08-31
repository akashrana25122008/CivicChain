/**
 * Phase 11 — Risk Scoring Engine
 *
 * Pure, deterministic risk scoring for areas/wards. Each factor is normalized
 * to 0–100, then weighted and summed into a composite risk score (0–100).
 *
 * Risk Score =
 *   severity      × severityWeight
 * + frequency     × frequencyWeight
 * + recurrence    × recurrenceWeight
 * + slaImpact     × slaImpactWeight
 * + duration      × durationWeight
 * + confirmation  × confirmationWeight
 *
 * All weights are configurable via RiskConfig. Thresholds for classification
 * are also configurable. Population exposure is architecturally reserved but
 * not invented — falls back to neutral (0) when unavailable.
 *
 * Every value is traceable: the result includes per-factor breakdown.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface RiskConfig {
  /** Weight for severity factor (0–1). */
  severityWeight: number;
  /** Weight for frequency factor (0–1). */
  frequencyWeight: number;
  /** Weight for recurrence/repeat factor (0–1). */
  recurrenceWeight: number;
  /** Weight for SLA breach/at-risk factor (0–1). */
  slaImpactWeight: number;
  /** Weight for unresolved duration factor (0–1). */
  durationWeight: number;
  /** Weight for citizen confirmation signal (0–1). */
  confirmationWeight: number;
  /** Weight for population exposure (0–1). Reserved, default 0. */
  populationWeight: number;
  /** Risk score threshold: below → LOW. */
  lowThreshold: number;
  /** Risk score threshold: below → MEDIUM. */
  mediumThreshold: number;
  /** Risk score threshold: below → HIGH. Above → CRITICAL. */
  highThreshold: number;
  /** Max incidents used to normalize frequency (cap). */
  frequencyCap: number;
  /** Max repeat incidents to normalize recurrence (cap). */
  recurrenceCap: number;
  /** Max unresolved hours to normalize duration (cap). */
  durationCapHours: number;
}

const DEFAULT_CONFIG: RiskConfig = {
  severityWeight: 0.25,
  frequencyWeight: 0.20,
  recurrenceWeight: 0.15,
  slaImpactWeight: 0.20,
  durationWeight: 0.10,
  confirmationWeight: 0.10,
  populationWeight: 0.0,
  lowThreshold: 25,
  mediumThreshold: 50,
  highThreshold: 75,
  frequencyCap: 50,
  recurrenceCap: 20,
  durationCapHours: 168, // 7 days
};

/** Allow env overrides for thresholds (documented, not invented). */
function envNum(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getRiskConfig(): RiskConfig {
  return {
    ...DEFAULT_CONFIG,
    lowThreshold: envNum('RISK_LOW_THRESHOLD', DEFAULT_CONFIG.lowThreshold),
    mediumThreshold: envNum('RISK_MEDIUM_THRESHOLD', DEFAULT_CONFIG.mediumThreshold),
    highThreshold: envNum('RISK_HIGH_THRESHOLD', DEFAULT_CONFIG.highThreshold),
    frequencyCap: envNum('RISK_FREQUENCY_CAP', DEFAULT_CONFIG.frequencyCap),
    recurrenceCap: envNum('RISK_RECURRENCE_CAP', DEFAULT_CONFIG.recurrenceCap),
    durationCapHours: envNum('RISK_DURATION_CAP_HOURS', DEFAULT_CONFIG.durationCapHours),
  };
}

// ---------------------------------------------------------------------------
// Factor inputs
// ---------------------------------------------------------------------------

export interface AreaRiskInput {
  /** Average severity score of issues in this area (0–100). */
  severityScore: number;
  /** Number of issues in this area within the time window. */
  issueCount: number;
  /** Number of repeat/recurring issues (same category+area). */
  repeatCount: number;
  /** Number of SLA-breached issues. */
  slaBreaches: number;
  /** Number of at-risk issues (approaching breach). */
  slaAtRisk: number;
  /** Total active (unresolved) issues. */
  activeCount: number;
  /** Average unresolved duration in hours. */
  avgUnresolvedHours: number;
  /** Number of citizen CONFIRM votes on issues in this area. */
  confirmVotes: number;
  /** Total votes on issues in this area. */
  totalVotes: number;
  /** Population exposure score (0–100). null = unavailable. */
  populationExposure: number | null;
}

// ---------------------------------------------------------------------------
// Severity mapping (reuse existing Severity enum values)
// ---------------------------------------------------------------------------

const SEVERITY_SCORES: Record<string, number> = {
  LOW: 20,
  MEDIUM: 50,
  HIGH: 80,
  CRITICAL: 100,
};

export function severityToScore(severity: string | null | undefined): number {
  if (!severity) return 50; // neutral when unknown
  return SEVERITY_SCORES[severity.toUpperCase()] ?? 50;
}

// ---------------------------------------------------------------------------
// Individual factor calculations (all return 0–100)
// ---------------------------------------------------------------------------

/**
 * Normalize severity into a 0–100 score.
 * Uses pre-computed average or raw severity string.
 */
export function calcSeverityFactor(input: AreaRiskInput): number {
  return Math.max(0, Math.min(100, input.severityScore));
}

/**
 * Normalize issue frequency into 0–100 using logarithmic scaling.
 * More issues = higher risk, but with diminishing returns past the cap.
 */
export function calcFrequencyFactor(input: AreaRiskInput, config: RiskConfig): number {
  if (input.issueCount <= 0) return 0;
  const capped = Math.min(input.issueCount, config.frequencyCap);
  // Logarithmic scale: 1 issue → ~20, cap issues → 100
  const logScale = Math.log(1 + capped) / Math.log(1 + config.frequencyCap);
  return Math.round(logScale * 100);
}

/**
 * Normalize recurrence (repeat incidents) into 0–100.
 * Repeat issues amplify risk significantly.
 */
export function calcRecurrenceFactor(input: AreaRiskInput, config: RiskConfig): number {
  if (input.repeatCount <= 0) return 0;
  const capped = Math.min(input.repeatCount, config.recurrenceCap);
  return Math.round((capped / config.recurrenceCap) * 100);
}

/**
 * Calculate SLA impact (0–100) from breach + at-risk counts.
 * Breaches are weighted more heavily than at-risk.
 */
export function calcSlaImpact(input: AreaRiskInput): number {
  const total = input.activeCount;
  if (total <= 0) return 0;
  const breachRatio = Math.min(input.slaBreaches, total) / total;
  const atRiskRatio = Math.min(input.slaAtRisk, total) / total;
  // Breach = 70% weight, at-risk = 30% weight
  const raw = (breachRatio * 0.70 + atRiskRatio * 0.30) * 100;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

/**
 * Normalize unresolved duration into 0–100.
 * Longer unresolved = higher risk, capped at durationCapHours.
 */
export function calcDurationFactor(input: AreaRiskInput, config: RiskConfig): number {
  if (input.avgUnresolvedHours <= 0) return 0;
  const capped = Math.min(input.avgUnresolvedHours, config.durationCapHours);
  return Math.round((capped / config.durationCapHours) * 100);
}

/**
 * Calculate citizen confirmation signal (0–100).
 * Higher confirm ratio = more validated = higher risk urgency.
 */
export function calcConfirmationFactor(input: AreaRiskInput): number {
  if (input.totalVotes <= 0) return 0;
  const confirmRatio = input.confirmVotes / input.totalVotes;
  return Math.round(confirmRatio * 100);
}

/**
 * Calculate population exposure (0–100).
 * Returns null when population data is unavailable.
 */
export function calcPopulationFactor(input: AreaRiskInput): number | null {
  return input.populationExposure;
}

// ---------------------------------------------------------------------------
// Composite risk score + classification
// ---------------------------------------------------------------------------

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RiskFactor {
  key: string;
  label: string;
  weight: number;
  /** Raw factor score 0–100 before weighting. */
  factorScore: number;
  /** Weighted contribution to final score. */
  weightedScore: number;
  origin: 'computed' | 'unavailable';
}

export interface AreaRiskResult {
  /** Composite risk score 0–100. */
  score: number;
  /** Classified risk level. */
  level: RiskLevel;
  /** Per-factor breakdown for explainability. */
  factors: RiskFactor[];
  /** Human-readable factors that were unavailable. */
  unavailable: string[];
}

/** Classify a numeric score into a risk level using configured thresholds. */
export function classifyRisk(score: number, config?: RiskConfig): RiskLevel {
  const cfg = config ?? getRiskConfig();
  if (score >= cfg.highThreshold) return 'CRITICAL';
  if (score >= cfg.mediumThreshold) return 'HIGH';
  if (score >= cfg.lowThreshold) return 'MEDIUM';
  return 'LOW';
}

/** Human-readable explanation for why an area has its risk level. */
export function generateRiskExplanation(
  wardName: string,
  result: AreaRiskResult,
  input: AreaRiskInput,
): string {
  const parts: string[] = [];
  parts.push(`${wardName} is classified as ${result.level} (score ${result.score}/100).`);

  if (input.issueCount > 0) parts.push(`${input.issueCount} active incidents.`);
  if (input.repeatCount > 0) parts.push(`${input.repeatCount} repeat incidents.`);
  if (input.slaBreaches > 0) parts.push(`${input.slaBreaches} SLA breaches.`);
  if (input.avgUnresolvedHours > 0) {
    const hrs = Math.round(input.avgUnresolvedHours);
    parts.push(`Average unresolved duration: ${hrs}h.`);
  }
  if (input.confirmVotes > 0) parts.push(`${input.confirmVotes} citizen confirmations.`);

  // Identify dominant risk driver
  const sorted = [...result.factors].sort((a, b) => b.weightedScore - a.weightedScore);
  if (sorted.length > 0 && sorted[0].weightedScore > 0) {
    parts.push(`Primary driver: ${sorted[0].label}.`);
  }

  if (result.unavailable.length > 0) {
    parts.push(`Note: ${result.unavailable.join(', ')} data unavailable.`);
  }

  return parts.join(' ');
}

/**
 * Compute composite area risk score from real issue data.
 * Returns the score, classification, per-factor breakdown, and explanation.
 */
export function computeAreaRisk(
  input: AreaRiskInput,
  config?: RiskConfig,
): AreaRiskResult {
  const cfg = config ?? getRiskConfig();
  const unavailable: string[] = [];

  const severity = calcSeverityFactor(input);
  const frequency = calcFrequencyFactor(input, cfg);
  const recurrence = calcRecurrenceFactor(input, cfg);
  const slaImpact = calcSlaImpact(input);
  const duration = calcDurationFactor(input, cfg);
  const confirmation = calcConfirmationFactor(input);
  const population = calcPopulationFactor(input);

  if (population === null) unavailable.push('population-exposure');

  const factors: RiskFactor[] = [
    {
      key: 'severity', label: 'Severity', weight: cfg.severityWeight,
      factorScore: severity, weightedScore: Math.round(severity * cfg.severityWeight),
      origin: input.severityScore > 0 ? 'computed' : 'unavailable',
    },
    {
      key: 'frequency', label: 'Frequency', weight: cfg.frequencyWeight,
      factorScore: frequency, weightedScore: Math.round(frequency * cfg.frequencyWeight),
      origin: 'computed',
    },
    {
      key: 'recurrence', label: 'Recurrence', weight: cfg.recurrenceWeight,
      factorScore: recurrence, weightedScore: Math.round(recurrence * cfg.recurrenceWeight),
      origin: 'computed',
    },
    {
      key: 'sla', label: 'SLA Breach', weight: cfg.slaImpactWeight,
      factorScore: slaImpact, weightedScore: Math.round(slaImpact * cfg.slaImpactWeight),
      origin: 'computed',
    },
    {
      key: 'duration', label: 'Unresolved Duration', weight: cfg.durationWeight,
      factorScore: duration, weightedScore: Math.round(duration * cfg.durationWeight),
      origin: 'computed',
    },
    {
      key: 'confirmation', label: 'Citizen Confirmation', weight: cfg.confirmationWeight,
      factorScore: confirmation, weightedScore: Math.round(confirmation * cfg.confirmationWeight),
      origin: 'computed',
    },
  ];

  if (cfg.populationWeight > 0) {
    const popScore = population ?? 0;
    factors.push({
      key: 'population', label: 'Population Exposure', weight: cfg.populationWeight,
      factorScore: popScore, weightedScore: Math.round(popScore * cfg.populationWeight),
      origin: population !== null ? 'computed' : 'unavailable',
    });
  }

  const score = Math.max(0, Math.min(100,
    factors.reduce((sum, f) => sum + f.weightedScore, 0),
  ));

  return {
    score,
    level: classifyRisk(score, cfg),
    factors,
    unavailable,
  };
}
