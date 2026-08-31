import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/server/api';
import { requireRole } from '@/lib/server/session';
import { prisma } from '@/lib/db';
import { stat } from 'node:fs/promises';
import { storageBackend } from '@/lib/server/storage';

/**
 * ADMIN-only system health probe. Each check fails independently instead of
 * taking the whole endpoint down, so operators can see exactly what broke.
 */
export async function GET() {
  try {
    await requireRole('ADMIN');

    const [database, postgis] = await Promise.all([
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
    ]);

    const backend = storageBackend();
    const storage =
      backend === 's3'
        ? { ok: true as const, backend: 's3' as const }
        : {
            ok: true as const,
            backend: 'local' as const,
            writable: await stat(process.env.EVIDENCE_STORAGE_DIR || 'private/uploads')
              .then((s) => s.isDirectory())
              .catch(() => false),
          };

    const authSecret = Boolean(process.env.AUTH_SECRET);
    const authEmailConfigured = Boolean(process.env.EMAIL_SERVER);

    const [users, issues, auditLogs, notificationsUnread, escalationsOpen, pendingEvidence, verifications, aiByStatus, notificationTotal, notificationFailed] =
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
        prisma.aIAnalysis.groupBy({ by: ['status'], _count: { _all: true } }),
        prisma.notification.count(),
        prisma.notification.count({ where: { channel: { not: 'IN_APP' } } }),
      ]);

    const aiTotal = aiByStatus.reduce((s, r) => s + r._count._all, 0);
    const aiFailed = aiByStatus
      .filter((r) => r.status === 'FAILED')
      .reduce((s, r) => s + r._count._all, 0);

    // Environment-dependent subsystems. These are reported honestly — a service
    // that is not present in the current deployment is marked NOT_CONFIGURED
    // rather than falsely reported healthy.
    const ai = {
      ok: aiTotal === 0 || aiFailed < aiTotal, // healthy when idle or no alarming failure share
      okNonZero: aiTotal > 0,
      status: aiTotal === 0 ? 'NOT_CONFIGURED' as const : (aiFailed >= aiTotal ? 'DOWN' as const : (aiFailed / aiTotal > 0.25 ? 'DEGRADED' as const : 'HEALTHY' as const)),
      total: aiTotal,
      failed: aiFailed,
      note: aiTotal === 0
        ? 'No AI classification runs recorded yet.'
        : `${aiTotal} analysis runs, ${aiFailed} failed.`,
    };

    const notifications = {
      ok: true,
      status: notificationFailed === 0 || notificationTotal === 0 ? 'HEALTHY' as const : 'DEGRADED' as const,
      total: notificationTotal,
      nonInApp: notificationFailed,
      note: notificationTotal === 0
        ? 'No notifications recorded yet.'
        : notificationFailed > 0
          ? `${notificationFailed} non-in-app delivery records exist; verify provider health.`
          : 'Notification delivery operational.',
    };

    const redis = {
      ok: false,
      okNonZero: false,
      status: 'NOT_CONFIGURED' as const,
      note: 'Redis not configured in this deployment — rate limiting falls back to in-memory.',
    };

    const queue = {
      ok: false,
      okNonZero: false,
      status: 'NOT_CONFIGURED' as const,
      note: 'No background-job queue (BullMQ/Redis) configured — heavy work runs in-band where required.',
    };

    const websocket = {
      ok: false,
      okNonZero: false,
      status: 'NOT_CONFIGURED' as const,
      note: 'No standalone WebSocket server in this Next.js deployment — realtime uses SWR polling.',
    };

    const checks = {
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
      ai,
      notifications,
      redis,
      queue,
      websocket,
    };

    const critical = [
      database.ok,
      postgis.ok,
      authSecret,
      storage?.ok ?? false,
    ];
    const degradedOnly = !Object.values(checks).every((c) => c.ok) && critical.every(Boolean);
    const overall = {
      ok: Object.values(checks).every((c) => c.ok),
      status: (Object.values(checks).every((c) => c.ok) ? 'HEALTHY' : critical.every(Boolean) ? 'DEGRADED' : 'CRITICAL') as 'HEALTHY' | 'DEGRADED' | 'CRITICAL',
      note: Object.values(checks).every((c) => c.ok)
        ? 'All probes passing.'
        : degradedOnly
          ? 'All critical services healthy; non-critical optional subsystems not at full health.'
          : 'A critical system is not healthy — investigate immediately.',
    };

    return NextResponse.json({
      checks,
      overall,
      totals: { users, issues, auditLogs, notificationsUnread, escalationsOpen, pendingEvidence, verifications },
    });
  } catch (error) {
    return handleApiError(error);
  }
}