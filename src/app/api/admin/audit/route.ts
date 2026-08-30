import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/server/api';
import { requireRole } from '@/lib/server/session';
import { prisma } from '@/lib/db';
import type { AuditLogItem } from '@/lib/issues/types';

/** ADMIN-only audit trail of every business action on the platform. */
export async function GET() {
  try {
    await requireRole('ADMIN');
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: {
        actor: { select: { name: true, email: true, role: true } },
        issue: { select: { publicId: true } },
      },
    });
    const items: AuditLogItem[] = logs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      actor: log.actor ? log.actor.name ?? log.actor.email : null,
      issueId: log.issueId,
      issuePublicId: log.issue?.publicId ?? null,
      metadata: log.metadata,
      createdAt: log.createdAt.toISOString(),
    }));
    return NextResponse.json({ logs: items, total: items.length });
  } catch (error) {
    return handleApiError(error);
  }
}