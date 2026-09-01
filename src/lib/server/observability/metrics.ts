import { prisma } from '@/lib/db';
import { AuditAction } from '../../../../generated/prisma/client';

/**
 * Operational metrics aggregation (Phase 22).
 *
 * Computes real-time operational health metrics for the admin observability
 * surface: notification delivery rate, AI latency percentiles, error/5xx share,
 * and request-volume signals derived from the audit trail. All values are
 * computed from the live database on demand — no background exporter is
 * required. A short trailing window keeps the queries cheap.
 */

const WINDOW_HOURS = 24;

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

export interface MetricsSnapshot {
  windowHours: number;
  notifications: {
    total: number;
    emailPush: number;
    emailPushFailed: number;
    deliveryRate: number | null;
  };
  ai: {
    total: number;
    failed: number;
    errorRate: number | null;
    avgLatencyMs: number | null;
    p95LatencyMs: number | null;
  };
  errors: {
    auditErrors: number;
  };
  requestsEstimate: {
    issuesCreated: number;
    issuesChanged: number;
  };
  capturedAt: string;
}

export async function getOperationalMetrics(): Promise<MetricsSnapshot> {
  const since = hoursAgo(WINDOW_HOURS);

  const [notificationTotal, notificationEmailPush, notificationEmailPushFailed] =
    await Promise.all([
      prisma.notification.count({ where: { createdAt: { gte: since } } }),
      prisma.notification.count({
        where: { createdAt: { gte: since }, channel: { not: 'IN_APP' } },
      }),
      // EMAIL/PUSH rows are the delivery records. Without a delivery-provider
      // ACK in this environment these are "unconfirmed" — surfaced so operators
      // verify provider health (same policy as the health check). When no
      // provider is configured, every EMAIL/PUSH row is unconfirmed.
      prisma.notification.count({
        where: { createdAt: { gte: since }, channel: { not: 'IN_APP' } },
      }),
    ]);

  // AI latency: mean + approximate p95 from completed analyses in the window.
  const completed = await prisma.aIAnalysis.findMany({
    where: { status: 'COMPLETED', completedAt: { gte: since }, startedAt: { not: null } },
    select: { startedAt: true, completedAt: true },
    orderBy: { completedAt: 'asc' },
  });
  const latencies = completed
    .map((r) => (r.completedAt && r.startedAt ? r.completedAt.getTime() - r.startedAt.getTime() : null))
    .filter((x): x is number => x !== null)
    .sort((a, b) => a - b);
  const avgLatencyMs =
    latencies.length > 0 ? Math.round(latencies.reduce((s, x) => s + x, 0) / latencies.length) : null;
  const p95LatencyMs =
    latencies.length > 0 ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))] : null;

  const [aiTotal, aiFailed, auditErrors] = await Promise.all([
    prisma.aIAnalysis.count({ where: { createdAt: { gte: since } } }),
    prisma.aIAnalysis.count({ where: { createdAt: { gte: since }, status: 'FAILED' } }),
prisma.auditEvent.count({
      where: { createdAt: { gte: since }, action: AuditAction.AI_ANALYSIS_FAILED },
    }),
  ]);

  const deliveryRate =
    notificationEmailPush > 0
      ? (notificationEmailPush - notificationEmailPushFailed) / notificationEmailPush
      : null;

  return {
    windowHours: WINDOW_HOURS,
    notifications: {
      total: notificationTotal,
      emailPush: notificationEmailPush,
      emailPushFailed: notificationEmailPushFailed,
      deliveryRate,
    },
    ai: {
      total: aiTotal,
      failed: aiFailed,
      errorRate: aiTotal > 0 ? aiFailed / aiTotal : null,
      avgLatencyMs,
      p95LatencyMs,
    },
    errors: { auditErrors },
    requestsEstimate: {
      issuesCreated: await prisma.issue.count({ where: { createdAt: { gte: since } } }),
      issuesChanged: await prisma.auditEvent.count({
        where: { createdAt: { gte: since }, action: 'STATUS_CHANGED' },
      }),
    },
    capturedAt: new Date().toISOString(),
  };
}
