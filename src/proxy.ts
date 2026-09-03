import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { rateLimiters, applyRateLimit } from '@/lib/security/rate-limit';
import { securityHeadersMiddleware, mapSecurityHeadersMiddleware } from '@/lib/security/headers';
import { generateRequestId, logAccessLog } from '@/lib/security/requestLog';
import { currentLogger, runWithContext } from '@/lib/server/requestContext';

/**
 * Next.js 16 Proxy (formerly Middleware) — optimistic route protection + security.
 *
 * Page guards redirect; API guards return 401/403 JSON. Authorization is
 * ENFORCED again inside every route handler against the live database — the
 * token here is only a fast cache of the JWT written at sign-in.
 * /api/auth/* is never matched so the Auth.js endpoints stay public.
 *
 * Phase 22: every matched request runs inside a request-scoped context
 * (AsyncLocalStorage) carrying the requestId and a child logger, so all
 * downstream handlers, DB queries, and error paths share the same correlation
 * id and structured logger.
 */
export async function proxy(request: NextRequest) {
  const startedAt = Date.now();
  const requestId = generateRequestId();
  const { pathname } = request.nextUrl;
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  // Propagate the correlation id to the downstream route handler so it can
  // establish its own request-scoped context (AsyncLocalStorage) with the
  // same id. Mutating the incoming request headers is visible to handlers
  // via NextResponse.next().
  request.headers.set('x-request-id', requestId);

  return runWithContext(
    {
      requestId,
      logger: currentLogger().child({ requestId }),
      startedAt,
      ip,
    },
    async () => {
      const response = await handleRequest(request);

      // Attach the correlation id so callers can quote it in support tickets.
      response.headers.set('x-request-id', requestId);
      response.headers.set('x-request-path', pathname);

      logAccessLog({
        requestId,
        method: request.method,
        path: pathname,
        status: response.status,
        durationMs: Date.now() - startedAt,
        ip,
        rateLimited: response.status === 429 || response.status === 503,
      });

      return response;
    },
  );
}

async function handleRequest(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Auth endpoints are intentionally NOT rate-limited so sign-in and
  // registration are never blocked. All /api/auth/* routes short-circuit here
  // so they are never counted against the generic /api/ limiter below.
  if (pathname.startsWith('/api/auth/')) {
    const authResponse = NextResponse.next();
    return applySecurityHeaders(authResponse, pathname);
  }

  // Apply stricter rate limiting to the admin API (sensitive, high-value).
  if (pathname.startsWith('/api/admin')) {
    const { response } = await applyRateLimit(request, rateLimiters.admin);
    if (response) {
      return applySecurityHeaders(response, pathname);
    }
  }

  // Apply a dedicated rate limit to geocoding (protects the external provider
  // from being hammered by autocomplete/reverse requests).
  if (pathname.startsWith('/api/geocode')) {
    const { response } = await applyRateLimit(request, rateLimiters.geocode);
    if (response) {
      return applySecurityHeaders(response, pathname);
    }
  }

  // Apply rate limiting to report creation endpoints
  if ((pathname === '/api/issues' || pathname === '/api/reports') && request.method === 'POST') {
    const { response } = await applyRateLimit(request, rateLimiters.reportCreation);
    if (response) {
      return applySecurityHeaders(response, pathname);
    }
  }

  // Apply rate limiting to file upload endpoints
  const isEvidenceUpload =
    (pathname.startsWith('/api/evidence/') && request.method === 'POST') ||
    (pathname.startsWith('/api/issues/') &&
      pathname.endsWith('/evidence') &&
      request.method === 'POST');
  if (isEvidenceUpload) {
    const { response } = await applyRateLimit(request, rateLimiters.fileUpload);
    if (response) {
      return applySecurityHeaders(response, pathname);
    }
  }

  // Apply rate limiting to map API
  if (pathname.startsWith('/api/map') || pathname === '/map') {
    const { response } = await applyRateLimit(request, rateLimiters.map);
    if (response) {
      return applySecurityHeaders(response, pathname);
    }
  }

  // Apply rate limiting to general API endpoints.
  // Paths already covered by a specific bucket (auth, admin, geocode, map,
  // report, upload) are intentionally skipped so they are NOT double-counted.
  const coveredBySpecificBucket =
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/admin') ||
    pathname.startsWith('/api/geocode') ||
    pathname.startsWith('/api/map') ||
    (pathname === '/api/issues' || pathname === '/api/reports') ||
    pathname.startsWith('/api/evidence/');
  if (pathname.startsWith('/api/') && !coveredBySpecificBucket) {
    const { response } = await applyRateLimit(request, rateLimiters.api);
    if (response) {
      return applySecurityHeaders(response, pathname);
    }
  }

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  });

  const api = pathname.startsWith('/api/');
  const needsAuth =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/department') ||
    pathname.startsWith('/my-reports') ||
    pathname.startsWith('/admin') ||
    pathname === '/report' ||
    pathname === '/map' ||
    pathname.startsWith('/api/issues') ||
    pathname.startsWith('/api/reports') ||
    pathname.startsWith('/api/evidence/') ||
    pathname.startsWith('/api/department') ||
    pathname.startsWith('/api/my-reports') ||
    pathname.startsWith('/api/notifications') ||
    pathname.startsWith('/api/admin') ||
    pathname.startsWith('/api/citizen') ||
    pathname.startsWith('/api/map');

  if (!needsAuth) {
    const response = NextResponse.next();
    return applySecurityHeaders(response, pathname);
  }

  const deny = (code: string, message: string, status: number) =>
    api
      ? NextResponse.json({ error: { code, message } }, { status })
      : null;

  if (!token?.id) {
    if (api) {
      const response = NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'You must be signed in.' } },
        { status: 401 },
      );
      return applySecurityHeaders(response, pathname);
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('callbackUrl', pathname);
    return applySecurityHeaders(NextResponse.redirect(url), pathname);
  }

  const redirectHome = (role: string | undefined) => {
    const target =
      role === 'ADMIN' ? '/admin/dashboard' : role === 'AUTHORITY' ? '/department' : '/dashboard';
    return NextResponse.redirect(new URL(target, request.url));
  };

  const isAdminPath = pathname.startsWith('/admin') || pathname.startsWith('/api/admin');
  if (isAdminPath && token.role !== 'ADMIN') {
    const response = api ? deny('FORBIDDEN', 'Admins only.', 403) : redirectHome(token.role);
    return applySecurityHeaders(response!, pathname);
  }

  const isDepartmentPath =
    pathname.startsWith('/department') || pathname.startsWith('/api/department');
  if (isDepartmentPath && token.role !== 'AUTHORITY') {
    const response = api ? deny('FORBIDDEN', 'Department access only.', 403) : redirectHome(token.role);
    return applySecurityHeaders(response!, pathname);
  }

  const response = NextResponse.next();
  return applySecurityHeaders(response, pathname);
}

function applySecurityHeaders(response: NextResponse, pathname: string): NextResponse {
  // Use map-specific CSP for map pages
  if (pathname === '/map' || pathname.startsWith('/dashboard/map') || pathname.startsWith('/api/map')) {
    return mapSecurityHeadersMiddleware({ nextUrl: { pathname } }, response);
  }
  return securityHeadersMiddleware({ nextUrl: { pathname } }, response);
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/department/:path*',
    '/my-reports/:path*',
    '/admin/:path*',
    '/report',
    '/map',
    '/api/auth/:path*',
    '/api/issues/:path*',
    '/api/department/:path*',
    '/api/my-reports/:path*',
    '/api/notifications/:path*',
    '/api/admin/:path*',
    '/api/citizen/:path*',
    '/api/map/:path*',
    '/api/evidence/:path*',
    '/api/reports/:path*',
    '/api/geocode/:path*',
    '/api/health',
  ],
};