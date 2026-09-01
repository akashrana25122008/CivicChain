/**
 * Rate limiting utility with multiple strategies and a pluggable store.
 *
 * Phase 21 hardening:
 *  - The store is selected at runtime from the environment:
 *      RATE_LIMIT_STORE=redis  -> Redis-backed (ioredis), production-grade,
 *                                 shared across instances, best for scaling.
 *      RATE_LIMIT_STORE=memory -> in-memory (default, development / single-node).
 *  - A Redis outage is handled CONSCIOUSLY per endpoint sensitivity via the
 *    `redisFallback` config flag:
 *        "open"   (default) -> fail-open: allow the request (a brief generous
 *                               window is better than a hard outage for most
 *                               endpoints; memory store becomes a best-effort
 *                               local guard).
 *        "closed"           -> fail-closed: reject with 503 while Redis is down
 *                               (for the most sensitive endpoints where
 *                               bypassing the limit is unacceptable).
 *  - Every limiter still returns the standard 429 + Retry-After contract.
 */

import { NextRequest, NextResponse } from 'next/server';

/* ---------------------------------------------------------------------------
 * RateLimitStore abstraction
 * ------------------------------------------------------------------------- */

export interface RateLimitStore {
  /** Atomically increment the counter for `key` and return count + resetTime. */
  increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }>;
  /** Redis availability check (fails when the backend is unusable). */
  ping?(): Promise<boolean>;
  /** Optional cleanup hook for in-memory stores. */
  shutdown?(): void;
}

/* ---------------------------------------------------------------------------
 * In-memory store (development / fallback)
 * ------------------------------------------------------------------------- */

class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, { count: number; resetTime: number }>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
    this.cleanupInterval.unref();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.store.entries()) {
      if (value.resetTime < now) this.store.delete(key);
    }
  }

  async increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }> {
    const now = Date.now();
    const existing = this.store.get(key);
    if (!existing || existing.resetTime < now) {
      const resetTime = now + windowMs;
      this.store.set(key, { count: 1, resetTime });
      return { count: 1, resetTime };
    }
    existing.count += 1;
    return { count: existing.count, resetTime: existing.resetTime };
  }

  async ping(): Promise<boolean> {
    return true;
  }

  shutdown(): void {
    clearInterval(this.cleanupInterval);
  }
}

/* ---------------------------------------------------------------------------
 * Redis store (production)
 * ------------------------------------------------------------------------- */

let redisClient: import('ioredis').Redis | null = null;
let redisChecked = false;

/** Lazy-load ioredis and connect using REDIS_URL (or standard parts). */
async function getRedis(): Promise<import('ioredis').Redis | null> {
  if (redisChecked) return redisClient;
  redisChecked = true;
  try {
    const { Redis } = await import('ioredis');
    const url = process.env.REDIS_URL;
    if (!url && !process.env.REDIS_HOST) return null;
    const client = url
      ? new Redis(url, {
          maxRetriesPerRequest: 1,
          connectTimeout: 2000,
          lazyConnect: true,
        })
      : new Redis({
          host: process.env.REDIS_HOST || '127.0.0.1',
          port: Number(process.env.REDIS_PORT || 6379),
          password: process.env.REDIS_PASSWORD || undefined,
          maxRetriesPerRequest: 1,
          connectTimeout: 2000,
          lazyConnect: true,
        });
    client.on('error', () => {
      /* supress noisy reconnect logs; ping() reports availability */
    });
    await client.connect();
    redisClient = client;
    return client;
  } catch {
    redisClient = null;
    return null;
  }
}

class RedisRateLimitStore implements RateLimitStore {
  async increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }> {
    const client = await getRedis();
    if (!client) throw new Error('Redis unavailable');
    const now = Date.now();
    const resetTime = now + windowMs;
    // INCR + PEXPIRE in one atomic script avoids a race on the TTL.
    const result = (await client.eval(
      `local c = redis.call('INCR', KEYS[1])
       if c == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
       return c`,
      1,
      `rl:${key}`,
      String(windowMs),
    )) as number;
    return { count: result, resetTime };
  }

  async ping(): Promise<boolean> {
    const client = await getRedis();
    if (!client) return false;
    try {
      await client.ping();
      return true;
    } catch {
      return false;
    }
  }

  shutdown(): void {
    redisClient?.disconnect();
    redisClient = null;
  }
}

/* ---------------------------------------------------------------------------
 * Store selection
 * ------------------------------------------------------------------------- */

const storeMode = (): 'redis' | 'memory' =>
  process.env.RATE_LIMIT_STORE === 'redis' ? 'redis' : 'memory';

const memoryStore = new MemoryRateLimitStore();
const redisStore = new RedisRateLimitStore();

function pickStore(): RateLimitStore {
  return storeMode() === 'redis' ? redisStore : memoryStore;
}

/* ---------------------------------------------------------------------------
 * Config + result types
 * ------------------------------------------------------------------------- */

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Time window in seconds */
  windowSeconds: number;
  /** Key prefix for the rate limit bucket */
  keyPrefix?: string;
  /** Whether to include rate limit headers in response */
  headers?: boolean;
  /** Custom key generator */
  keyGenerator?: (request: NextRequest) => string;
  /**
   * Behavior when the Redis backend is unavailable (only used when
   * RATE_LIMIT_STORE=redis). "open" (default) fails open; "closed" fails closed
   * with a 503 so a critical limit can never be silently bypassed.
   */
  redisFallback?: 'open' | 'closed';
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

/* ---------------------------------------------------------------------------
 * Limiter factory
 * ------------------------------------------------------------------------- */

/**
 * Increments the bucket for a key and reports whether the request is allowed.
 * Handles the Redis outage policy: fail-open degrades to the in-memory store;
 * fail-closed rejects with a 503.
 */
async function checkLimit(
  request: NextRequest,
  keyPrefix: string,
  key: string,
  config: RateLimitConfig,
  maxRequests: number,
  windowMs: number,
  redisFallback: 'open' | 'closed',
): Promise<{ success: boolean; retryAfter?: number; resetTime: number; blocked?: boolean; count: number }> {
  const store = pickStore();

  let count: number;
  let resetTime: number;
  try {
    const r = await store.increment(key, windowMs);
    count = r.count;
    resetTime = r.resetTime;
  } catch {
    // Redis error path.
    if (storeMode() === 'redis') {
      if (redisFallback === 'closed') {
        return { success: false, resetTime: Date.now() + windowMs, blocked: true, count: maxRequests };
      }
      // fail-open: fall back to the in-memory store for a best-effort guard.
      try {
        const r = await memoryStore.increment(key, windowMs);
        count = r.count;
        resetTime = r.resetTime;
      } catch {
        return { success: true, resetTime: Date.now() + windowMs, count: maxRequests };
      }
    } else {
      return { success: true, resetTime: Date.now() + windowMs, count: maxRequests };
    }
  }

  const success = count <= maxRequests;
  const retryAfter = success ? undefined : Math.ceil((resetTime - Date.now()) / 1000);
  return { success, retryAfter, resetTime, count };
}

export function createRateLimiter(config: RateLimitConfig) {
  const {
    maxRequests,
    windowSeconds,
    keyPrefix = 'ratelimit',
    headers = true,
    keyGenerator = defaultKeyGenerator,
    redisFallback = 'open',
  } = config;

  const windowMs = windowSeconds * 1000;

  return async function rateLimiter(
    request: NextRequest,
    options?: { response?: NextResponse },
  ): Promise<{ result: RateLimitResult; response?: NextResponse }> {
    const key = `${keyPrefix}:${keyGenerator(request)}`;
    const outcome = await checkLimit(request, keyPrefix, key, config, maxRequests, windowMs, redisFallback);

    if (outcome.blocked) {
      const response = NextResponse.json(
        { error: { code: 'RATE_LIMIT_UNAVAILABLE', message: 'Rate limiting is temporarily unavailable. Try again shortly.' } },
        { status: 503 },
      );
      if (headers) response.headers.set('Retry-After', '1');
      return { result: { success: false, limit: maxRequests, remaining: 0, resetTime: outcome.resetTime, retryAfter: 1 }, response };
    }

    const remaining = Math.max(0, maxRequests - outcome.count);
    const result: RateLimitResult = {
      success: outcome.success,
      limit: maxRequests,
      remaining,
      resetTime: outcome.resetTime,
      retryAfter: outcome.retryAfter,
    };

    let response = options?.response;
    if (!response && !outcome.success) {
      response = NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } },
        { status: 429 },
      );
    }

    if (headers && response) {
      response.headers.set('X-RateLimit-Limit', String(maxRequests));
      response.headers.set('X-RateLimit-Remaining', String(remaining));
      response.headers.set('X-RateLimit-Reset', String(Math.ceil(outcome.resetTime / 1000)));
      if (outcome.retryAfter) response.headers.set('Retry-After', String(outcome.retryAfter));
    }

    return { result, response };
  };
}

/**
 * Default key generator using IP address + user agent.
 */
function defaultKeyGenerator(request: NextRequest): string {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  return `${ip}:${hashString(userAgent)}`;
}

/**
 * Simple non-cryptographic string hash for key generation (a stable per-client
 * key; not security-sensitive — the store limits are approximate by design).
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/* ---------------------------------------------------------------------------
 * Pre-configured limiters
 * ------------------------------------------------------------------------- */

export const rateLimiters = {
  /** Authentication: generous (Auth.js issues several /api/auth/* round-trips)
   *  but firm enough to deter credential-stuffing/link-probing. */
  auth: createRateLimiter({
    maxRequests: 30,
    windowSeconds: 60 * 15,
    keyPrefix: 'ratelimit:auth',
    keyGenerator: (req) => `auth:${defaultKeyGenerator(req)}`,
    redisFallback: 'closed',
  }),

  /** General API. */
  api: createRateLimiter({
    maxRequests: 100,
    windowSeconds: 60,
    keyPrefix: 'ratelimit:api',
    keyGenerator: (req) => `api:${defaultKeyGenerator(req)}`,
  }),

  /** Report creation — strict per-hour limit to prevent spam. */
  reportCreation: createRateLimiter({
    maxRequests: 10,
    windowSeconds: 60 * 60,
    keyPrefix: 'ratelimit:report',
    keyGenerator: (req) => `report:${defaultKeyGenerator(req)}`,
    redisFallback: 'closed',
  }),

  /** File uploads — per-hour cap. */
  fileUpload: createRateLimiter({
    maxRequests: 20,
    windowSeconds: 60 * 60,
    keyPrefix: 'ratelimit:upload',
    keyGenerator: (req) => `upload:${defaultKeyGenerator(req)}`,
    redisFallback: 'closed',
  }),

  /** Map API. */
  map: createRateLimiter({
    maxRequests: 60,
    windowSeconds: 60,
    keyPrefix: 'ratelimit:map',
    keyGenerator: (req) => `map:${defaultKeyGenerator(req)}`,
  }),

  /** Community voting (anti-brigading). */
  voting: createRateLimiter({
    maxRequests: 20,
    windowSeconds: 60 * 15,
    keyPrefix: 'ratelimit:vote',
    keyGenerator: (req) => `vote:${defaultKeyGenerator(req)}`,
    redisFallback: 'closed',
  }),

  /** Geocoding autocomplete — protects the provider from being hammered. */
  geocode: createRateLimiter({
    maxRequests: 60,
    windowSeconds: 60,
    keyPrefix: 'ratelimit:geocode',
    keyGenerator: (req) => `geocode:${defaultKeyGenerator(req)}`,
    redisFallback: 'closed',
  }),

  /** Admin API — sensitive, high-value surface. */
  admin: createRateLimiter({
    maxRequests: 200,
    windowSeconds: 60,
    keyPrefix: 'ratelimit:admin',
    keyGenerator: (req) => `admin:${defaultKeyGenerator(req)}`,
    redisFallback: 'closed',
  }),
};

/**
 * Apply a rate limiter to a request and return the headers + allowed flag.
 */
export async function applyRateLimit(
  request: NextRequest,
  limiter: ReturnType<typeof createRateLimiter>,
): Promise<{ allowed: boolean; response?: NextResponse; headers: Record<string, string> }> {
  const { result, response } = await limiter(request);
  const headers: Record<string, string> = {};
  if (response) {
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
  }
  return {
    allowed: result.success,
    response,
    headers,
  };
}

/**
 * Release any active Redis connection (used on app shutdown / tests). No-op for
 * the in-memory store.
 */
export function shutdownRateLimiter(): void {
  redisStore.shutdown();
  memoryStore.shutdown();
}
