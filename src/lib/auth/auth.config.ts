import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-safe Auth.js configuration shared by the full server config (auth.ts)
 * and the route-protection Proxy. This file must NOT import Prisma or any
 * Node-only module — it runs during middleware on the edge runtime.
 *
 * The role is placed into the JWT at sign-in (server-side, authoritative) and
 * read back by the proxy without any database access.
 */
export const authConfig = {
  trustHost: true,
  pages: {
    signIn: '/login',
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role?: string }).role ?? 'CITIZEN';
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string) ?? 'CITIZEN';
      }
      return session;
    },
  },
} satisfies NextAuthConfig;