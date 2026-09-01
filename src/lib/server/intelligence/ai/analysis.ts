/**
 * Real server-side AI analysis. A single report gets one AIAnalysis row that
 * progresses PENDING -> PROCESSING -> COMPLETED | FAILED. Nothing here
 * fabricates results: no key/endpoint configured is a genuine FAILED state,
 * and a FAILED run always leaves the Issue stored and usable.
 *
 * The duplicate/priority engines are deliberately separate (spec: keep AI,
 * duplicate and priority responsibilities independent).
 */
import { prisma } from '@/lib/db';
import { recordAudit } from '@/lib/server/audit';
import { createNotification } from '@/lib/server/notify';
import { readEvidenceFile } from '@/lib/server/storage';
import { intelligenceConfig } from '@/lib/server/intelligence/config';
import { chatCompletionWithRetry } from '@/lib/server/intelligence/ai/client';
import { AI_CATEGORY_TO_ISSUE, aiSeverityToIssueSeverity } from '@/lib/server/intelligence/ai/mapping';
import { getAuthorityDepartmentForCategory } from '@/lib/issues/mapping';
import { ensurePromiseForIssue, reconcilePromiseStatus } from '@/lib/sla/promise';
import { z } from 'zod';
import {
  AIAnalysisStatus,
  AICategory,
  AISeverity,
  InfrastructureType,
  SafetyRisk,
  type AIAnalysis,
} from '../../../../../generated/prisma/client';

const ENUM_STRINGS = {
  category: Object.values(AICategory) as [string, ...string[]],
  severity: Object.values(AISeverity) as [string, ...string[]],
  safetyRisk: Object.values(SafetyRisk) as [string, ...string[]],
  infrastructureType: Object.values(InfrastructureType) as [string, ...string[]],
};

export const aiOutputSchema = z
  .object({
    category: z.enum(ENUM_STRINGS.category),
    severity: z.enum(ENUM_STRINGS.severity),
    confidence: z.number().min(0).max(1),
    safetyRisk: z.enum(ENUM_STRINGS.safetyRisk),
    infrastructureType: z.enum(ENUM_STRINGS.infrastructureType),
    reasoning: z.string().max(600).optional(),
  })
  .strict();

export type AiOutput = z.infer<typeof aiOutputSchema>;

const SYSTEM_PROMPT = [
  "You are CivicChain's civic-issue classifier. Classify each citizen report strictly using the allowed vocabulary below.",
  'Never guess outside the vocabulary. Return ONLY a single JSON object, no prose, no markdown, in this exact shape:',
  '{"category":"...","severity":"...","confidence":0.0,"safetyRisk":"...","infrastructureType":"...","reasoning":"one short sentence"}',
  '- category: one of ROAD_DAMAGE, STREET_LIGHT, GARBAGE, WATER_LEAKAGE, DRAINAGE, TRAFFIC_SIGNAL, PUBLIC_INFRASTRUCTURE, OTHER.',
  '- severity: the PUBLIC severity of the problem: LOW, MEDIUM, HIGH or CRITICAL.',
  '- confidence: your 0-1 confidence that the category is right.',
  '- safetyRisk: immediate public-safety risk: NONE, LOW, MODERATE, HIGH or CRITICAL.',
  '- infrastructureType: affected asset: ROAD, SIDEWALK, BRIDGE, STREET_LIGHT, TRAFFIC_SIGNAL, DRAINAGE_SYSTEM, WATER_SUPPLY, PUBLIC_BUILDING, PARK, NONE or OTHER.',
].join('\n');

/** How long a PROCESSING run may look stale before it can be resumed. */
const STALE_RUN_MS = 90_000;

function extractJson(raw: string): unknown {
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  return JSON.parse(text);
}

async function buildVisionContext(
  evidence: Array<{ url: string; mimeType: string | null }>,
): Promise<Array<{ mimeType: string; base64: string }>> {
  const { useVision, visionMaxImages } = intelligenceConfig.ai;
  if (!useVision || visionMaxImages <= 0) return [];
  const sources = evidence.slice(0, visionMaxImages);
  const out: Array<{ mimeType: string; base64: string }> = [];
  for (const ev of sources) {
    try {
      const { data } = await readEvidenceFile(ev.url);
      const sharp = (await import('sharp')).default;
      const thumb = await sharp(data).rotate().resize(1024, 1024, { fit: 'inside' }).jpeg({ quality: 70 }).toBuffer();
      out.push({ mimeType: 'image/jpeg', base64: thumb.toString('base64') });
    } catch {
      // An unreadable image never blocks classification.
    }
  }
  return out;
}

/**
 * Processes AI analysis for one issue. Safe to call concurrently: an already
 * COMPLETED run (or a fresh PROCESSING run) is left alone.
 */
export async function runAiAnalysis(issueId: string): Promise<void> {
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    include: { aiAnalysis: true },
  });
  if (!issue) return;

  const existing = issue.aiAnalysis;
  if (existing?.status === AIAnalysisStatus.COMPLETED) return;
  if (
    existing &&
    existing.status === AIAnalysisStatus.PROCESSING &&
    existing.startedAt &&
    Date.now() - existing.startedAt.getTime() < STALE_RUN_MS
  ) {
    return; // a current run already owns this issue
  }

  const now = new Date();
  if (existing) {
    await prisma.aIAnalysis.update({
      where: { id: existing.id },
      data: { status: AIAnalysisStatus.PROCESSING, startedAt: now, errorMessage: null },
    });
  } else {
    await prisma.aIAnalysis.create({
      data: { issueId, status: AIAnalysisStatus.PROCESSING, startedAt: now },
    });
  }

  const { apiKey, baseUrl, model, timeoutMs, maxRetries, useVision } =
    intelligenceConfig.ai;

  if (!apiKey) {
    await failAnalysis(issueId, 'AI service is not configured (set AI_API_KEY and AI_BASE_URL).', 'not_configured');
    return;
  }

  try {
    const images = useVision
      ? await buildVisionContext(
          await prisma.evidence.findMany({
            where: { issueId, type: 'IMAGE' },
            select: { url: true, mimeType: true },
          }),
        )
      : [];

    const userPrompt = [
      `Report ID: ${issue.publicId}`,
      `Title: ${issue.title}`,
      `Description: ${issue.description || '(none)'}`,
      `Location (reporter-entered): ${issue.location || '(none)'}`,
      `Coordinates: ${issue.latitude != null ? `${issue.latitude}, ${issue.longitude}` : '(none)'}`,
      `Reporter-selected category: ${issue.category}`,
    ].join('\n');

    const content = await chatCompletionWithRetry(
      {
        baseUrl,
        apiKey,
        model,
        system: SYSTEM_PROMPT,
        user: userPrompt,
        timeoutMs,
        images,
      },
      maxRetries,
    );

    let output: AiOutput;
    try {
      output = aiOutputSchema.parse(extractJson(content));
    } catch (err) {
      throw new Error(`AI returned unparseable output: ${err instanceof Error ? err.message : String(err)}`);
    }

    const aiCategory = output.category as AICategory;
    const issueCategory = AI_CATEGORY_TO_ISSUE[aiCategory];
    const severity = aiSeverityToIssueSeverity(output.severity);

    const departmentName = getAuthorityDepartmentForCategory(issueCategory);
    const authority = departmentName
      ? await prisma.authority.findFirst({
          where: { department: { name: departmentName } },
          select: { id: true, departmentId: true },
        })
      : null;

const completedAt = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.aIAnalysis.update({
        where: { issueId },
        data: {
          status: AIAnalysisStatus.COMPLETED,
          category: output.category as AICategory,
          severity: output.severity as AISeverity,
          confidence: output.confidence,
          safetyRisk: output.safetyRisk as SafetyRisk,
          infrastructureType: output.infrastructureType as InfrastructureType,
          reasoningSummary: output.reasoning ?? null,
          modelName: model,
          completedAt,
          errorMessage: null,
        },
      });
      await tx.issue.update({
        where: { id: issueId },
        data: {
          category: issueCategory,
          severity,
          authorityId: authority?.id ?? null,
          departmentId: authority?.departmentId ?? null,
        },
      });
      await recordAudit({
        tx,
        issueId,
        action: 'AI_ANALYSIS_COMPLETED',
        entityType: 'AIAnalysis',
        entityId: issue.id,
        metadata: {
          publicId: issue.publicId,
          category: aiCategory,
          severity: output.severity,
          confidence: output.confidence,
          safetyRisk: output.safetyRisk,
          infrastructureType: output.infrastructureType,
          model,
        },
      });
    });
    // Once AI routes the issue to an authority, form the resolution Promise
    // (deterministic deadline from SLA policy) and reconcile its status.
    await ensurePromiseForIssue(issueId).catch(() => undefined);
    await reconcilePromiseStatus(issueId).catch(() => undefined);

    // Phase 24 — when classification re-routes the issue to a different
    // authority, notify the newly-assigned department (deduped, best-effort).
    const assignedId = authority?.id ?? null;
    if (assignedId && assignedId !== issue.authorityId) {
      const authorityUser = await prisma.authority.findUnique({
        where: { id: assignedId },
        select: { userId: true },
      });
      if (authorityUser?.userId) {
        await createNotification({
          userId: authorityUser.userId,
          issueId,
          type: 'AUTHORITY_ASSIGNED',
          title: `Report assigned to your department`,
          message: `Report ${issue.publicId} was assigned to your department through AI routing.`,
          link: `/dashboard/issues/${issueId}`,
          dedupeKey: `AUTHORITY_ASSIGNED:${issueId}:${assignedId}`,
        }).catch(() => undefined);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await failAnalysis(issueId, message, 'error');
  }
}

async function failAnalysis(
  issueId: string,
  message: string,
  code: string,
): Promise<void> {
  const analysis = await prisma.aIAnalysis.findUnique({ where: { issueId } });
  if (analysis?.status === AIAnalysisStatus.COMPLETED) return;
  const completedAt = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.aIAnalysis.update({
      where: { issueId },
      data: {
        status: AIAnalysisStatus.FAILED,
        errorMessage: message,
        completedAt,
        startedAt: completedAt,
      },
    });
    const issue = await tx.issue.findUnique({ where: { id: issueId }, select: { publicId: true } });
    await recordAudit({
      tx,
      issueId,
      action: 'AI_ANALYSIS_FAILED',
      entityType: 'AIAnalysis',
      entityId: `${issueId}:${code}`,
      metadata: { publicId: issue?.publicId, code, message: message.slice(0, 400) },
    });
  });
}

export type { AIAnalysis };