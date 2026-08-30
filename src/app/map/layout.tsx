import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { AppShell } from '@/components/layout/AppShell';

/** Civic Map workspace. Requires auth (server-side gate, not just Proxy). */
export default async function MapLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return <AppShell>{children}</AppShell>;
}