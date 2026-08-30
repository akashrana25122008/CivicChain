import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/server/api';
import { requireRole } from '@/lib/server/session';
import { prisma } from '@/lib/db';
import { stat } from 'node:fs/promises';

/**
 * ADMIN-only system health probe. Each check fails independently instead of
 * taking the whole endpoint down, so operators can see exactly what broke.
 */
export async function GET() {
  try {
    await requireRole('ADMIN');

    const [database, postgis, storage] = await Promise.all([
      prisma.$queryRaw`SELECT 1 AS ok`.then(() => ({ ok: true as const })).catch((e: unknown) => ({
        ok: false as const,
        error: e instanceof Error ? e.message.slice(0, 160) : 'connection failed',
      })),
      prisma.$queryRaw<Array<{ version: string }>>`SELECT postgis_version() AS version`
        .then((rows) => ({ ok: true as const, version: rows[0]?.version ?? 'unknown' }))
        .catch((e: unknown) => ({
          ok: false as const,
          error: e instanceof Error ? e.message.slice(0, 160) : 'postgis unavailable',
        })),
      stat(process.env.EVIDENCE_STORAGE_DIR || 'public/uploads')
        .then((s) => ({ ok: true as const, writable: s.isDirectory() }))
        .catch(() => ({ ok: false as const, error: 'storage directory missing' })),
    ]);

    const authSecret = Boolean(process.env.AUTH_SECRET);
    const authEmailConfigured = Boolean(process.env.EMAIL_SERVER);

    const [users, issues, auditLogs, notificationsUnread, escalationsOpen, pendingEvidence, verifications] =
      await Promise.all([
        prisma.user.count(),
        prisma.issue.count(),
        prisma.auditLog.count(),
        prisma.notification.count({ where: { read: false } }),
        prisma.escalation.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
        prisma.evidence.count({
          where: { verifications: { none: { status: 'VERIFIED' } } },
        }),
        prisma.verification.count(),
      ]);

    return NextResponse.json({
      checks: {
        database,
        postgis,
        auth: {
          ok: authSecret,
          note: authSecret
            ? 'AUTH_SECRET configured'
            : 'AUTH_SECRET missing — sessions cannot be trusted',
        },
        email: {
          ok: authEmailConfigured,
          note: authEmailConfigured
            ? 'EMAIL_SERVER configured'
            : 'EMAIL_SERVER not configured — dev magic-link preview is active',
        },
        storage,
      },
      totals: { users, issues, auditLogs, notificationsUnread, escalationsOpen, pendingEvidence, verifications },
    });
  } catch (error) {
    return handleApiError(error);
  }
}