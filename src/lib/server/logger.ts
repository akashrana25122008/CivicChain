import pino from 'pino';

/**
 * Structured logger (Phase 22).
 *
 * Replaces ad-hoc `console.*` calls with machine-parseable JSON log lines.
 * In development, pino-pretty renders human-friendly output; in production
 * single-line JSON is emitted for log aggregators.
 *
 * LOG_LEVEL controls verbosity: silent | fatal | error | warn | info | debug.
 * Defaults to "info" in production, "debug" in development.
 */

function resolveLevel(): string {
  const env = process.env.LOG_LEVEL;
  if (env && ['silent', 'fatal', 'error', 'warn', 'info', 'debug'].includes(env)) return env;
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

export const logger = pino({
  level: resolveLevel(),
  ...(process.env.NODE_ENV !== 'production'
    ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
    : {}),
  base: { service: 'civicchain' },
});

/**
 * Create a child logger bound to a specific request context.
 * The requestId is automatically included in every log line from the child.
 */
export function requestLogger(requestId: string): pino.Logger {
  return logger.child({ requestId });
}
