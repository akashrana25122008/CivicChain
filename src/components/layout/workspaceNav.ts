import {
  LayoutDashboard,
  PlusCircle,
  ClipboardList,
  Map as MapIcon,
  Bell,
  User,
  FileText,
  ShieldCheck,
  AlertTriangle,
  BarChart3,
  Users,
  Building2,
  ScrollText,
  HeartPulse,
  Gauge,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react';

/**
 * Role-aware workspace navigation. Every entry maps to a route that is
 * actually implemented in this repository — nothing here is a stub or a
 * "coming soon" placeholder.
 */

export interface WorkspaceNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface WorkspaceNavGroup {
  title: string;
  items: WorkspaceNavItem[];
}

export type WorkspaceRole = 'CITIZEN' | 'AUTHORITY' | 'ADMIN';

export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  CITIZEN: 'Citizen Reporter',
  AUTHORITY: 'Civic Authority',
  ADMIN: 'Administrator',
};

/** Role home, decided server-side by the session, never by the client. */
export function homeFor(role?: string | null): string {
  switch (role) {
    case 'ADMIN':
      return '/admin/dashboard';
    case 'AUTHORITY':
      return '/department/dashboard';
    default:
      return '/dashboard';
  }
}

export function navForRole(role?: string | null): WorkspaceNavGroup[] {
  switch (role) {
    case 'AUTHORITY':
      return [
        {
          title: 'Operations',
          items: [
            { href: '/department/command-center', label: 'Command Center', icon: LayoutDashboard },
            { href: '/department/dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { href: '/department/issues', label: 'Issues', icon: FileText },
            { href: '/department/verification', label: 'Verification', icon: ShieldCheck },
            { href: '/department/escalations', label: 'Escalations', icon: AlertTriangle },
            { href: '/department/performance', label: 'Performance', icon: BarChart3 },
          ],
        },
        {
          title: 'Intelligence',
          items: [
            { href: '/map', label: 'Map', icon: MapIcon },
            { href: '/dashboard/risk', label: 'Risk Intelligence', icon: ShieldAlert },
          ],
        },
        {
          title: 'System',
          items: [
            { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
            { href: '/dashboard/settings', label: 'Profile', icon: User },
          ],
        },
      ];
    case 'ADMIN':
      return [
        {
          title: 'Control Center',
          items: [
            { href: '/admin/command-center', label: 'Command Center', icon: Gauge },
            { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { href: '/admin/users', label: 'Users', icon: Users },
            { href: '/admin/departments', label: 'Departments', icon: Building2 },
            { href: '/admin/issues', label: 'Issues', icon: FileText },
            { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
          ],
        },
        {
          title: 'Oversight',
          items: [
            { href: '/map', label: 'Map', icon: MapIcon },
            { href: '/dashboard/risk', label: 'Risk Intelligence', icon: ShieldAlert },
            { href: '/admin/audit', label: 'Audit Logs', icon: ScrollText },
            { href: '/admin/health', label: 'System Health', icon: HeartPulse },
          ],
        },
        {
          title: 'System',
          items: [
            { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
            { href: '/dashboard/settings', label: 'Profile', icon: User },
          ],
        },
      ];
    default:
      return [
        {
          title: 'My Workspace',
          items: [
            { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { href: '/report', label: 'Report an Issue', icon: PlusCircle },
            { href: '/my-reports', label: 'My Reports', icon: ClipboardList },
            { href: '/map', label: 'Map', icon: MapIcon },
          ],
        },
        {
          title: 'System',
          items: [
            { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
            { href: '/dashboard/settings', label: 'Profile', icon: User },
          ],
        },
      ];
  }
}