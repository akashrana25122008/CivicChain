/**
 * Orchestrates the Phase 3+4 intelligence pipeline for one report. Stages are
 * deliberately isolated so a failure in one never breaks another: image
 * hashing, AI analysis, duplicate/incident clustering, priority scoring.
 *
 * Fake delays are banned — this runs as fast as the real work allows and is
 * kicked off with next/server `after()` (post-response) plus a resume-on-read
 * guard so interrupted runs self-heal.
 */
import { prisma } from '@/lib/db';
import { readEvidenceFile } from '@/lib/server/storage';
import { computeDHashHex } from '@/lib/server/intelligence/imageHash';
import { runAiAnalysis } from '@/lib/server/intelligence/ai/analysis';
import { assignIncident } from '@/lib/server/intelligence/duplicates/cluster';
import { computePriorityScore, evidenceConfidenceScore } from '@/lib/server/intelligence/priority/engine';
import { AIAnalysisStatus } from '../../../../generated/prisma/client';

export const HASH_BATCH = 50;

/** Computes + persists perceptual hashes for any image evidence that lacks one. */
export async function hashEvidenceImages(issueId: string): Promise<number> {
  const rows = await prisma.evidence.findMany({
    where: { issueId, type: 'IMAGE', perceptualHash: null },
    select: { id: true, url: true, mimeType: true },
    take: HASH_BATCH,
  });
  let updated = 0;
  for (const row of rows) {
    try {
      const { data } = await readEvidenceFile(row.url);
      const hash = await computeDHashHex(data);
      if (!hash) continue;
      await prisma.evidence.update({ where: { id: row.id }, data: { perceptualHash: hash } });
      updated += 1;
    } catch {
      // Unreadable evidence never blocks the pipeline.
    }
  }
  if (rows.length >= HASH_BATCH) {
    updated += await hashEvidenceImages(issueId);
  }
  return updated;
}

/** Persists the current priority score + level onto an issue (idempotent). */
export async function storePriorityForIssue(issueId: string): Promise<void> {
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    select: {
      severity: true,
      accuracy: true,
      latitude: true,
      longitude: true,
      description: true,
      evidence: { select: { type: true } },
      incident: { select: { id: true, issues: { select: { id: true } } } },
      aiAnalysis: { select: { safetyRisk: true } },
    },
  });
  if (!issue) return;
  const evidenceConfidence = evidenceConfidenceScore({
    hasImage: issue.evidence.some((e) => e.type === 'IMAGE'),
    hasCoordinates: issue.latitude != null && issue.longitude != null,
    accuracy: issue.accuracy,
    evidenceCount: issue.evidence.length,
    descriptionLength: issue.description?.length ?? 0,
  });
  const result = computePriorityScore({
    severity: issue.severity,
    reports: Math.max(1, issue.incident?.issues.length ?? 1),
    safetyRisk: issue.aiAnalysis?.safetyRisk ?? null,
    evidenceConfidence,
  });
  await prisma.issue.update({
    where: { id: issueId },
    data: { priority: result.score, priorityLevel: result.level },
  });
}

export interface IntelligenceResult {
  issueId: string;
}

/**
 * Full pipeline for a report. Safe to call repeatedly (idempotent stages).
 */
export async function runReportIntelligence(issueId: string): Promise<IntelligenceResult> {
  await hashEvidenceImages(issueId);
  await runAiAnalysis(issueId);
  await assignIncident(issueId, { allowReassign: true });
  await storePriorityForIssue(issueId);
  return { issueId };
}

/**
 * Resume-on-read guard: triggers the pipeline when analysis hasn't reached a
 * final state (e.g. the dev process restarted mid-run) and keeps priority
 * fresh for already-finalized reports.
 */
export async function ensureReportIntelligence(issueId: string): Promise<void> {
  const analysis = await prisma.aIAnalysis.findUnique({
    where: { issueId },
    select: { status: true, startedAt: true },
  });
  if (!analysis) {
    await runReportIntelligence(issueId);
    return;
  }
  if (analysis.status === AIAnalysisStatus.COMPLETED || analysis.status === AIAnalysisStatus.FAILED) {
    await storePriorityForIssue(issueId);
    return;
  }
  if (
    analysis.status === AIAnalysisStatus.PROCESSING &&
    analysis.startedAt &&
    Date.now() - analysis.startedAt.getTime() < 90_000
  ) {
    await storePriorityForIssue(issueId);
    return;
  }
  await runReportIntelligence(issueId);
}