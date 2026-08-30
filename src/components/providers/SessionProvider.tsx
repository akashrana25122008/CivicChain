'use client';

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';

export interface ClientSessionUser {
  id: string;
  role: string;
  name?: string | null;
  email?: string | null;
}

export function SessionProvider({
  children,
  session,
}: {
  children: React.ReactNode;
  session?: { user?: ClientSessionUser } | null;
}) {
  return (
    <NextAuthSessionProvider session={session as never}>
      {children}
    </NextAuthSessionProvider>
  );
}