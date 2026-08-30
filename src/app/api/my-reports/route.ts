import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/session';
import { handleApiError } from '@/lib/server/api';
import { serializeIssueListRow } from '@/lib/issues/serialize';
import { prisma } from '@/lib/db';

/**
 * Reports created by the signed-in citizen, strictly owner-scoped:
 * the reporterId is always taken from the session — never from the client.
 */
export async function GET() {
  try {
    const viewer = await requireUser();
    const issues = await prisma.issue.findMany({
      where: { reporterId: viewer.id },
      orderBy: { createdAt: 'desc' },
      take: 200,
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