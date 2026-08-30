import { NextRequest, NextResponse } from 'next/server';
import { getDevMagicLink } from '@/lib/email/magic-link';

/**
 * Development-only preview of the magic-link sign-in email. Never reachable
 * in production. Returns URL-safe values; the real verification flow still
 * requires opening the one-time token URL (authenticated via DB token lookup).
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production' || process.env.AUTH_DEV_EMAIL_PREVIEW !== 'true') {
    return NextResponse.json({ error: 'Not available.' }, { status: 404 });
  }
  const email = request.nextUrl.searchParams.get('email')?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json(
      { error: { code: 'INVALID_INPUT', message: 'email query parameter is required.' } },
      { status: 400 },
    );
  }
  const link = getDevMagicLink(email);
  if (!link) {
    return NextResponse.json(
      { error: { code: 'NO_LINK', message: 'No recent magic link found for this email. Sign in again to generate one.' } },
      { status: 404 },
    );
  }
  return NextResponse.json({ url: link.url });
}