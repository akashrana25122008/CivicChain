import { NextRequest, NextResponse } from 'next/server';
import {
  handleApiError,
  ApiError,
  badRequest,
  notFound,
  forbidden,
} from '@/lib/server/api';
import { requireUser } from '@/lib/server/session';
import { requireOwnAuthority, authorityOwnsIssue } from '@/lib/server/dept';
import { recordAudit } from '@/lib/server/audit';
import { createNotification } from '@/lib/server/notify';
import { serializeEvidenceQueueItem } from '@/lib/issues/serialize';
import { prisma } from '@/lib/db';

const EVIDENCE_INCLUDE = {
  orderBy: { createdAt: 'asc' as const },
  include: {
    issue: { select: { id: true, publicId: true, title: true, status: true } },
    verifications: {
      orderBy: { createdAt: 'desc' as const },
      include: { verifier: { select: { name: true, email: true } } },
    },
  },
} as const;

function summarize(items: ReturnType<typeof serializeEvidenceQueueItem>[]) {
  return {
    needsReview: items.filter((i) => i.verification?.status !== 'VERIFIED').length,
    verified: items.filter((i) => i.verification?.status === 'VERIFIED').length,
    rejected: items.filter((i) => i.verification?.status === 'REJECTED').length,
  };
}

/** Evidence verification queue — own-authority issues only. */
export async function GET() {
  try {
    const user = await requireUser();
    const authority = await requireOwnAuthority(user);

    const evidence = await prisma.evidence.findMany({
      where: { issue: { authorityId: authority.id } },
      ...EVIDENCE_INCLUDE,
    });
    const items = evidence.map((ev) => serializeEvidenceQueueItem(ev, ev.issue!));

    return NextResponse.json({ items, counts: summarize(items) });
  } catch (error) {
    return handleApiError(error);
  }
}

const VERIFY_PAYLOAD = {
  evidenceId: (v: unknown): v is string => typeof v === 'string' && v.length > 0,
  status: (v: unknown): v is 'VERIFIED' | 'REJECTED' => v === 'VERIFIED' || v === 'REJECTED',
  note: (v: unknown): string | null =>
    typeof v === 'string' && v.trim().length > 0 ? v.trim().slice(0, 500) : null,
};

/**
 * Record a manual verification decision on an evidence item. Each decision
 * appends a Verification row (the full history is the audit trail); the UI
 * always reads the most recent one.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const authority = await requireOwnAuthority(user);

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(400, 'INVALID_INPUT', 'Request body must be JSON.');
    }
    if (!VERIFY_PAYLOAD.evidenceId(body.evidenceId)) {
      throw badRequest('A valid "evidenceId" is required.');
    }
    if (!VERIFY_PAYLOAD.status(body.status)) {
      throw badRequest('"status" must be VERIFIED or REJECTED.');
    }
    const note = VERIFY_PAYLOAD.note(body.note);

    const evidence = await prisma.evidence.findUnique({
      where: { id: body.evidenceId },
      include: { issue: { select: { id: true, authorityId: true, publicId: true, reporterId: true } } },
    });
    if (!evidence) throw notFound('Evidence');
    if (!authorityOwnsIssue(authority, evidence.issue?.authorityId ?? null)) {
      throw forbidden();
    }

    const verification = await prisma.verification.create({
      data: {
        issueId: evidence.issue!.id,
        verifierId: user.id,
        evidenceId: evidence.id,
        status: body.status,
        note,
      },
    });

    await recordAudit({
      actorId: user.id,
      issueId: evidence.issue!.id,
      action: 'VERIFICATION_CREATED',
      entityType: 'Evidence',
      entityId: evidence.id,
      metadata: { status: body.status, verificationId: verification.id, note },
    });

    if (evidence.issue!.reporterId !== user.id) {
      await createNotification({
        userId: evidence.issue!.reporterId,
        issueId: evidence.issue!.id,
        type: 'VERIFICATION_CREATED',
        title:
          body.status === 'VERIFIED'
            ? `Evidence verified for ${evidence.issue!.publicId}`
            : `Evidence rejected for ${evidence.issue!.publicId}`,
        message:
          body.status === 'VERIFIED'
            ? 'Your attached evidence was confirmed by the department.'
            : 'Your attached evidence could not be confirmed. Check the note and report again if needed.',
      });
    }

    const fresh = await prisma.evidence.findUnique({
      where: { id: evidence.id },
      include: {
        issue: { select: { id: true, publicId: true, title: true, status: true } },
        verifications: {
          orderBy: { createdAt: 'desc' as const },
          include: { verifier: { select: { name: true, email: true } } },
        },
      },
    });
    return NextResponse.json(
      { item: serializeEvidenceQueueItem(fresh!, fresh!.issue!) },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}