import { type PrismaClient } from '../../../generated/prisma/client';
import { getRequestContext } from './requestContext';

/**
 * Prisma query instrumentation (Phase 22).
 *
 * Subscribes to Prisma's `query` event which fires for every query and
 * provides the query statement and duration. Slow queries (> 200 ms) are
 * logged at warn level and very slow queries (> 1 s) at error level. The
 * requestId from AsyncLocalStorage is attached to every log line.
 *
 * Call `instrumentPrisma(prisma)` once at startup after creating the client.
 */
export function instrumentPrisma(prisma: PrismaClient): void {
  const SLOW_MS = 200;
  const VERY_SLOW_MS = 1000;

  // The generated client only exposes the 'query' event type when log options
  // are configured; cast to the query-enabled surface for this close-to-metal
  // instrumentation hook.
  interface QueryEvent {
    duration: number;
    query?: string;
    model?: string;
    action?: string;
  }
  type QueryEnabledClient = { $on(event: 'query', cb: (e: QueryEvent) => void): unknown };
  const queryClient = prisma as unknown as QueryEnabledClient;

  queryClient.$on('query', (e) => {
    const durationMs = Math.round(e.duration);
    if (durationMs < SLOW_MS) return;
    const ctx = getRequestContext();
    const log = ctx?.logger;
    const model = e.model ?? 'unknown';
    const action = e.action ?? 'query';
    const operation = (e.query ?? '').slice(0, 200);
    const meta = { model, action, durationMs, requestId: ctx?.requestId };
    if (durationMs >= VERY_SLOW_MS) {
      log?.error({ ...meta, operation }, 'prisma query (very slow)');
    } else {
      log?.warn({ ...meta, operation }, 'prisma query (slow)');
    }
  });
}
