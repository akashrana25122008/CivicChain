import { NextRequest, NextResponse } from 'next/server';
import type { File as FormFile } from 'node:buffer';
import { handleApiError, badRequest } from '@/lib/server/api';
import { requireUser } from '@/lib/server/session';
import { addIssueEvidence } from '@/lib/issues/actions';
import { storeEvidenceFile, deleteEvidenceFile } from '@/lib/server/storage';
import { assertValidEvidenceFile } from '@/lib/validation/evidence';
import { queryIssueEvidence } from '@/lib/issues/query';
import { prisma } from '@/lib/db';

export interface RouteContext {
  params: Promise<{ id: string }>;
}

const MAX_FILES = 10;

async function collectFiles(form: FormData): Promise<FormFile[]> {
  const files: FormFile[] = [];
  for (const value of form.values()) {
    if (value instanceof File) {
      if (files.length >= MAX_FILES) break;
      files.push(value as unknown as FormFile);
    }
  }
  if (files.length > MAX_FILES) throw badRequest('At most 10 evidence files per issue.');
  if (files.length === 0) throw badRequest('Multipart form must include at least one "file" part.');
  return files;
}

/**
 * POST /api/issues/:id/evidence — attach evidence to a civic issue.
 * Canonical evidence resource (Issue └── Evidence[]). Files are validated
 * server-side (magic bytes / MIME / size), stored privately, and persisted via
 * the Issue domain action. Reporter, assigned authority, or admin only.
 */
export async function POST(request: NextRequest, ctx: RouteContext) {
  const storedKeys: string[] = [];
  try {
    const actor = await requireUser();
    const { id } = await ctx.params;

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw badRequest('Request must be multipart/form-data.');
    }
    const files = await collectFiles(form);

    const buffers = await Promise.all(files.map(async (f) => Buffer.from(await f.arrayBuffer())));
    const metadata: Array<{ url: string; fileName?: string | null; mimeType?: string | null; sizeBytes?: number | null }> = [];
    for (let i = 0; i < files.length; i += 1) {
      const { mimeType } = assertValidEvidenceFile({
        buffer: buffers[i],
        originalName: files[i].name,
        declaredMime: files[i].type,
      });
      const stored = await storeEvidenceFile({ buffer: buffers[i], mimeType, originalName: files[i].name });
      storedKeys.push(stored.url);
      metadata.push({
        url: stored.url,
        fileName: stored.fileName,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
      });
    }

    const result = await addIssueEvidence({ issueId: id, actor, files: metadata });

    const evidence = await queryIssueEvidence({ issueId: id, viewerId: actor.id });
    return NextResponse.json({ count: result.count, evidence }, { status: 201 });
  } catch (error) {
    for (const key of storedKeys) await deleteEvidenceFile(key);
    return handleApiError(error);
  }
}

/**
 * GET /api/issues/:id/evidence — list evidence for an issue. Authorized per the
 * same rules as issue detail (owner / assigned authority / admin).
 */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const actor = await requireUser();
    const { id } = await ctx.params;
    const issue = await prisma.issue.findUnique({
      where: { id },
      select: { id: true, reporterId: true, authorityId: true },
    });
    if (!issue) throw badRequest('Issue not found.');
    const isOwner = issue.reporterId === actor.id;
    const isAdmin = actor.role === 'ADMIN';
    let isAuthority = false;
    if (actor.role === 'AUTHORITY' && issue.authorityId) {
      const authority = await prisma.authority.findUnique({ where: { userId: actor.id } });
      isAuthority = !!authority && authority.id === issue.authorityId;
    }
    if (!isOwner && !isAdmin && !isAuthority) {
      throw badRequest('You do not have access to this issue.');
    }
    const evidence = await queryIssueEvidence({ issueId: id, viewerId: actor.id });
    return NextResponse.json({ evidence });
  } catch (error) {
    return handleApiError(error);
  }
}
