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
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        // Force the session cookie to HTTPS in production (deployed/hosted).
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role?: string }).role ?? 'CITIZEN';
        token.name = (user as { name?: string | null }).name ?? null;
        token.email = (user as { email?: string | null }).email ?? null;
      }
      return token;
    },
    session({ session, token }) {
      // Cast through a locally-defined mutable shape: Auth.js's bundled types
      // are stricter (non-nullable) than the optional fields we add at runtime.
      const user = session.user as unknown as {
        id?: string;
        role?: string;
        name?: string | null;
        email?: string | null;
      };
      if (user && token.id) {
        user.id = token.id as string;
        user.role = (token.role as string) ?? 'CITIZEN';
        user.name = (token.name as string | undefined) ?? null;
        user.email = (token.email as string | undefined) ?? null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;