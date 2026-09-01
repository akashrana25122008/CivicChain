import { NextRequest, NextResponse, after } from 'next/server';
import type { File as FormFile } from 'node:buffer';
import { requireUser } from '@/lib/server/session';
import { handleApiError, ApiError, badRequest, notFound, forbidden } from '@/lib/server/api';
import { createReport } from '@/lib/issues/create';
import { queryIssueList } from '@/lib/issues/query';
import { serializeIssueDetail } from '@/lib/issues/serialize';
import { storeEvidenceFile, deleteEvidenceFile } from '@/lib/server/storage';
import { assertValidEvidenceFile } from '@/lib/validation/evidence';
import { sanitizeUpload } from '@/lib/security/fileScan';
import { createReportSchema } from '@/lib/validation/report';
import { transitionIssue, allowedTransitionsFor } from '@/lib/issues/transition';
import { runReportIntelligence, ensureReportIntelligence } from '@/lib/server/intelligence/pipeline';
import { prisma } from '@/lib/db';
import {
  IssueStatus,
  type User,
} from '../../../generated/prisma/client';

/**
 * Shared HTTP handlers for the report pipeline. Both the Phase 1 route surface
 * (/api/issues) and the Phase 2 surface (/api/reports) delegate here — one
 * implementation, no duplicate endpoints or drift.
 */

const MAX_FILES = 10;

const KNOWN_STATUSES = new Set<string>(Object.values(IssueStatus));
function isKnownStatus(input: string): boolean {
  return KNOWN_STATUSES.has(input);
}

async function collectEvidenceInput(form: FormData): Promise<{
  fileEntries: FormFile[];
  evidenceUrls: string[];
}> {
  const fileEntries: FormFile[] = [];
  const evidenceUrls: string[] = [];
  for (const [key, value] of form.entries()) {
    if (value instanceof File) {
      if (fileEntries.length >= MAX_FILES) break;
      fileEntries.push(value as unknown as FormFile);
    } else if (key === 'evidenceUrl' && typeof value === 'string' && value.trim()) {
      evidenceUrls.push(value.trim());
    }
  }
  if (fileEntries.length > MAX_FILES) {
    throw badRequest('At most 10 evidence files per report.');
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
  return { fileEntries, evidenceUrls };
}

const get = (form: FormData, k: string) => (form.get(k) as string | null) ?? '';

async function fileBuffers(files: FormFile[]): Promise<Buffer[]> {
  return Promise.all(files.map(async (f) => Buffer.from(await f.arrayBuffer())));
}

/**
 * POST /api/reports (and /api/issues) — creates a real civic issue.
 * Reporter is always derived from the authenticated session; the client can
 * never choose identity, role, status, or audit actor.
 */
export async function createReportHttp(request: NextRequest): Promise<NextResponse> {
  const storedKeys: string[] = [];
  try {
    const sender = await requireUser();

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw badRequest('Request must be multipart/form-data.');
    }
    if (!(form instanceof FormData)) throw badRequest('Request must be multipart/form-data.');

    const { fileEntries, evidenceUrls } = await collectEvidenceInput(form);

    const parsed = createReportSchema.safeParse({
      title: get(form, 'title'),
      category: get(form, 'category') as never,
      description: get(form, 'description'),
      location: get(form, 'location'),
      contact: get(form, 'contact'),
      latitude: get(form, 'latitude') ? Number(get(form, 'latitude')) : null,
      longitude: get(form, 'longitude') ? Number(get(form, 'longitude')) : null,
      accuracy: get(form, 'accuracy') ? Number(get(form, 'accuracy')) : null,
      evidence: evidenceUrls.map((url) => ({ type: 'URL' as const, url })),
    });
    if (!parsed.success) {
      throw new ApiError(400, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Invalid report.');
    }

    const buffers = await fileBuffers(fileEntries);
    const evidenceFiles = [] as Array<{
      url: string;
      fileName?: string | null;
      mimeType?: string | null;
      sizeBytes?: number | null;
    }>;
    for (let i = 0; i < fileEntries.length; i += 1) {
      const file = fileEntries[i];
      // Server-side validation: magic bytes, declared MIME, extension, size,
      // structure. A rejected file raises a user-safe error BEFORE storage.
      const { mimeType, detected } = assertValidEvidenceFile({
        buffer: buffers[i],
        originalName: file.name,
        declaredMime: file.type,
      });
      // Phase 21: malware/polyglot scan + image metadata (EXIF/GPS) stripping.
      const sanitized = await sanitizeUpload({ buffer: buffers[i], kind: detected });
      if (!sanitized.clean) {
        throw new ApiError(400, 'FILE_REJECTED', sanitized.reason ?? 'File failed security scan.');
      }
      const stored = await storeEvidenceFile({
        buffer: sanitized.buffer,
        mimeType,
        originalName: file.name,
      });
      storedKeys.push(stored.url);
      evidenceFiles.push({
        url: stored.url,
        fileName: stored.fileName,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
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
        accuracy: parsed.data.accuracy ?? null,
        evidence: parsed.data.evidence ?? [],
      },
      evidenceFiles,
      ipAddress: request.headers.get('x-forwarded-for'),
    });

    // Real AI analysis + re-clustering run after the response is flushed;
    // the client observes PENDING -> PROCESSING -> COMPLETED/FAILED by polling.
    after(() => runReportIntelligence(created.issueId).catch(() => undefined));

    const duplicate = created.duplicate
      ? {
          candidateIssueId: created.duplicate.candidateIssueId,
          candidatePublicId: created.duplicate.candidatePublicId,
          confidence: Number(created.duplicate.confidence.toFixed(3)),
          band: created.duplicate.band,
          distanceMeters: created.duplicate.distanceMeters,
        }
      : null;

    return NextResponse.json(
      {
        issue: { id: created.issueId, publicId: created.publicId },
        analysisStatus: 'PENDING',
        duplicate,
      },
      { status: 201 },
    );
  } catch (error) {
    // Never leave orphaned objects behind when the report failed.
    for (const key of storedKeys) {
      await deleteEvidenceFile(key);
    }
    return handleApiError(error);
  }
}

/**
 * GET /api/reports — role-scoped report listing (server-side filtering +
 * pagination). Citizens see only their own; authorities their department's;
 * admins all.
 */
export async function listReportsHttp(request: NextRequest): Promise<NextResponse> {
  try {
    const viewer = await requireUser();
    const { searchParams } = request.nextUrl;

    let reporterId: string | null = null;
    let authorityId: string | null = null;

    if (viewer.role === 'CITIZEN') {
      reporterId = viewer.id;
    } else if (viewer.role === 'AUTHORITY') {
      const authority = await prisma.authority.findFirst({
        where: { userId: viewer.id },
        select: { id: true },
      });
      authorityId = authority?.id ?? '__none__';
    }
    // ADMIN: no scope — full system view.

    const result = await queryIssueList({
      viewerId: viewer.id,
      revealReporter: viewer.role === 'AUTHORITY' || viewer.role === 'ADMIN',
      reporterId,
      authorityId,
      q: searchParams.get('q'),
      category: searchParams.get('category'),
      status: searchParams.get('status'),
      sort: (searchParams.get('sort') as 'newest' | 'oldest' | 'updated') ?? 'newest',
      page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
      pageSize: searchParams.get('pageSize') ? Number(searchParams.get('pageSize')) : 25,
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

async function authorizeReportDetail(viewer: User, issue: {
  reporterId: string;
  authorityId: string | null;
}): Promise<void> {
  if (viewer.role === 'ADMIN') return;
  if (viewer.role === 'AUTHORITY') {
    const authority = await prisma.authority.findFirst({
      where: { userId: viewer.id },
      select: { id: true },
    });
    if (!authority || authority.id !== issue.authorityId) throw forbidden();
    return;
  }
  if (issue.reporterId !== viewer.id) throw forbidden();
}

const ISSUE_INCLUDE = {
  authority: { include: { department: { select: { name: true } } } },
  promise: true,
  evidence: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      verifications: {
        orderBy: { createdAt: 'desc' as const },
        include: { verifier: { select: { name: true, email: true } } },
      },
    },
  },
  auditEvents: { orderBy: { createdAt: 'asc' as const } },
  aiAnalysis: true,
  incident: {
    include: {
      issues: { select: { id: true, publicId: true, status: true } },
    },
  },
  votes: { select: { type: true } },
} as const;

/** GET /api/reports/[id] — ownership/RBAC-enforced detail. */
export async function getReportDetailHttp(request: NextRequest, id: string): Promise<NextResponse> {
  try {
    const viewer = await requireUser();
    const issue = await prisma.issue.findUnique({ where: { id }, include: ISSUE_INCLUDE });
    if (!issue) throw notFound('Report');
    await authorizeReportDetail(viewer, issue);

    // Resume-on-read: a PENDING/abandoned PROCESSING analysis self-heals.
    after(() => ensureReportIntelligence(id).catch(() => undefined));

    return NextResponse.json({
      issue: serializeIssueDetail({
        issue,
        authority: issue.authority,
        promise: issue.promise,
        evidence: issue.evidence,
        auditEvents: issue.auditEvents,
        viewerId: viewer.id,
        revealContact: viewer.role === 'ADMIN' || viewer.role === 'AUTHORITY',
        allowedTransitions: await allowedTransitionsFor(viewer, issue),
      }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/reports/[id] (and /api/issues/[id]).
 *
 * Handles non-lifecycle metadata and, via the single transition authority,
 * validated lifecycle moves. Crucially, PATCH cannot set status to ANY value:
 * the requested status is validated against the transition graph by
 * `transitionIssue()` (the one place that mutates Issue.status), so arbitrary
 * jumps like PATCH {status:"RESOLVED"} from SUBMITTED are rejected. Callers
 * wanting the explicit workflow should prefer the domain-action endpoints
 * (/resolve, /reopen, /verify, /escalate, /analyze).
 */
export async function patchReportHttp(request: NextRequest, id: string): Promise<NextResponse> {
  try {
    const actor = await requireUser();

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(400, 'INVALID_INPUT', 'Request body must be JSON.');
    }

    // Metadata updates are not yet editable via this surface. Status moves are
    // allowed ONLY when valid in the state graph, via the transition authority.
    if ('status' in body && body.status !== undefined) {
      if (typeof body.status !== 'string' || !isKnownStatus(body.status)) {
        throw new ApiError(400, 'INVALID_INPUT', 'A valid "status" value is required.');
      }
      const { unchanged } = await transitionIssue({
        issueId: id,
        actor,
        nextStatus: body.status as IssueStatus,
      });
      if (unchanged) {
        return NextResponse.json({ unchanged: true });
      }
    }

    const updated = await prisma.issue.findUnique({ where: { id }, include: ISSUE_INCLUDE });
    if (!updated) throw notFound('Report');

    return NextResponse.json({
      issue: serializeIssueDetail({
        issue: updated,
        authority: updated.authority,
        promise: updated.promise,
        evidence: updated.evidence,
        auditEvents: updated.auditEvents,
        viewerId: actor.id,
        revealContact: actor.role === 'ADMIN' || actor.role === 'AUTHORITY',
        allowedTransitions: await allowedTransitionsFor(actor, updated),
      }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}