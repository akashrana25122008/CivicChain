import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { AppShell } from '@/components/layout/AppShell';
import { DepartmentShell } from '@/components/layout/DepartmentShell';

/**
 * Civic Map workspace. Requires auth (server-side gate, not just Proxy).
 * The shell is role-aware so the map renders inside the correct workspace:
 * Department users get the header-driven DepartmentShell (no orphan AppShell
 * left-sidebar), everyone else gets the standard AppShell sidebar.
 */
export default async function MapLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return user.role === 'AUTHORITY' ? (
    <DepartmentShell>{children}</DepartmentShell>
  ) : (
    <AppShell>{children}</AppShell>
  );
}
