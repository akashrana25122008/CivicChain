/**
 * Phase 11 — Shared risk intelligence types.
 *
 * Used by the risk engine, API layer, and frontend.
 */

import type { RiskLevel } from './scoring';
import type { TrendDirection } from './trend';

// ---------------------------------------------------------------------------
// Hotspot
// ---------------------------------------------------------------------------

export interface RiskHotspot {
  /** Unique identifier for this hotspot area. */
  hotspotId: string;
  /** Human-readable area/ward name. */
  areaName: string;
  /** Centroid latitude of issues in this area. */
  latitude: number;
  /** Centroid longitude of issues in this area. */
  longitude: number;
  /** Composite risk score 0–100. */
  riskScore: number;
  /** Classified risk level. */
  riskLevel: RiskLevel;
  /** Number of active (unresolved) issues. */
  activeIncidents: number;
  /** Total issues in the time window. */
  totalIncidents: number;
  /** Number of repeat/recurring incidents. */
  repeatIncidentCount: number;
  /** Number of SLA breaches. */
  slaBreaches: number;
  /** Number of at-risk issues. */
  slaAtRisk: number;
  /** Dominant issue category in this area. */
  dominantCategory: string;
  /** Average unresolved duration in hours. */
  avgUnresolvedHours: number;
  /** Number of citizen confirmations. */
  confirmVotes: number;
  /** Risk trend vs previous period. */
  trend: TrendResult;
  /** Human-readable explanation of why this area is risky. */
  explanation: string;
}

// ---------------------------------------------------------------------------
// Ward-level risk summary
// ---------------------------------------------------------------------------

export interface WardRiskSummary {
  wardId: string;
  wardName: string;
  /** Centroid latitude of issues in this area. */
  latitude: number;
  /** Centroid longitude of issues in this area. */
  longitude: number;
  riskScore: number;
  riskLevel: RiskLevel;
  activeIncidents: number;
  totalIncidents: number;
  repeatIssues: number;
  slaBreaches: number;
  slaAtRisk: number;
  averageResolutionTime: number | null;
  topCategory: string;
  trend: TrendResult;
  factors: WardRiskFactor[];
}

export interface WardRiskFactor {
  key: string;
  label: string;
  score: number;
  weight: number;
}

// ---------------------------------------------------------------------------
// Trend
// ---------------------------------------------------------------------------

export interface TrendResult {
  direction: TrendDirection;
  percentage: number;
}

// ---------------------------------------------------------------------------
// Risk summary (dashboard overview)
// ---------------------------------------------------------------------------

export interface RiskSummary {
  /** Total areas with issues. */
  totalAreas: number;
  /** Areas classified as LOW. */
  lowRiskAreas: number;
  /** Areas classified as MEDIUM. */
  mediumRiskAreas: number;
  /** Areas classified as HIGH. */
  highRiskAreas: number;
  /** Areas classified as CRITICAL. */
  criticalRiskAreas: number;
  /** Total active issues across all areas. */
  totalActiveIssues: number;
  /** Total SLA breaches across all areas. */
  totalSlaBreaches: number;
  /** Overall average risk score. */
  averageRiskScore: number;
  /** Overall risk trend. */
  overallTrend: TrendResult;
  /** Top hotspot areas. */
  topHotspots: RiskHotspot[];
}

// ---------------------------------------------------------------------------
// API query params
// ---------------------------------------------------------------------------

export interface RiskQueryParams {
  riskLevel?: RiskLevel;
  category?: string;
  days?: number;
  limit?: number;
  offset?: number;
}
