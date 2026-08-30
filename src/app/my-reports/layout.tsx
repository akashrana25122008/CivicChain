import { AppShell } from '@/components/layout/AppShell';

/** Citizen-owned reports workspace. Requires auth (enforced by Proxy). */
export default function MyReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}