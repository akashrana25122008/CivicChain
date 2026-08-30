import { AppShell } from '@/components/layout/AppShell';

/** Citizen workspace. Requires auth (enforced by Proxy); AppShell renders the
 * role-aware sidebar + header from the session. */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}