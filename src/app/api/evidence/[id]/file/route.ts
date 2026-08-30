import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/session';
import { handleApiError, notFound, forbidden } from '@/lib/server/api';
import { readEvidenceFile } from '@/lib/server/storage';
import { prisma } from '@/lib/db';

export interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/evidence/[id]/file — serves a private uploaded evidence object.
 *
 * Uploaded evidence is stored privately (never a public /uploads path). This
 * route re-checks authorization against the live database for every request
 * and streams the bytes back. Storage credentials and object keys never reach
 * the browser. External URL evidence is not stored here and has no file body.
 */
export async function GET(request: NextRequest, ctx: RouteContext) {
  try {
    const viewer = await requireUser();
    const { id } = await ctx.params;

    const evidence = await prisma.evidence.findUnique({
      where: { id },
      include: {
        issue: { select: { reporterId: true, authorityId: true } },
      },
    });
    if (!evidence) throw notFound('Evidence');
    if (evidence.type === 'URL') {
      throw forbidden();
    }

    // Authorization: reporter (owner), assigned authority, or admin.
    const issue = evidence.issue;
    let allowed = false;
    if (viewer.role === 'ADMIN') {
      allowed = true;
    } else if (viewer.role === 'AUTHORITY') {
      const authority = await prisma.authority.findFirst({
        where: { userId: viewer.id },
        select: { id: true },
      });
      allowed = Boolean(authority && authority.id === issue?.authorityId);
    } else {
      allowed = issue?.reporterId === viewer.id;
    }
    if (!allowed) throw forbidden();

    const { data, mimeType } = await readEvidenceFile(evidence.url);
    const body = new Blob([new Uint8Array(data)]);
    // Prefer the validated, canonical MIME recorded at intake over whatever
    // the storage backend reports on read.
    const contentType = evidence.mimeType || mimeType || 'application/octet-stream';

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(data.byteLength),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}