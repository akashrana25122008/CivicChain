import { prisma } from '@/lib/db';
import { recordAudit } from '@/lib/server/audit';
import { createNotification } from '@/lib/server/notify';
import { ApiError } from '@/lib/server/api';
import { reverseGeocode } from '@/lib/server/geocode';
import { getAuthorityDepartmentForCategory } from '@/lib/issues/mapping';
import { hashEvidenceImages, storePriorityForIssue } from '@/lib/server/intelligence/pipeline';
import { assignIncident } from '@/lib/server/intelligence/duplicates/cluster';
import { ensurePromiseForIssue } from '@/lib/sla/promise';
import type { DuplicateVerdict } from '@/lib/server/intelligence/duplicates/engine';
import type { CreateReportInput } from '@/lib/validation/report';

export interface CreateIssueResult {
  issueId: string;
  publicId: string;
  /** Post-persist duplicate sweep result (null = no plausible match). */
  duplicate: DuplicateVerdict | null;
}

/**
 * Duplicate-submission window: a second submission of the same title + category
 * by the same reporter inside this window is treated as an accidental repeat.
 */
export const DUPLICATE_WINDOW_MS = 60_000;

/**
 * Creates a real report in PostgreSQL atomically:
 *   Issue(+publicId) → Evidence rows → AuditLog(REPORT_CREATED) → Notification.
 * Reporter identity comes from the authenticated session, never the request.
 * Evidence file payloads must be persisted BEFORE this call; on failure no
 * silent success: caller removes leftover files and this throws.
 */
export async function createReport(input: {
  reporterId: string;
  data: CreateReportInput;
  evidenceFiles: Array<{ url: string; fileName?: string | null; mimeType?: string | null; sizeBytes?: number | null }>;
  ipAddress?: string | null;
}): Promise<CreateIssueResult> {
  const { reporterId, data } = input;

  // Accidental double submissions (double-click / retry) must not mint two IDs.
  const duplicate = await prisma.issue.findFirst({
    where: {
      reporterId,
      category: data.category,
      title: { equals: data.title, mode: 'insensitive' },
      createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
    },
    select: { publicId: true },
  });
  if (duplicate) {
    throw new ApiError(
      409,
      'DUPLICATE_REPORT',
      `A report with this title was just created (${duplicate.publicId}) — this was treated as a duplicate submission.`,
    );
  }

  let authorityId: string | null = null;
  const department = getAuthorityDepartmentForCategory(data.category);
  if (department) {
    const authority = await prisma.authority.findFirst({
      where: { department },
      select: { id: true },
    });
    authorityId = authority?.id ?? null;
  }

  // Reverse-geocode coordinates when the citizen only provided a pin.
  let location = data.location || null;
  if (!location && data.latitude != null && data.longitude != null) {
    const address = await reverseGeocode(data.latitude, data.longitude);
    if (address) location = address;
  }

  const evidenceMetadata = input.evidenceFiles;

const result = await prisma.$transaction(async (tx) => {
      const counter = await tx.refCounter.upsert({
        where: { id: 1 },
        update: { value: { increment: 1 } },
        create: { id: 1, value: 1090 },
      });
      const publicId = `CC-${counter.value}`;

      const issue = await tx.issue.create({
        data: {
          publicId,
          title: data.title,
          description: data.description || null,
          category: data.category,
          location,
          contact: data.contact || null,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          accuracy: data.accuracy ?? null,
          reporterId,
          authorityId,
        },
      });

      // Phase 3 — every report gets a real AI-analysis run record immediately.
      await tx.aIAnalysis.create({
        data: { issueId: issue.id, status: 'PENDING' },
      });

    if (evidenceMetadata.length > 0) {
      await tx.evidence.createMany({
        data: evidenceMetadata.map((ev) => ({
          issueId: issue.id,
          type: (ev.mimeType?.startsWith('video') ? 'VIDEO' : 'IMAGE') as 'IMAGE' | 'VIDEO',
          url: ev.url,
          fileName: ev.fileName ?? null,
          mimeType: ev.mimeType ?? null,
          sizeBytes: ev.sizeBytes ?? null,
          uploadedById: reporterId,
        })),
      });
    }

    await recordAudit({
      tx,
      actorId: reporterId,
      issueId: issue.id,
      action: 'REPORT_CREATED',
      entityType: 'Issue',
      entityId: issue.id,
      metadata: { publicId },
      ipAddress: input.ipAddress ?? null,
    });

    await createNotification({
      tx,
      userId: reporterId,
      issueId: issue.id,
      type: 'REPORT_CREATED',
      title: `Report ${publicId} received`,
      message: 'Your civic report was recorded and is pending review.',
    });

    return { issueId: issue.id, publicId };
  });

  // Phase 3+4 — post-persist, synchronous duplicate sweep so the citizen gets
  // an immediate "Similar Issue Found" verdict. Evidence hashes are computed
  // first (cheap; previously-persisted rows report 0 work) so the image
  // similarity signal is already available to the sweep; an interim priority is
  // stored too. The full AI run fires async after the response.
  await hashEvidenceImages(result.issueId).catch(() => undefined);
  const { verdict } = await assignIncident(result.issueId);
  await storePriorityForIssue(result.issueId);

  // Phase 6 — if the issue already has a routed authority, form its Promise.
  await ensurePromiseForIssue(result.issueId).catch(() => undefined);

  return { ...result, duplicate: verdict };
}