import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getRequestContext, runWithContext } from './requestContext';
import { logger } from './logger';

/**
 * Request-context + timing wrapper for API route handlers (Phase 22).
 *
 * Establishes a request-scoped AsyncLocalStorage context (requestId shared
 * with the proxy's `x-request-id` header, or a freshly generated id) and
 * measures handler execution time. Slow handlers (> 2 s) log at warn, very
 * slow (> 5 s) at error. Non-2xx responses log at warn/error.
 *
 * The wrapper preserves the handler's own parameter typing (Next.js passes a
 * real Request + route context at runtime), so handlers can declare any
 * subset of `(request, ctx)` or none at all. Usage:
 *   export const GET = withRequest(async (req) => { ... });
 *   export const POST = withRequest(async (req, ctx) => { ... });
 *   export const GET = withRequest(async () => { ... });
 */

type RouteContext = { params?: Promise<Record<string, string | string[]>> };

function clientIp(req: { headers: Headers } | undefined): string {
  if (!req) return 'unknown';
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]?.trim() || 'unknown';
  return req.headers.get('x-real-ip') || 'unknown';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withRequest(handler: (...args: any[]) => Promise<NextResponse>): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (req: any, ctx: any) => {
    const fallbackNow = Date.now();
    const existing = getRequestContext();
    const requestId = req?.headers?.get?.('x-request-id') || existing?.requestId || randomUUID();
    const context = {
      requestId,
      logger: (existing?.logger ?? logger).child({ requestId }),
      startedAt: existing?.startedAt ?? fallbackNow,
      ip: existing?.ip ?? clientIp(req),
      userId: existing?.userId,
      role: existing?.role,
    };

    const rctx: RouteContext | undefined = ctx;
    const start = performance.now();
    let status = 500;
    try {
      const response = await runWithContext(context, () => handler(req, rctx));
      status = response.status;
      return response;
    } catch (err) {
      status = 500;
      throw err;
    } finally {
      const durationMs = Math.round(performance.now() - start);
      const pathname = req?.nextUrl?.pathname ?? new URL(req?.url ?? 'http://x').pathname ?? '/';
      const method = req?.method ?? 'GET';
      const meta = { path: pathname, method, status, durationMs };
      if (durationMs > 5000) context.logger.error(meta, 'route completed (very slow)');
      else if (durationMs > 2000) context.logger.warn(meta, 'route completed (slow)');
      else if (status >= 500) context.logger.error(meta, 'route completed');
      else if (status >= 400) context.logger.warn(meta, 'route completed');
      else context.logger.debug(meta, 'route completed');
    }
  };
}
