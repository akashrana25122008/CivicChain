import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * Next.js 16 Proxy (formerly Middleware) — optimistic route protection.
 *
 * Page guards redirect; API guards return 401/403 JSON. Authorization is
 * ENFORCED again inside every route handler against the live database — the
 * token here is only a fast cache of the JWT written at sign-in.
 * /api/auth/* is never matched so the Auth.js endpoints stay public.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  });

  const api = pathname.startsWith('/api/');
  const needsAuth =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/my-reports') ||
    pathname.startsWith('/admin') ||
    pathname === '/report' ||
    pathname.startsWith('/api/issues') ||
    pathname.startsWith('/api/my-reports') ||
    pathname.startsWith('/api/notifications') ||
    pathname.startsWith('/api/admin');

  if (!needsAuth) {
    return NextResponse.next();
  }

  if (!token?.id) {
    const url = request.nextUrl.clone();
    if (api) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'You must be signed in.' } },
        { status: 401 },
      );
    }
    url.pathname = '/login';
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  const isAdminPath =
    pathname.startsWith('/admin') || pathname.startsWith('/api/admin');
  if (isAdminPath && token.role !== 'ADMIN') {
    if (api) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Admins only.' } },
        { status: 403 },
      );
    }
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/my-reports/:path*',
    '/admin/:path*',
    '/report',
    '/api/issues/:path*',
    '/api/my-reports/:path*',
    '/api/notifications/:path*',
    '/api/admin/:path*',
  ],
};