import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { DepartmentSidebar } from '@/components/layout/Navigation';

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
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-dark-bg">
      <DepartmentSidebar />
      <div className="lg:pl-64">
        <main className="min-h-screen">{children}</main>
      </div>
    </div>
  );
}