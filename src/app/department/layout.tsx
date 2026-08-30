import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { AppShell } from '@/components/layout/AppShell';

/** Authority workspace. Server-side role gate — never trust the client. */
export default async function DepartmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (user.role !== 'AUTHORITY') {
    redirect(user.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard');
  }
  return <AppShell>{children}</AppShell>;
}