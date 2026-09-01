/**
 * Phase 19 — Analytics Engine: aggregate entry.
 *
 * Compute the full analytics payload across every metric family over a single
 * unified time window. All modules are called in parallel where independent,
 * then anomalies + insights are derived. Keeping this in one service means the
 * API layer and UI share one canonical computation — no per-route drift.
 */

import { prisma } from '@/lib/db';
import type { AnalyticsPayload, TimeRange } from './types';
import { parseTimeRange, rangeWindow } from './range';
import { computeIssueMetrics } from './issues';
import { computeResolutionMetrics } from './resolution';
import { computeSlaMetrics } from './sla';
import { computeDuplicateMetrics } from './duplicate';
import { computeVerificationMetrics } from './verification';
import { computeEscalationMetrics } from './escalation';
import { computeDepartmentMetrics } from './department';
import { computeWardRiskMetrics } from './wardRisk';
import { computeSatisfactionMetrics } from './satisfaction';
import { computeAiMetrics } from './ai';
import { detectAnomalies, buildInsights } from './insights';

export async function computeAnalytics(rawRange: string | null): Promise<AnalyticsPayload> {
  const range: TimeRange = parseTimeRange(rawRange);
  const window = rangeWindow(range);

  const [issues, resolution, sla, duplicate, verification, escalation, department, wardRisk, satisfaction, ai] =
    await Promise.all([
      computeIssueMetrics(window),
      computeResolutionMetrics(window),
      computeSlaMetrics(window),
      computeDuplicateMetrics(window),
      computeVerificationMetrics(window),
      computeEscalationMetrics(window),
      computeDepartmentMetrics(window),
      computeWardRiskMetrics(window),
      computeSatisfactionMetrics(window),
      computeAiMetrics(window),
    ]);

  const anomalies = detectAnomalies(issues, resolution, sla, verification, escalation, ai);
  const insights = buildInsights(
    issues,
    resolution,
    sla,
    wardRisk,
    verification,
    escalation,
    ai,
  );

  return {
    generatedAt: new Date().toISOString(),
    range,
    issues,
    resolution,
    sla,
    duplicate,
    verification,
    escalation,
    department,
    wardRisk,
    satisfaction,
    ai,
    anomalies,
    insights,
  };
}

// Re-exported so single-module consumers can request just what they need and
// so callers can reuse the tree without importing deep paths.
export { computeIssueMetrics } from './issues';
export { computeResolutionMetrics } from './resolution';
export { computeSlaMetrics } from './sla';
export { computeDuplicateMetrics } from './duplicate';
export { computeVerificationMetrics } from './verification';
export { computeEscalationMetrics } from './escalation';
export { computeDepartmentMetrics } from './department';
export { computeWardRiskMetrics } from './wardRisk';
export { computeSatisfactionMetrics } from './satisfaction';
export { computeAiMetrics } from './ai';
export { detectAnomalies, buildInsights } from './insights';
export { parseTimeRange, rangeWindow, RANGE_DAYS } from './range';
export type { AnalyticsPayload, TimeRange, RangeWindow } from './types';
export { prisma };
