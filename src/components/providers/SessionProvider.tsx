'use client';

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';

export function SessionProvider({
  children,
  session,
}: {
  children: React.ReactNode;
  session?: { user?: { id: string; role: string } } | null;
}) {
  return (
    <NextAuthSessionProvider session={session as never}>
      {children}
    </NextAuthSessionProvider>
  );
}