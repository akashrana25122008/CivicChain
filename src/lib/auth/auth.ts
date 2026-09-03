import NextAuth from 'next-auth';
import EmailProvider from 'next-auth/providers/email';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/db';
import { authConfig } from '@/lib/auth/auth.config';
import { ADMIN_EMAIL } from '@/lib/auth/admin-email';
import { sendMagicLinkEmail } from '@/lib/email/magic-link';

/**
 * Authentication adapter.
 *
 * The default `useVerificationToken` deletes by `identifier + token`, and every
 * relogin / resend inserts a NEW VerificationToken row for the same email. Over
 * time multiple valid tokens accumulate, so a stale link the user clicks maps
 * to an already-deleted row ("sign in link is no longer valid"). We wrap
 * `createVerificationToken` so that requesting a fresh link first removes every
 * existing token for that identifier — guaranteeing exactly ONE valid token per
 * email at any time, which the dev preview and the callback always agree on.
 */
function makePrismaAdapter(prismaClient: typeof prisma) {
  const base = PrismaAdapter(prismaClient);
  return {
    ...base,
    async createVerificationToken(identifierToken: { identifier: string; token: string; expires: Date }) {
      await prismaClient.verificationToken.deleteMany({
        where: { identifier: identifierToken.identifier },
      });
      return base.createVerificationToken?.(identifierToken);
    },
  };
}

/**
 * Full Auth.js v5 configuration (server only).
 * Strategy: JWT sessions (enables edge-safe route protection via Proxy) with a
 * Prisma-backed user store + email magic-link verification tokens.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: makePrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
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
  callbacks: {
    ...authConfig.callbacks,
    signIn: async ({ user }) => {
      // Auto-assign ADMIN role for the single configured admin email (normalized).
      const email = user.email?.trim().toLowerCase() ?? '';
      if (email === ADMIN_EMAIL && email !== '' && user.id) {
        try {
          // Persist ADMIN on the stored user so it survives beyond the JWT and
          // any server-side checks that read from the DB. If the row doesn't
          // exist yet (first-time Google login races the PrismaAdapter user
          // creation), skip and let the adapter create it; the JWT callback
          // still stamps ADMIN for this session.
          await prisma.user.update({
            where: { id: user.id },
            data: { role: 'ADMIN' },
          });
        } catch {
          // The user row may not exist yet; PrismaAdapter will create it and
          // the JWT callback remains authoritative for the session role.
        }
      }
      return true;
    },
  },
});