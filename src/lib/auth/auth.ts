import NextAuth from 'next-auth';
import EmailProvider from 'next-auth/providers/email';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/db';
import { authConfig } from '@/lib/auth/auth.config';
import { sendMagicLinkEmail } from '@/lib/email/magic-link';

/**
 * Full Auth.js v5 configuration (server only).
 * Strategy: JWT sessions (enables edge-safe route protection via Proxy) with a
 * Prisma-backed user store + email magic-link verification tokens.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  providers: [
    EmailProvider({
      // Required by the provider constructor even though delivery is fully
      // handled by the custom sendVerificationRequest below (which reads
      // EMAIL_SERVER directly and fails loudly without SMTP in production).
      server: process.env.EMAIL_SERVER || { host: 'localhost', port: 25 },
      from: process.env.EMAIL_FROM || 'CivicChain <noreply@civicchain.local>',
      maxAge: 15 * 60,
      sendVerificationRequest: sendMagicLinkEmail,
    }),
  ],
});