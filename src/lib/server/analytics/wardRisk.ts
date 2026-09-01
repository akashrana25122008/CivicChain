/**
 * Phase 19 — Analytics Engine: ward-risk analytics.
 *
 * Reuses the Phase 11 Risk Intelligence Engine verbatim (single source of
 * truth for area risk) and adapts its summary + hotspots into the analytics
 * metric shape.
 */

import { fetchRiskSummary, fetchHotspots } from '@/lib/risk/areas';
import type { RangeWindow, WardRiskMetric } from './types';

export async function computeWardRiskMetrics(window: RangeWindow): Promise<WardRiskMetric> {
  const days = window.days > 0 ? window.days : 30;
  const [summary, hotspots] = await Promise.all([
    fetchRiskSummary({ days }),
    fetchHotspots({ days, limit: 100 }),
  ]);

  return {
    totalAreas: summary.totalAreas,
    lowRiskAreas: summary.lowRiskAreas,
    mediumRiskAreas: summary.mediumRiskAreas,
    highRiskAreas: summary.highRiskAreas,
    criticalRiskAreas: summary.criticalRiskAreas,
    totalActiveIssues: summary.totalActiveIssues,
    totalSlaBreaches: summary.totalSlaBreaches,
    avgScore: summary.averageRiskScore,
    topAreas: hotspots
      .slice(0, 5)
      .map((h) => ({
        areaName: h.areaName,
        riskScore: h.riskScore,
        riskLevel: h.riskLevel,
        activeIncidents: h.activeIncidents,
      })),
  };
}
