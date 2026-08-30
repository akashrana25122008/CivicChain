import { prisma } from '@/lib/db';
import { recordAudit } from '@/lib/server/audit';
import { createNotification } from '@/lib/server/notify';
import { getAuthorityDepartmentForCategory } from '@/lib/issues/mapping';
import type { CreateReportInput } from '@/lib/validation/report';

export interface CreateIssueResult {
  issueId: string;
  publicId: string;
}

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

  let authorityId: string | null = null;
  const department = getAuthorityDepartmentForCategory(data.category);
  if (department) {
    const authority = await prisma.authority.findFirst({
      where: { department },
      select: { id: true },
    });
    authorityId = authority?.id ?? null;
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
        location: data.location || null,
        contact: data.contact || null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        reporterId,
        authorityId,
      },
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

  return result;
}