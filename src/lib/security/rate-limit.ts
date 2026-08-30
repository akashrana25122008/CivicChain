/**
 * Rate limiting utility with multiple strategies.
 * Uses in-memory store for development; swap to Redis for production.
 */

import { NextRequest, NextResponse } from 'next/server';

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
  /** Skip successful requests from count */
  skipSuccessfulRequests?: boolean;
  /** Skip failed requests from count */
  skipFailedRequests?: boolean;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

/**
 * In-memory rate limit store.
 * For production, replace with Redis-based implementation.
 */
class MemoryRateLimitStore {
  private store = new Map<string, { count: number; resetTime: number }>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
    // Prevent the interval from keeping the process alive
    this.cleanupInterval.unref();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.store.entries()) {
      if (value.resetTime < now) {
        this.store.delete(key);
      }
    }
  }

  increment(key: string, windowMs: number): { count: number; resetTime: number } {
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

  get(key: string): { count: number; resetTime: number } | undefined {
    const existing = this.store.get(key);
    if (!existing || existing.resetTime < Date.now()) {
      return undefined;
    }
    return existing;
  }

  reset(key: string): void {
    this.store.delete(key);
  }
}

// Global store instance
const store = new MemoryRateLimitStore();

/**
 * Create a rate limiter with the given configuration.
 */
export function createRateLimiter(config: RateLimitConfig) {
  const {
    maxRequests,
    windowSeconds,
    keyPrefix = 'ratelimit',
    headers = true,
    keyGenerator = defaultKeyGenerator,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = config;

  const windowMs = windowSeconds * 1000;

  return async function rateLimiter(
    request: NextRequest,
    options?: { response?: NextResponse }
  ): Promise<{ result: RateLimitResult; response?: NextResponse }> {
    const key = `${keyPrefix}:${keyGenerator(request)}`;
    const { count, resetTime } = store.increment(key, windowMs);
    const remaining = Math.max(0, maxRequests - count);
    const success = count <= maxRequests;
    const retryAfter = success ? undefined : Math.ceil((resetTime - Date.now()) / 1000);

    const result: RateLimitResult = {
      success,
      limit: maxRequests,
      remaining,
      resetTime,
      retryAfter,
    };

    let response = options?.response;
    if (!response && !success) {
      response = NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } },
        { status: 429 }
      );
    }

    if (headers && response) {
      response.headers.set('X-RateLimit-Limit', String(maxRequests));
      response.headers.set('X-RateLimit-Remaining', String(remaining));
      response.headers.set('X-RateLimit-Reset', String(Math.ceil(resetTime / 1000)));
      if (retryAfter) {
        response.headers.set('Retry-After', String(retryAfter));
      }
    }

    return { result, response };
  };
}

/**
 * Default key generator using IP address + user agent
 */
function defaultKeyGenerator(request: NextRequest): string {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  return `${ip}:${hashString(userAgent)}`;
}

/**
 * Simple string hash for key generation
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const rateLimiters = {
  /** Rate limit for authentication endpoints.
   *  Generous enough to allow a full sign-in/sign-up flow (Auth.js makes
   *  multiple /api/auth/* round-trips: csrf, session, callback/email, plus the
   *  dev magic-link fetch) without false positives, while still blocking abuse. */
  auth: createRateLimiter({
    maxRequests: 30,
    windowSeconds: 60 * 15, // 15 minutes
    keyPrefix: 'ratelimit:auth',
    keyGenerator: (req) => `auth:${defaultKeyGenerator(req)}`,
  }),

  /** Moderate rate limit for API endpoints */
  api: createRateLimiter({
    maxRequests: 100,
    windowSeconds: 60, // 1 minute
    keyPrefix: 'ratelimit:api',
    keyGenerator: (req) => `api:${defaultKeyGenerator(req)}`,
  }),

  /** Stricter rate limit for report creation */
  reportCreation: createRateLimiter({
    maxRequests: 10,
    windowSeconds: 60 * 60, // 1 hour
    keyPrefix: 'ratelimit:report',
    keyGenerator: (req) => `report:${defaultKeyGenerator(req)}`,
  }),

  /** Rate limit for file uploads */
  fileUpload: createRateLimiter({
    maxRequests: 20,
    windowSeconds: 60 * 60, // 1 hour
    keyPrefix: 'ratelimit:upload',
    keyGenerator: (req) => `upload:${defaultKeyGenerator(req)}`,
  }),

  /** Rate limit for map API */
  map: createRateLimiter({
    maxRequests: 60,
    windowSeconds: 60, // 1 minute
    keyPrefix: 'ratelimit:map',
    keyGenerator: (req) => `map:${defaultKeyGenerator(req)}`,
  }),

  /** Rate limit for community voting (anti-brigading / anti-abuse). */
  voting: createRateLimiter({
    maxRequests: 20,
    windowSeconds: 60 * 15, // 15 minutes
    keyPrefix: 'ratelimit:vote',
    keyGenerator: (req) => `vote:${defaultKeyGenerator(req)}`,
  }),
};

/**
 * Apply rate limiter to a request and return response if limited
 */
export async function applyRateLimit(
  request: NextRequest,
  limiter: ReturnType<typeof createRateLimiter>
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