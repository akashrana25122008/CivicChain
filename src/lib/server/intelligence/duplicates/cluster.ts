/**
 * Incident clustering (Phase 4). A "strong" duplicate match joins (or creates)
 * an Incident that groups the individual reports. Requirements honored:
 *  - individual Issue reports are never deleted, merged away, or blocked;
 *  - the citizen can always submit anyway (clustering is post-hoc);
 *  - clusters grow automatically as new strong matches arrive;
 *  - nothing auto-unmerges — membership changes only when a strictly better
 *    match is found with allowReassign (used after AI re-analysis).
 */
import { prisma } from '@/lib/db';
import { recordAudit } from '@/lib/server/audit';
import { intelligenceConfig } from '@/lib/server/intelligence/config';
import { evaluateDuplicate } from '@/lib/server/intelligence/duplicates/engine';
import { computePriorityScore, evidenceConfidenceScore } from '@/lib/server/intelligence/priority/engine';
import type { AuditTx } from '@/lib/server/audit';
import type {
  Issue,
  Prisma,
  Severity,
} from '../../../../../generated/prisma/client';

/** Public ID counter row used for incidents (RefCounter.id = 2). */
const INCIDENT_COUNTER_ID = 2;
const INCIDENT_COUNTER_START = 1000;

export interface AssignIncidentOptions {
  /** Re-cluster even when the report already belongs to an incident. */
  allowReassign?: boolean;
  tx?: AuditTx;
}

export interface AssignIncidentResult {
  incidentId: string | null;
  verdict: Awaited<ReturnType<typeof evaluateDuplicate>>;
}

async function nextIncidentPublicId(): Promise<string> {
  const counter = await prisma.refCounter.upsert({
    where: { id: INCIDENT_COUNTER_ID },
    update: { value: { increment: 1 } },
    create: { id: INCIDENT_COUNTER_ID, value: INCIDENT_COUNTER_START },
  });
  return `CC-INC-${counter.value}`;
}

export async function assignIncident(
  issueId: string,
  options: AssignIncidentOptions = {},
): Promise<AssignIncidentResult> {
  const { allowReassign = false } = options;

  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    include: {
      evidence: { where: { type: 'IMAGE', perceptualHash: { not: null } }, select: { perceptualHash: true } },
      incident: { select: { id: true } },
    },
  });
  if (!issue) return { incidentId: null, verdict: null };

  const verdict = await evaluateDuplicate({
    id: issue.id,
    publicId: issue.publicId,
    title: issue.title,
    description: issue.description,
    category: issue.category,
    latitude: issue.latitude,
    longitude: issue.longitude,
    createdAt: issue.createdAt,
    imageHashes: issue.evidence
      .map((e) => e.perceptualHash)
      .filter((h): h is string => Boolean(h)),
  });

  // Only a strong match clusters; possible matches merely warn the citizen at
  // submission time (and are visible in the UI) without auto-merging.
  const strong = intelligenceConfig.duplicate.strongThreshold;
  if (!verdict || verdict.confidence < strong) {
    return { incidentId: issue.incident?.id ?? null, verdict };
  }

  if (issue.incidentId && verdict.candidateIncidentId === issue.incidentId) {
    return { incidentId: issue.incidentId, verdict };
  }

  const currentVerdict = (issue as { incidentMatch?: unknown }).incidentMatch as
    | { confidence?: number }
    | undefined;
  if (issue.incidentId && !allowReassign && currentVerdict) {
    return { incidentId: issue.incidentId, verdict };
  }

  let targetIncidentId = verdict.candidateIncidentId;
  const candidateBelongs = targetIncidentId != null;

  if (!targetIncidentId) {
    const publicId = await nextIncidentPublicId();
    const created = await prisma.incident.create({
      data: {
        publicId,
        title: issue.title,
        category: issue.category,
      },
    });
    targetIncidentId = created.id;
  }

  await prisma.$transaction(async (tx) => {
    const join = (id: string) =>
      tx.issue.update({
        where: { id },
        data: {
          incidentId: targetIncidentId,
          incidentMatch: {
            incidentId: targetIncidentId,
            confidence: Number(verdict.confidence.toFixed(3)),
            band: verdict.band,
            distanceMeters: verdict.distanceMeters,
            signals: JSON.parse(JSON.stringify(verdict.signals)) as Prisma.InputJsonValue,
            joinedAt: new Date().toISOString(),
          },
        },
      });
    const audit = async (id: string, publicLabel: string) =>
      recordAudit({
        tx,
        issueId: id,
        action: 'INCIDENT_ASSIGNED',
        entityType: 'Incident',
        entityId: targetIncidentId,
        metadata: {
          publicId: publicLabel,
          confidence: Number(verdict.confidence.toFixed(3)),
        },
      });

    await join(issueId);
    await audit(issueId, issue.publicId);

    if (!candidateBelongs) {
      // Candidate existed before Phase 4 — link it into the new cluster too.
      const candidate = await tx.issue.findUnique({
        where: { id: verdict.candidateIssueId },
        select: { publicId: true, incidentId: true },
      });
      if (candidate && !candidate.incidentId) {
        await tx.issue.update({
          where: { id: verdict.candidateIssueId },
          data: { incidentId: targetIncidentId },
        });
        await audit(verdict.candidateIssueId, candidate.publicId);
      }
    }
  });

  await recomputeIncident(targetIncidentId);
  return { incidentId: targetIncidentId, verdict };
}

const QUALITY_ORDER: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  MODERATE: 2,
  NONE: 0,
};

/** Re-derives an Incident's aggregate fields from its member reports. */
export async function recomputeIncident(incidentId: string): Promise<void> {
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    include: {
      issues: {
        include: {
          aiAnalysis: { select: { safetyRisk: true } },
          evidence: { select: { type: true } },
        },
      },
    },
  });
  if (!incident) return;

  const members = incident.issues;
  const byQuality = (get: (m: (typeof members)[number]) => string | null) =>
    members
      .map(get)
      .filter((v): v is string => Boolean(v))
      .sort((a, b) => (QUALITY_ORDER[b] ?? 0) - (QUALITY_ORDER[a] ?? 0))[0] ?? null;

  const severity = byQuality((m) => m.severity) as Severity | null;
  const safety = byQuality((m) => m.aiAnalysis?.safetyRisk ?? null) as
    | 'NONE'
    | 'LOW'
    | 'MODERATE'
    | 'HIGH'
    | 'CRITICAL'
    | null;

  const categoryCount = new Map<string, number>();
  for (const m of members) {
    categoryCount.set(m.category, (categoryCount.get(m.category) ?? 0) + 1);
  }
  const category =
    [...categoryCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'OTHER';

  const evidenceConfidence = evidenceConfidenceScore({
    hasImage: members.some((m) => m.evidence.some((e) => e.type === 'IMAGE')),
    hasCoordinates: members.some((m) => m.latitude != null && m.longitude != null),
    accuracy: members.some((m) => m.accuracy != null && m.accuracy <= 50)
      ? 50
      : members.some((m) => m.accuracy != null)
        ? 100
        : null,
    evidenceCount: members.reduce((sum, m) => sum + m.evidence.length, 0),
    descriptionLength: Math.max(...members.map((m) => m.description?.length ?? 0)),
  });

  const priority = computePriorityScore({
    severity,
    reports: Math.max(1, members.length),
    safetyRisk: safety,
    evidenceConfidence,
  });

  await prisma.incident.update({
    where: { id: incidentId },
    data: {
      severity: severity as Severity | null,
      category: category as Issue['category'],
      priority: priority.score,
      priorityLevel: priority.level,
    },
  });
}