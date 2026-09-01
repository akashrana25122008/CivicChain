import { AsyncLocalStorage } from 'node:async_hooks';
import type pino from 'pino';
import { logger as rootLogger } from './logger';

/**
 * Request-scoped context (Phase 22).
 *
 * AsyncLocalStorage propagates the requestId and a child logger through the
 * entire async call stack of a single HTTP request. Any code running inside a
 * request handler can call `getRequestContext()` to obtain the current
 * requestId and logger without threading parameters through every function.
 */

export interface RequestContext {
  requestId: string;
  logger: pino.Logger;
  /** Timestamp when the request was received (ms since epoch). */
  startedAt: number;
  /** Client IP extracted by the proxy. */
  ip: string;
  /** Authenticated user ID, set after auth verification. */
  userId?: string;
  /** Authenticated user role, set after auth verification. */
  role?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/**
 * Execute a function within a request context. The proxy calls this once per
 * matched request; all downstream code inherits the context.
 */
export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

/**
 * Retrieve the current request context. Returns undefined when called outside
 * a request (e.g. in a background job or during module initialization).
 */
export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

/**
 * Convenience: get the current requestId, or undefined if outside a request.
 */
export function currentRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

/**
 * Convenience: get the current request-scoped logger, or fall back to the
 * root logger.
 */
export function currentLogger(): pino.Logger {
  return storage.getStore()?.logger ?? rootLogger;
}
