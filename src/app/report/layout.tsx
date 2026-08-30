import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { AppShell } from '@/components/layout/AppShell';

/** Report an Issue. Requires auth (server-side gate, not just Proxy). */
export default async function ReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return <AppShell>{children}</AppShell>;
}