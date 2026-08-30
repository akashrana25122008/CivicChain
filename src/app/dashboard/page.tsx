import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { CitizenDashboard } from '@/components/dashboard/CitizenDashboard';

/**
 * Citizen landing — `/dashboard` exact. Non-citizens are routed to their own
 * workspace by role. Shared pages under `/dashboard/*` stay open to all roles
 * and are gated in their own layouts/pages.
 */
export default async function DashboardHomePage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (user.role === 'AUTHORITY') {
    redirect('/department/dashboard');
  }
  if (user.role === 'ADMIN') {
    redirect('/admin/dashboard');
  }
  return <CitizenDashboard name={user.name} />;
}