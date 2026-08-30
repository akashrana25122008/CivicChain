/**
 * Priority engine (spec: independent from AI + duplicate). Deterministic,
 * server-side score on a 0-100 scale:
 *
 *   Severity×0.30 + Reports×0.20 + Population Impact×0.15 +
 *   Location Criticality×0.15 + Safety Risk×0.10 + Evidence Confidence×0.10
 *
 * Population impact and location criticality are intentionally NOT invented:
 * when no authoritative ward/demographic data source is configured they fall
 * back to a documented neutral (50) and are flagged "unavailable". Severity
 * is likewise neutral until a real AI analysis supplies it.
 */
import type { Severity } from '../../../../../generated/prisma/client';
import { intelligenceConfig } from '@/lib/server/intelligence/config';

export interface PriorityComponent {
  key: string;
  label: string;
  weight: number;
  /** Normalized 0-100 contribution before weighting. */
  score: number;
  origin: 'computed' | 'unavailable';
}

export interface PriorityResult {
  score: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  components: PriorityComponent[];
  /** Human-readable list of inputs that were unavailable (no data invented). */
  unavailable: string[];
}

export interface PriorityInput {
  severity: Severity | null;
  reports: number;
  populationImpact?: number | null;
  locationCriticality?: number | null;
  safetyRisk?: 'NONE' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' | null;
  evidenceConfidence: number; // 0-100
}

const NEUTRAL_UNAVAILABLE = 50;

const SEVERITY_SCORES: Record<Severity, number> = {
  LOW: 20,
  MEDIUM: 50,
  HIGH: 80,
  CRITICAL: 100,
};

const SAFETY_SCORES: Record<string, number> = {
  NONE: 0,
  LOW: 25,
  MODERATE: 50,
  HIGH: 85,
  CRITICAL: 100,
};

export function priorityLevelFor(score: number): PriorityResult['level'] {
  if (score >= 90) return 'CRITICAL';
  if (score >= 70) return 'HIGH';
  if (score >= 50) return 'MEDIUM';
  return 'LOW';
}

export function computePriorityScore(input: PriorityInput): PriorityResult {
  const w = intelligenceConfig.priority.weights;
  const reportsCap = intelligenceConfig.priority.reportsCap;
  const unavailable: string[] = [];

  let severityScore: number;
  if (input.severity) {
    severityScore = SEVERITY_SCORES[input.severity];
  } else {
    severityScore = NEUTRAL_UNAVAILABLE;
    unavailable.push('severity');
  }

  const reportsScore = (Math.min(reportsCap, Math.max(1, input.reports)) / reportsCap) * 100;

  let populationScore: number;
  if (input.populationImpact != null) {
    populationScore = input.populationImpact;
  } else {
    populationScore = NEUTRAL_UNAVAILABLE;
    unavailable.push('population-impact');
  }

  let locationScore: number;
  if (input.locationCriticality != null) {
    locationScore = input.locationCriticality;
  } else {
    locationScore = NEUTRAL_UNAVAILABLE;
    unavailable.push('location-criticality');
  }

  let safetyScore: number;
  if (input.safetyRisk) {
    safetyScore = SAFETY_SCORES[input.safetyRisk] ?? NEUTRAL_UNAVAILABLE;
  } else {
    safetyScore = NEUTRAL_UNAVAILABLE;
    unavailable.push('safety-risk');
  }

  const evidenceScore = Math.max(0, Math.min(100, input.evidenceConfidence));

  const components: PriorityComponent[] = [
    { key: 'severity', label: 'Severity', weight: w.severity, score: severityScore, origin: input.severity ? 'computed' : 'unavailable' },
    { key: 'reports', label: 'Reports', weight: w.reports, score: reportsScore, origin: 'computed' },
    { key: 'population', label: 'Population impact', weight: w.population, score: populationScore, origin: input.populationImpact != null ? 'computed' : 'unavailable' },
    { key: 'location', label: 'Location criticality', weight: w.locationCriticality, score: locationScore, origin: input.locationCriticality != null ? 'computed' : 'unavailable' },
    { key: 'safety', label: 'Safety risk', weight: w.safety, score: safetyScore, origin: input.safetyRisk ? 'computed' : 'unavailable' },
    { key: 'evidence', label: 'Evidence confidence', weight: w.evidence, score: evidenceScore, origin: 'computed' },
  ];

  const score = Math.round(
    components.reduce((sum, c) => sum + c.weight * c.score, 0),
  );

  return {
    score: Math.max(0, Math.min(100, score)),
    level: priorityLevelFor(score),
    components,
    unavailable,
  };
}

/**
 * Evidence-trust rubric built from REAL report content (never invented):
 * visual proof, precise geo-fix, multiple items, detailed description.
 */
export function evidenceConfidenceScore(input: {
  hasImage: boolean;
  hasCoordinates: boolean;
  accuracy: number | null;
  evidenceCount: number;
  descriptionLength: number;
}): number {
  let score = 0;
  if (input.hasImage) score += 40;
  if (input.hasCoordinates) {
    score += input.accuracy != null && input.accuracy <= 50 ? 30 : 20;
  }
  if (input.evidenceCount >= 2) score += 20;
  if (input.descriptionLength >= 40) score += 10;
  return Math.min(100, score);
}