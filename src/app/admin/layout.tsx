import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { AdminShell } from '@/components/layout/AdminShell';

/** Admin workspace. Server-side role gate — never trust the client. */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (user.role !== 'ADMIN') {
    redirect(user.role === 'AUTHORITY' ? '/department/dashboard' : '/dashboard');
  }
  return <AdminShell>{children}</AdminShell>;
}
