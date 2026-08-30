import { NextRequest, NextResponse } from 'next/server';
import type { File as FormFile } from 'node:buffer';
import { requireUser } from '@/lib/server/session';
import { handleApiError, ApiError, badRequest, unauthorized } from '@/lib/server/api';
import { prisma } from '@/lib/db';
import { serializeIssueListRow } from '@/lib/issues/serialize';
import { createReport } from '@/lib/issues/create';
import { storeEvidenceFile } from '@/lib/server/storage';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import {
  ACCEPTED_IMAGE_MIMES,
  ACCEPTED_VIDEO_MIMES,
  MAX_UPLOAD_BYTES,
  createReportSchema,
} from '@/lib/validation/report';
import type { IssueCategory } from '../../../../generated/prisma/client';

const ISSUE_INCLUDE = {
  authority: true,
  promise: { include: { createdBy: true } },
} as const;

export async function GET() {
  try {
    const viewer = await requireUser();
    const issues = await prisma.issue.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { authority: true, promise: true },
    });
    return NextResponse.json({
      issues: issues.map((issue) =>
        serializeIssueListRow({ issue, authority: issue.authority, promise: issue.promise, viewerId: viewer.id }),
      ),
      total: issues.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

async function collectFileBuffers(files: FormFile[]): Promise<Buffer[]> {
  return Promise.all(files.map(async (f) => Buffer.from(await f.arrayBuffer())));
}

export async function POST(request: NextRequest) {
  const storedFiles: string[] = [];
  try {
    const sender = await requireUser();

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw badRequest('Request must be multipart/form-data.');
    }

    const get = (k: string) => (form.get(k) as string | null) ?? '';

    const fileEntries: FormFile[] = [];
    const evidenceUrls: string[] = [];
    for (const [key, value] of form.entries()) {
      if (value instanceof File) {
        if (fileEntries.length >= 10) break;
        fileEntries.push(value as unknown as FormFile);
      } else if (key === 'evidenceUrl' && typeof value === 'string' && value.trim()) {
        evidenceUrls.push(value.trim());
      }
    }
    if (fileEntries.length > 10) {
      throw badRequest('At most 10 evidence files per report.');
    }
    for (const f of fileEntries) {
      if (!ACCEPTED_IMAGE_MIMES.has(f.type) && !ACCEPTED_VIDEO_MIMES.has(f.type)) {
        throw badRequest(`Unsupported file type "${f.type || 'unknown'}" for "${f.name}".`);
      }
      if (f.size > MAX_UPLOAD_BYTES) {
        throw badRequest(`"${f.name}" exceeds the 10 MB file limit.`);
      }
    }
    for (const url of evidenceUrls) {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        throw badRequest(`Invalid evidence URL: ${url}`);
      }
      if (!/^https?:$/.test(parsed.protocol)) {
        throw badRequest(`Evidence URL must use http(s): ${url}`);
      }
    }

    const parsed = createReportSchema.safeParse({
      title: get('title'),
      category: get('category') as IssueCategory,
      description: get('description'),
      location: get('location'),
      contact: get('contact'),
      latitude: get('latitude') ? Number(get('latitude')) : null,
      longitude: get('longitude') ? Number(get('longitude')) : null,
      evidence: evidenceUrls.map((url) => ({ type: 'URL' as const, url })),
    });
    if (!parsed.success) {
      throw new ApiError(400, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Invalid report.');
    }

    const buffers = await collectFileBuffers(fileEntries);
    const evidenceFiles = [] as Array<{
      url: string; fileName?: string | null; mimeType?: string | null; sizeBytes?: number | null;
    }>;
    for (let i = 0; i < fileEntries.length; i += 1) {
      const { url: storedUrl, fileName } = await storeEvidenceFile({
        buffer: buffers[i],
        mimeType: fileEntries[i].type,
        originalName: fileEntries[i].name,
      });
      storedFiles.push(storedUrl);
      evidenceFiles.push({
        url: storedUrl,
        fileName,
        mimeType: fileEntries[i].type,
        sizeBytes: fileEntries[i].size,
      });
    }

    const created = await createReport({
      reporterId: sender.id,
      data: {
        title: parsed.data.title,
        category: parsed.data.category,
        description: parsed.data.description || undefined,
        location: parsed.data.location || undefined,
        contact: parsed.data.contact || undefined,
        latitude: parsed.data.latitude ?? null,
        longitude: parsed.data.longitude ?? null,
        evidence: parsed.data.evidence ?? [],
      },
      evidenceFiles,
      ipAddress: request.headers.get('x-forwarded-for'),
    });

    return NextResponse.json(
      { issue: { id: created.issueId, publicId: created.publicId } },
      { status: 201 },
    );
  } catch (error) {
    // Never leave orphaned uploads behind when the report failed.
    const dir = process.env.EVIDENCE_STORAGE_DIR || 'public/uploads';
    await Promise.all(
      storedFiles.map(async (url) => {
        const name = url.replace(/^\/uploads\//, '');
        await rm(join(dir, name), { force: true }).catch(() => undefined);
      }),
    );
    return handleApiError(error);
  }
}