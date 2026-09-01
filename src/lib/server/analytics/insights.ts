/**
 * Phase 19 — Analytics Engine: anomalies & insights.
 *
 * Derives operator-facing signals from the computed metric payload:
 *  - Anomalies: statistical outliers (a metric deviating strongly from the
 *    overall distribution, or a sharp period-over-period swing).
 *  - Insights: human-readable, category-tagged narratives with a positive /
 *    negative / neutral tone.
 *
 * These are deterministic functions over the metrics — no hidden randomness.
 */

import type {
  AnalyticsPayload,
  Anomaly,
  Insight,
  IssueMetric,
  ResolutionMetric,
  SlaMetric,
  WardRiskMetric,
  VerificationMetric,
  EscalationMetric,
  AiMetric,
} from './types';

const SWING_PCT = 25;

// ---------------------------------------------------------------------------
// Anomalies
// ---------------------------------------------------------------------------

export function detectAnomalies(
  issues: IssueMetric,
  resolution: ResolutionMetric,
  sla: SlaMetric,
  verification: VerificationMetric,
  escalation: EscalationMetric,
  ai: AiMetric,
): Anomaly[] {
  const out: Anomaly[] = [];

  if (issues.trend.percentage > SWING_PCT) {
    out.push({
      key: 'issue_volume_surge',
      label: 'Issue volume surge',
      severity: 'HIGH',
      detail: `Report volume is up ${issues.trend.percentage}% vs the previous window.`,
      current: issues.trend.current,
      expected: issues.trend.previous,
    });
  }
  if (issues.trend.percentage < -SWING_PCT) {
    out.push({
      key: 'issue_volume_drop',
      label: 'Issue volume drop',
      severity: 'LOW',
      detail: `Report volume fell ${Math.abs(issues.trend.percentage)}% vs the previous window.`,
      current: issues.trend.current,
      expected: issues.trend.previous,
    });
  }

  if (sla.breachRatePct != null && sla.breachRatePct > 40) {
    out.push({
      key: 'sla_breach_high',
      label: 'High SLA breach rate',
      severity: 'HIGH',
      detail: `${sla.breachRatePct}% of active promises are breached.`,
      current: sla.breachRatePct,
      expected: 40,
    });
  }

  if (escalation.total > 0 && escalation.escalationsResolvedPct != null && escalation.escalationsResolvedPct < 20) {
    out.push({
      key: 'escalation_backlog',
      label: 'Escalation backlog',
      severity: 'MEDIUM',
      detail: `Only ${escalation.escalationsResolvedPct}% of escalations are resolved.`,
      current: escalation.escalationsResolvedPct,
      expected: 20,
    });
  }

  if (verification.total > 0 && verification.verificationRatePct != null && verification.verificationRatePct > 95) {
    out.push({
      key: 'over_verification',
      label: 'Near-total verification rate',
      severity: 'LOW',
      detail: `${verification.verificationRatePct}% of verifications are approved — watch for rubber-stamping.`,
      current: verification.verificationRatePct,
      expected: 95,
    });
  }

  if (ai.totalAnalyses > 0 && ai.failed > 0 && ai.failed / ai.totalAnalyses > 0.3) {
    out.push({
      key: 'ai_failure_rate',
      label: 'High AI failure rate',
      severity: 'MEDIUM',
      detail: `${ai.failed}/${ai.totalAnalyses} analyses failed (${Math.round((ai.failed / ai.totalAnalyses) * 100)}%).`,
      current: ai.failed,
      expected: Math.round(ai.totalAnalyses * 0.3),
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Insights
// ---------------------------------------------------------------------------

export function buildInsights(
  issues: IssueMetric,
  resolution: ResolutionMetric,
  sla: SlaMetric,
  wardRisk: WardRiskMetric,
  verification: VerificationMetric,
  escalation: EscalationMetric,
  ai: AiMetric,
): Insight[] {
  const out: Insight[] = [];

  if (resolution.resolutionRatePct != null) {
    out.push({
      id: 'resolution_rate',
      category: 'resolution',
      title: 'Resolution rate',
      detail:
        resolution.resolutionRatePct >= 60
          ? `${resolution.resolutionRatePct}% of reports are resolved in this window.`
          : `${resolution.resolutionRatePct}% of reports are resolved — significant room to improve.`,
      tone: resolution.resolutionRatePct >= 60 ? 'positive' : 'negative',
    });
  }

  if (resolution.avgResolutionMinutes != null) {
    const hours = Math.round((resolution.avgResolutionMinutes / 60) * 10) / 10;
    out.push({
      id: 'resolution_time',
      category: 'resolution',
      title: 'Average resolution time',
      detail:
        hours <= 48
          ? `Reports resolve in ~${hours} hours on average.`
          : `Reports take ~${hours} hours to resolve on average.`,
      tone: hours <= 48 ? 'positive' : 'neutral',
    });
  }

  const activeSla = sla.onTrack + sla.atRisk + sla.breached;
  if (activeSla > 0) {
    out.push({
      id: 'sla_health',
      category: 'sla',
      title: 'SLA health',
      detail: `${sla.onTrack} on track, ${sla.atRisk} at risk, ${sla.breached} breached across ${activeSla} active promises.`,
      tone: sla.breached / activeSla < 0.2 ? 'positive' : 'negative',
    });
  }

  if (wardRisk.totalAreas > 0 && wardRisk.highRiskAreas + wardRisk.criticalRiskAreas > 0) {
    out.push({
      id: 'ward_risk',
      category: 'ward',
      title: 'High-risk localities',
      detail: `${wardRisk.highRiskAreas + wardRisk.criticalRiskAreas} of ${wardRisk.totalAreas} areas are high/critical risk.`,
      tone: 'negative',
    });
  }

  if (verification.total > 0) {
    out.push({
      id: 'verification_health',
      category: 'verification',
      title: 'Verification funnel',
      detail: `${verification.verified} verified, ${verification.pending} pending, ${verification.rejected} rejected.`,
      tone: verification.verificationRatePct != null && verification.verificationRatePct >= 50 ? 'positive' : 'neutral',
    });
  }

  if (escalation.total > 0) {
    out.push({
      id: 'escalation_flow',
      category: 'escalation',
      title: 'Escalation activity',
      detail: `${escalation.total} escalations (${escalation.active} active) across the escalation ladder.`,
      tone: escalation.escalationsResolvedPct != null && escalation.escalationsResolvedPct >= 50 ? 'positive' : 'neutral',
    });
  }

  if (ai.totalAnalyses > 0 && ai.categoryAccuracyPct != null) {
    out.push({
      id: 'ai_accuracy',
      category: 'ai',
      title: 'AI classification accuracy',
      detail: `AI category matches the reviewed category ${ai.categoryAccuracyPct}% of the time.`,
      tone: ai.categoryAccuracyPct >= 70 ? 'positive' : 'negative',
    });
  }

  if (issues.trend.direction !== 'STABLE') {
    out.push({
      id: 'issue_trend',
      category: 'issue',
      title: 'Report volume trend',
      detail:
        issues.trend.direction === 'INCREASING'
          ? `Report volume is increasing (${issues.trend.percentage}%) — capacity may need scaling.`
          : `Report volume is decreasing (${issues.trend.percentage}%).`,
      tone: issues.trend.direction === 'INCREASING' ? 'negative' : 'positive',
    });
  }

  return out;
}

export function assembleInsightsAndAnomalies(payload: Omit<AnalyticsPayload, 'anomalies' | 'insights'> & { anomalies?: Anomaly[]; insights?: Insight[] }): {
  anomalies: Anomaly[];
  insights: Insight[];
} {
  const anomalies =
    payload.anomalies ??
    detectAnomalies(
      payload.issues,
      payload.resolution,
      payload.sla,
      payload.verification,
      payload.escalation,
      payload.ai,
    );
  const insights =
    payload.insights ??
    buildInsights(
      payload.issues,
      payload.resolution,
      payload.sla,
      payload.wardRisk,
      payload.verification,
      payload.escalation,
      payload.ai,
    );
  return { anomalies, insights };
}
