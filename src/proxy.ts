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
    pathname.startsWith('/department') ||
    pathname.startsWith('/my-reports') ||
    pathname.startsWith('/admin') ||
    pathname === '/report' ||
    pathname.startsWith('/api/issues') ||
    pathname.startsWith('/api/department') ||
    pathname.startsWith('/api/my-reports') ||
    pathname.startsWith('/api/notifications') ||
    pathname.startsWith('/api/admin') ||
    pathname.startsWith('/api/citizen');

  if (!needsAuth) {
    return NextResponse.next();
  }

  const deny = (code: string, message: string, status: number) =>
    api
      ? NextResponse.json({ error: { code, message } }, { status })
      : null;

  if (!token?.id) {
    if (api) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'You must be signed in.' } },
        { status: 401 },
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  const redirectHome = (role: string | undefined) => {
    const target =
      role === 'ADMIN' ? '/admin/dashboard' : role === 'AUTHORITY' ? '/department' : '/dashboard';
    return NextResponse.redirect(new URL(target, request.url));
  };

  const isAdminPath = pathname.startsWith('/admin') || pathname.startsWith('/api/admin');
  if (isAdminPath && token.role !== 'ADMIN') {
    return api ? deny('FORBIDDEN', 'Admins only.', 403) : redirectHome(token.role);
  }

  const isDepartmentPath =
    pathname.startsWith('/department') || pathname.startsWith('/api/department');
  if (isDepartmentPath && token.role !== 'AUTHORITY') {
    return api ? deny('FORBIDDEN', 'Department access only.', 403) : redirectHome(token.role);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/department/:path*',
    '/my-reports/:path*',
    '/admin/:path*',
    '/report',
    '/api/issues/:path*',
    '/api/department/:path*',
    '/api/my-reports/:path*',
    '/api/notifications/:path*',
    '/api/admin/:path*',
    '/api/citizen/:path*',
  ],
};