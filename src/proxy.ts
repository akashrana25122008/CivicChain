import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { rateLimiters, applyRateLimit } from '@/lib/security/rate-limit';
import { securityHeadersMiddleware, mapSecurityHeadersMiddleware } from '@/lib/security/headers';

/**
 * Next.js 16 Proxy (formerly Middleware) — optimistic route protection + security.
 *
 * Page guards redirect; API guards return 401/403 JSON. Authorization is
 * ENFORCED again inside every route handler against the live database — the
 * token here is only a fast cache of the JWT written at sign-in.
 * /api/auth/* is never matched so the Auth.js endpoints stay public.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Apply rate limiting to auth endpoints
  if (pathname.startsWith('/api/auth/')) {
    const { allowed, response, headers } = await applyRateLimit(request, rateLimiters.auth);
    if (!allowed && response) {
      return applySecurityHeaders(response, pathname);
    }
    if (response) {
      return applySecurityHeaders(response, pathname);
    }
  }

  // Apply rate limiting to report creation endpoints
  if ((pathname === '/api/issues' || pathname === '/api/reports') && request.method === 'POST') {
    const { allowed, response, headers } = await applyRateLimit(request, rateLimiters.reportCreation);
    if (!allowed && response) {
      return applySecurityHeaders(response, pathname);
    }
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
    const { allowed, response, headers } = await applyRateLimit(request, rateLimiters.fileUpload);
    if (!allowed && response) {
      return applySecurityHeaders(response, pathname);
    }
    if (response) {
      return applySecurityHeaders(response, pathname);
    }
  }

  // Apply rate limiting to map API
  if (pathname.startsWith('/api/map') || pathname === '/map') {
    const { allowed, response, headers } = await applyRateLimit(request, rateLimiters.map);
    if (!allowed && response) {
      return applySecurityHeaders(response, pathname);
    }
    if (response) {
      return applySecurityHeaders(response, pathname);
    }
  }

  // Apply rate limiting to general API endpoints
  if (pathname.startsWith('/api/')) {
    const { allowed, response, headers } = await applyRateLimit(request, rateLimiters.api);
    if (!allowed && response) {
      return applySecurityHeaders(response, pathname);
    }
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
    return mapSecurityHeadersMiddleware({ nextUrl: { pathname } } as any, response);
  }
  return securityHeadersMiddleware({ nextUrl: { pathname } } as any, response);
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
  ],
};