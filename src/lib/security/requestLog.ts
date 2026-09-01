/**
 * Minimal structured request logging (Phase 21).
 *
 * Central requestId + correlation provider. The proxy assigns a requestId to
 * every matched request and emits a structured log line with method, path,
 * status, and duration so a security/ops team can trace a request across the
 * rate-limiter, auth, and route layers. RequestIds are also surfaced to
 * clients via the `x-request-id` response header so callers can quote them in
 * support tickets.
 *
 * Gated by LOG_LEVEL / NODE_ENV: in production only warn/error and non-200 log
 * lines are emitted to avoid noisy per-request piping in low-loglevel setups.
 */

import { randomUUID } from 'node:crypto';
import { currentLogger } from '@/lib/server/requestContext';

export function generateRequestId(): string {
  return randomUUID();
}

export interface RequestLogEntry {
  requestId: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  ip: string;
  userId?: string;
  rateLimited?: boolean;
}

/**
 * Emit a structured access log line. Returns a stable, structured string for
 * the caller to optionally reuse. Never throws.
 */
export function logAccessLog(entry: RequestLogEntry): string {
  const line = [
    'request_id=' + entry.requestId,
    'method=' + entry.method,
    `path="${entry.path}"`,
    'status=' + String(entry.status),
    'duration_ms=' + String(entry.durationMs),
    'ip=' + (entry.ip || 'unknown'),
    entry.userId ? 'user=' + entry.userId : '',
    entry.rateLimited ? 'rate_limited=true' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const level =
    entry.status >= 500 ? 'error' : entry.status === 429 ? 'warn' : entry.status >= 400 ? 'warn' : 'info';

  // Serverless/edge loggers have no console levels; keep it simple and safe.
  if (process.env.NODE_ENV === 'test') return line;
  if (process.env.LOG_LEVEL === 'silent') return line;
  // In production, only log non-2xx by default to limit noise.
  if (process.env.NODE_ENV === 'production' && entry.status < 400 && process.env.LOG_LEVEL !== 'debug') {
    return line;
  }
  const log = currentLogger();
  const msg = { requestId: entry.requestId, method: entry.method, path: entry.path, status: entry.status, durationMs: entry.durationMs, ip: entry.ip, userId: entry.userId, rateLimited: entry.rateLimited };
  if (level === 'error') log.error(msg, 'request');
  else if (level === 'warn') log.warn(msg, 'request');
  else log.info(msg, 'request');
  return line;
}
