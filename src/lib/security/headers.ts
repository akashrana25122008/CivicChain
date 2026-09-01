import { NextResponse } from 'next/server';

/**
 * Security headers middleware.
 * Adds critical security headers to all responses.
 * Runs after the proxy/auth middleware so protected routes also get headers.
 *
 * CSP trade-off (documented, Phase 21):
 *  - `'unsafe-inline'` in script-src is retained deliberately. Next.js App
 *    Router streams RSC bootstrapping + hydration via inline scripts; removing
 *    it without a nonce/hash integration would break every navigated page.
 *    Follow-up hardening: adopt a nonce strategy (`useReportTo` +
 *    `next/headers` nonce) and then drop `'unsafe-inline'`.
 *  - `'unsafe-eval'` is kept for map/AI client libraries that eval; review for
 *    removal once those bundles are confirmed eval-free.
 *  - `connect-src` intentionally allows `https:` + `wss:` broadly to support
 *    externel AI/map/cdn origins without a per-route whitelist; tighten to an
 *    explicit allow-list in deployments that pin those providers.
 */

/** Minimal request shape — only the pathname is needed to pick a CSP variant. */
type PathAware = { nextUrl: { pathname: string } };

const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com",
  "font-src 'self' data: https://fonts.googleapis.com https://fonts.gstatic.com",
  "img-src 'self' data: https: blob: https://a.basemaps.cartocdn.com https://b.basemaps.cartocdn.com https://c.basemaps.cartocdn.com",
  "connect-src 'self' https: wss: https://api.openai.com https://*.openai.com https://*.openrouter.ai https://*.anthropic.com https://api.replicate.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-src 'self' https://maps.google.com https://www.google.com/maps",
  "object-src 'none'",
].join('; ');

const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP_DIRECTIVES,
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self), payment=()',
  'X-Frame-Options': 'DENY',
  'X-DNS-Prefetch-Control': 'off',
  'X-Download-Options': 'noopen',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'cross-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
} as const;

export function securityHeadersMiddleware(request: PathAware, response: NextResponse): NextResponse {
  // Apply security headers to all responses
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }

  // Remove potentially dangerous headers
  response.headers.delete('X-Powered-By');
  response.headers.delete('Server');

  return response;
}

/**
 * CSP configuration for MapLibre GL JS which needs:
 * - Worker scripts for tile loading
 * - Inline styles for dynamic styling
 * - External tile servers (CartoDB)
 * - WebGL/WebWorker for rendering
 */
export const MAP_CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: https: blob: https://a.basemaps.cartocdn.com https://b.basemaps.cartocdn.com https://c.basemaps.cartocdn.com",
  "connect-src 'self' https: wss: https://api.openai.com https://*.openai.com https://*.openrouter.ai https://*.anthropic.com https://api.replicate.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-src 'self' https://maps.google.com https://www.google.com/maps",
].join('; ');

export function mapSecurityHeadersMiddleware(request: PathAware, response: NextResponse): NextResponse {
  // Apply map-specific CSP for pages that use MapLibre
  const isMapPage = request.nextUrl.pathname === '/map' ||
    request.nextUrl.pathname.startsWith('/dashboard/map') ||
    request.nextUrl.pathname.startsWith('/api/map');

  if (isMapPage) {
    response.headers.set('Content-Security-Policy', MAP_CSP_DIRECTIVES);
  }

  // Apply standard security headers
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (key !== 'Content-Security-Policy' || !isMapPage) {
      response.headers.set(key, value);
    }
  }

  response.headers.delete('X-Powered-By');
  response.headers.delete('Server');

  return response;
}