/**
 * Civic Impact Score — the differentiator.
 *
 * A single 0–100 score that answers the question a government must ask:
 *   "Why should this complaint be solved before that one?"
 *
 * CivicChain does not prioritise complaints by submission time — it
 * prioritises them by *predicted civic impact*. Each factor is normalised
 * to the largest arbitrary sub-score it can earn, then summed into a total
 * with a CRITICAL / HIGH / MEDIUM / LOW civic-priority verdict.
 *
 * Factors (following the product spec):
 *   Severity               / 30
 *   Population exposure    / 25
 *   School / hospital      / 20   (location criticality)
 *   Citizen reports        / 15   (incident member count)
 *   Unresolved duration    / 10
 *                          ====
 *   TOTAL                 / 100
 *
 * Every value is traceable: the result carries a per-factor breakdown and a
 * human-readable explanation. No data is invented — when a factor cannot be
 * sourced it is shown as neutral and flagged "unavailable" (No-Fake-System
 * policy, see ARCHITECTURE_BASELINE.md).
 */

export type ImpactVerdict = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface ImpactFactor {
  key: string;
  label: string;
  /** Maximum sub-score this factor can contribute. */
  max: number;
  /** The earned sub-score (0–max). */
  earned: number;
  /** Normalised 0–100 for uniform bar rendering. */
  pct: number;
  origin: 'computed' | 'unavailable';
}

export interface ImpactBreakdown {
  /** Composite impact score 0–100. */
  score: number;
  verdict: ImpactVerdict;
  /** A short verdict banner label, e.g. "CRITICAL CIVIC PRIORITY". */
  verdictLabel: string;
  factors: ImpactFactor[];
  /** Human-readable factors that were unavailable (not invented). */
  unavailable: string[];
  /** Plain-language "why" for judges / officers. */
  explanation: string;
}

export interface ImpactInput {
  /** Public-severity string (LOW/MEDIUM/HIGH/CRITICAL) or null when pending. */
  severity: string | null;
  /** Incident member / report count. */
  reports: number;
  /** Population-exposure 0–100; null when no authoritative ward data. */
  populationImpact?: number | null;
  /** Location criticality 0–100 (schools/hospitals); null when unavailable. */
  locationCriticality?: number | null;
  /** Hours the issue has been unresolved; 0 for a just-created report. */
  unresolvedHours?: number;
}

export const IMPACT_FACTOR_MAX = {
  severity: 30,
  population: 25,
  location: 20,
  reports: 15,
  duration: 10,
} as const;

const SEVERITY_EARNED: Record<string, number> = {
  LOW: 8,
  MEDIUM: 18,
  HIGH: 25,
  CRITICAL: 30,
};

/** Map a 0–100 style score onto a sub-score cap (proportional + clamped). */
function prop(valuePct: number, max: number): number {
  const v = Math.max(0, Math.min(100, valuePct));
  return Math.round((v / 100) * max);
}

/** Classify an impact total into a human + machine verdict. */
export function impactVerdictFor(score: number): ImpactVerdict {
  if (score >= 75) return 'CRITICAL';
  if (score >= 55) return 'HIGH';
  if (score >= 35) return 'MEDIUM';
  return 'LOW';
}

export const IMPACT_VERDICT_LABEL: Record<ImpactVerdict, string> = {
  CRITICAL: 'CRITICAL CIVIC PRIORITY',
  HIGH: 'HIGH CIVIC PRIORITY',
  MEDIUM: 'MEDIUM CIVIC PRIORITY',
  LOW: 'LOW CIVIC PRIORITY',
};

/**
 * Compute the Civic Impact Score from real report signals. Deterministic and
 * pure (no DB, no wall-clock beyond the injected `unresolvedHours`), so it is
 * trivial to unit test and safe to recompute on every read.
 */
export function computeCivicImpact(input: ImpactInput): ImpactBreakdown {
  const unavailable: string[] = [];

  // ── Severity / 30 ──────────────────────────────────────────────
  let severityEarned = 0;
  let severityOrigin: 'computed' | 'unavailable' = 'unavailable';
  if (input.severity) {
    const mapped = SEVERITY_EARNED[input.severity.toUpperCase()];
    if (mapped != null) {
      severityEarned = mapped;
      severityOrigin = 'computed';
    } else {
      unavailable.push('severity');
    }
  } else {
    unavailable.push('severity');
  }

  // ── Population exposure / 25 ───────────────────────────────────
  let popEarned = 0;
  let popOrigin: 'computed' | 'unavailable' = 'unavailable';
  if (input.populationImpact != null) {
    popEarned = prop(input.populationImpact, IMPACT_FACTOR_MAX.population);
    popOrigin = 'computed';
  } else {
    unavailable.push('population-exposure');
  }

  // ── School / hospital criticality / 20 ─────────────────────────
  let locationEarned = 0;
  let locationOrigin: 'computed' | 'unavailable' = 'unavailable';
  if (input.locationCriticality != null) {
    locationEarned = prop(input.locationCriticality, IMPACT_FACTOR_MAX.location);
    locationOrigin = 'computed';
  } else {
    unavailable.push('location-criticality');
  }

  // ── Citizen reports / 15 ───────────────────────────────────────
  // 1 report → 4/15; a 5-report incident is a strong 12/15 signal; more
  // reports asymptote toward the cap but can never dominate the total
  // (uses a soft exponential so the 6th+ report still nudges).
  const reportsRaw = Math.max(1, input.reports);
  const reportsPct = Math.min(100, Math.round((1 - Math.exp(-reportsRaw / 3)) * 100));
  const reportsEarned = prop(reportsPct, IMPACT_FACTOR_MAX.reports);

  // ── Unresolved duration / 10 ───────────────────────────────────
  // Soft ramp to 24h (a fresh report adds little; a day-old unresolved issue
  // is a meaningful signal that nobody has acted yet).
  const hours = Math.max(0, input.unresolvedHours ?? 0);
  const durationPct = Math.min(100, Math.round((hours / 24) * 100));
  const durationEarned = prop(durationPct, IMPACT_FACTOR_MAX.duration);

  const factors: ImpactFactor[] = [
    { key: 'severity', label: 'Severity', max: IMPACT_FACTOR_MAX.severity, earned: severityEarned, pct: prop(severityEarned, 100), origin: severityOrigin },
    { key: 'population', label: 'Population Exposure', max: IMPACT_FACTOR_MAX.population, earned: popEarned, pct: prop(popEarned, 100), origin: popOrigin },
    { key: 'location', label: 'School / Hospital', max: IMPACT_FACTOR_MAX.location, earned: locationEarned, pct: prop(locationEarned, 100), origin: locationOrigin },
    { key: 'reports', label: 'Citizen Reports', max: IMPACT_FACTOR_MAX.reports, earned: reportsEarned, pct: prop(reportsEarned, 100), origin: 'computed' },
    { key: 'duration', label: 'Unresolved Duration', max: IMPACT_FACTOR_MAX.duration, earned: durationEarned, pct: prop(durationEarned, 100), origin: 'computed' },
  ];

  const score = factors.reduce((sum, f) => sum + f.earned, 0);
  const verdict = impactVerdictFor(score);

  const explanation = buildExplanation(score, verdict, factors, unavailable);

  return {
    score,
    verdict,
    verdictLabel: IMPACT_VERDICT_LABEL[verdict],
    factors,
    unavailable,
    explanation,
  };
}

function buildExplanation(
  score: number,
  verdict: ImpactVerdict,
  factors: ImpactFactor[],
  unavailable: string[],
): string {
  const parts: string[] = [
    `Predicted civic impact ${score}/100 — ${IMPACT_VERDICT_LABEL[verdict]}.`,
  ];
  const ranked = [...factors].sort((a, b) => b.earned - a.earned);
  const top = ranked[0];
  if (top && top.earned > 0) {
    parts.push(`Primary driver: ${top.label}.`);
  }
  if (unavailable.length > 0) {
    parts.push(`Note: ${unavailable.join(', ')} data not available — shown neutral, never invented.`);
  }
  return parts.join(' ');
}
