/**
 * Phase 20 — Landing Page: aggregated public intelligence KPIs.
 *
 * Reuses the Phase 19 analytics engine for all metrics it already covers
 * (active issues, resolution times, SLA distribution, verification counts,
 * ward risk zones, AI confidence). Adds two lightweight direct queries for
 * KPIs the engine doesn't track: resolvedToday and total promises.
 *
 * All values are live and deterministic — nothing is fabricated.
 */

import { prisma } from '@/lib/db';
import { Prisma } from '../../../generated/prisma/client';
import { computeAnalytics, type AnalyticsPayload } from './analytics';

export interface LandingIntelligence {
  /** Issues that are currently open/active (not RESOLVED or REJECTED). */
  liveIssues: number;
  /** Issues whose status changed to RESOLVED today (UTC day). */
  resolvedToday: number;
  /** Total promise count across the platform. */
  promisesTracked: number;
  /** Promises whose SLA is currently BREACHED. */
  brokenPromises: number;
  /** Ward areas classified as HIGH or CRITICAL risk. */
  activeRiskZones: number;
  /** Average time (minutes) from creation to resolution. */
  averageResolutionTime: number | null;
  /** Share of active promises currently ON_TRACK (0-100). */
  slaSuccessRatePct: number | null;
  /** Total VERIFIED verification records. */
  verifiedResolutions: number;
  /** Average AI model confidence (0-1). */
  aiConfidence: number | null;
  /** Resolution rate across the all-time window. */
  resolutionRatePct: number | null;
  /** Number of total issues reported. */
  totalIssues: number;
  /** Total issues currently in RESOLVED state. */
  resolvedIssues: number;
  /** Timestamp of this computation. */
  generatedAt: string;
}

/**
 * Pure mapping from the Phase 19 analytics payload + the two landing-only
 * KPI values into the public intelligence shape. Kept free of any I/O so the
 * normalization can be unit-tested without a database.
 */
export function buildIntelligence(payload: AnalyticsPayload, extras: {
  resolvedToday: number;
  promisesTracked: number;
}, generatedAt = new Date().toISOString()): LandingIntelligence {
  const { issues, resolution, sla, verification, wardRisk, ai } = payload;

  const successRatePct =
    sla.activePromises > 0
      ? Math.round((sla.onTrack / sla.activePromises) * 10000) / 100
      : null;

  return {
    liveIssues: issues.active,
    resolvedToday: extras.resolvedToday,
    promisesTracked: extras.promisesTracked,
    brokenPromises: sla.breached,
    activeRiskZones: wardRisk.highRiskAreas + wardRisk.criticalRiskAreas,
    averageResolutionTime: resolution.avgResolutionMinutes,
    slaSuccessRatePct: successRatePct,
    verifiedResolutions: verification.verified,
    aiConfidence: ai.avgConfidence,
    resolutionRatePct: resolution.resolutionRatePct,
    totalIssues: issues.total,
    resolvedIssues: issues.resolved,
    generatedAt,
  };
}

export async function computeLandingIntelligence(): Promise<LandingIntelligence> {
  const [analytics, resolvedTodayCount, promisesTrackedCount] = await Promise.all([
    computeAnalytics('all'),
    resolvedTodaySql(),
    prisma.promise.count(),
  ]);

  return buildIntelligence(analytics, {
    resolvedToday: resolvedTodayCount,
    promisesTracked: promisesTrackedCount,
  });
}

/** Count issues whose STATUS_CHANGED to RESOLVED happened today (UTC). */
async function resolvedTodaySql(): Promise<number> {
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const rows = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    SELECT COUNT(*)::int AS count
    FROM "AuditEvent" al
    WHERE al.action = 'STATUS_CHANGED'
      AND al.metadata->>'to' = 'RESOLVED'
      AND al."createdAt" >= ${startOfToday}
  `);
  return rows[0]?.count ?? 0;
}
