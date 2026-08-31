'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import useSWR from 'swr';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import {
  LayoutDashboard,
  MapPin,
  FileText,
  Gavel,
  AlertTriangle,
  Search,
  BarChart3,
  Users,
  Settings,
  Menu,
  X,
  Sun,
  Moon,
  Bell,
  ClipboardList,
  ShieldCheck,
  LogOut,
  PlusCircle,
  Building2,
  ScrollText,
  HeartPulse,
  Zap,
  type LucideIcon,
} from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  CITIZEN: 'Citizen Reporter',
  AUTHORITY: 'Civic Authority',
  ADMIN: 'Administrator',
};

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface CrossLink extends NavItem {
  roles: Array<'CITIZEN' | 'AUTHORITY' | 'ADMIN'>;
}

interface NavGroup {
  title?: string;
  items: NavItem[];
}

const HEADER_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/map', label: 'Civic Map', icon: MapPin },
  { href: '/dashboard/issues', label: 'Issues', icon: FileText },
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
];

const CITIZEN_NAV: NavGroup[] = [
  {
    title: 'My Workspace',
    items: [
      { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
      { href: '/report', label: 'Report Issue', icon: PlusCircle },
      { href: '/my-reports', label: 'My Reports', icon: ClipboardList },
    ],
  },
  {
    title: 'Platform',
    items: [
      { href: '/dashboard/map', label: 'Civic Map', icon: MapPin },
      { href: '/dashboard/issues', label: 'All Issues', icon: FileText },
      { href: '/dashboard/promises', label: 'Promises', icon: Gavel },
      { href: '/dashboard/verification', label: 'Verification', icon: Search },
      { href: '/dashboard/escalations', label: 'Escalations', icon: AlertTriangle },
      { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
      { href: '/dashboard/settings', label: 'Settings', icon: Settings },
    ],
  },
];

const DEPARTMENT_NAV: NavGroup[] = [
  {
    title: 'Operations',
    items: [
      { href: '/department/command-center', label: 'Command Center', icon: Zap },
      { href: '/department/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/department/issues', label: 'Issues', icon: FileText },
      { href: '/department/verification', label: 'Verification', icon: ShieldCheck },
      { href: '/department/escalations', label: 'Escalations', icon: AlertTriangle },
      { href: '/department/performance', label: 'Performance', icon: BarChart3 },
    ],
  },
  {
    title: 'Shared',
    items: [
      { href: '/dashboard/map', label: 'Civic Map', icon: MapPin },
      { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
      { href: '/my-reports', label: 'My Reports', icon: ClipboardList },
    ],
  },
];

const ADMIN_NAV: NavGroup[] = [
  {
    title: 'Control Center',
    items: [
      { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/admin/users', label: 'Users', icon: Users },
      { href: '/admin/departments', label: 'Departments', icon: Building2 },
      { href: '/admin/issues', label: 'Issues', icon: FileText },
      { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
      { href: '/admin/audit', label: 'Audit Log', icon: ScrollText },
      { href: '/admin/health', label: 'System Health', icon: HeartPulse },
    ],
  },
  {
    title: 'Shared',
    items: [
      { href: '/dashboard', label: 'Citizen Overview', icon: LayoutDashboard },
      { href: '/my-reports', label: 'My Reports', icon: ClipboardList },
    ],
  },
];

const CITIZEN_CROSS_LINKS: CrossLink[] = [
  { href: '/department/dashboard', label: 'Department Ops', icon: ShieldCheck, roles: ['AUTHORITY'] },
  { href: '/admin/dashboard', label: 'Admin Panel', icon: Users, roles: ['ADMIN'] },
];
const DEPARTMENT_CROSS_LINKS: CrossLink[] = [
  { href: '/admin/dashboard', label: 'Admin Panel', icon: Users, roles: ['ADMIN'] },
  { href: '/dashboard', label: 'Citizen Overview', icon: LayoutDashboard, roles: ['CITIZEN', 'AUTHORITY'] },
];
const ADMIN_CROSS_LINKS: CrossLink[] = [];

function initialsOf(name?: string | null, email?: string | null): string {
  const source = name || email || '?';
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function useUnreadCount(): number {
  const { data } = useSWR<{ unreadCount: number }>(
    '/api/notifications',
    (url: string) => fetch(url, { next: { revalidate: 60 } }).then((r) => r.json()),
    { refreshInterval: 60000 },
  );
  return data?.unreadCount ?? 0;
}

function isActive(href: string, pathname: string): boolean {
  return pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
}

export function Navigation() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setDarkMode(isDark);
  }, []);

  const toggleDarkMode = () => {
    const newDark = !darkMode;
    setDarkMode(newDark);
    if (newDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const role = session?.user?.role;
  const signedIn = statusSession(session);
  const home =
    role === 'ADMIN' ? '/admin/dashboard' : role === 'AUTHORITY' ? '/department/dashboard' : '/dashboard';

  return (
    <>
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
          scrolled
            ? 'bg-white/90 dark:bg-dark-bg/90 backdrop-blur-md border-b border-neutral-200 dark:border-dark-border shadow-sm'
            : 'bg-transparent'
        )}
      >
        <nav className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8" aria-label="Main navigation">
          <div className="flex items-center justify-between h-16 md:h-20">
            <Link href="/" className="flex items-center gap-2" aria-label="CivicChain Home">
              <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <span className="font-display font-bold text-xl text-neutral-900 dark:text-white hidden sm:block">
                CivicChain
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {HEADER_NAV.map((item) => {
                const active = isActive(item.href, pathname);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                      active
                        ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                        : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800'
                    )}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon className="w-4 h-4" aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>

            <div className="hidden md:flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={toggleDarkMode} aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </Button>
              {signedIn ? (
                <>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/report">Report Issue</Link>
                  </Button>
                  <Button size="sm" asChild>
                    <Link href={home}>{role === 'ADMIN' ? 'Admin' : role === 'AUTHORITY' ? 'Ops' : 'Dashboard'}</Link>
                  </Button>
                </>
              ) : (
                <Button size="sm" asChild>
                  <Link href="/login">Sign In</Link>
                </Button>
              )}
            </div>

            <button
              className="md:hidden p-2 rounded-lg text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          <div
            id="mobile-menu"
            className={cn(
              'md:hidden overflow-hidden transition-all duration-300 ease-in-out',
              mobileOpen ? 'max-h-[480px] opacity-100' : 'max-h-0 opacity-0'
            )}
            role="navigation"
            aria-label="Mobile navigation"
          >
            <div className="py-4 space-y-1 border-t border-neutral-200 dark:border-dark-border">
              {HEADER_NAV.map((item) => {
                const active = isActive(item.href, pathname);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-all duration-200',
                      active
                        ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                        : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800'
                    )}
                    onClick={() => setMobileOpen(false)}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon className="w-5 h-5" aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              <div className="pt-4 border-t border-neutral-200 dark:border-dark-border flex items-center gap-3 px-4">
                <Button variant="ghost" size="sm" className="w-full justify-start" onClick={toggleDarkMode}>
                  {darkMode ? <Sun className="w-5 h-5 mr-2" /> : <Moon className="w-5 h-5 mr-2" />}
                  {darkMode ? 'Light Mode' : 'Dark Mode'}
                </Button>
              </div>
              <div className="px-4 pt-2 space-y-2">
                {signedIn ? (
                  <>
                    <Button variant="outline" className="w-full justify-start" asChild>
                      <Link href={home} onClick={() => setMobileOpen(false)}>My Workspace</Link>
                    </Button>
                    <Button variant="secondary" className="w-full justify-start" onClick={() => signOut({ callbackUrl: '/' })}>
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" className="w-full justify-start" asChild>
                      <Link href="/report" onClick={() => setMobileOpen(false)}>Report Issue</Link>
                    </Button>
                    <Button className="w-full justify-start" asChild>
                      <Link href="/login" onClick={() => setMobileOpen(false)}>Sign In</Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </nav>
      </header>
    </>
  );
}

function statusSession(session: { user?: { id?: string } | null } | null): boolean {
  return Boolean(session?.user?.id || session?.user);
}

function SidebarShell({
  groups,
  crossLinks,
}: {
  groups: NavGroup[];
  crossLinks: CrossLink[];
}) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const user = session?.user;
  const role = (user as { role?: string } | undefined)?.role;
  const unread = useUnreadCount();

  const renderLink = (item: NavItem) => {
    const active = isActive(item.href, pathname);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
          active
            ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
            : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800'
        )}
        aria-current={active ? 'page' : undefined}
      >
        <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
        <span className="truncate">{item.label}</span>
        {item.href.endsWith('/notifications') && unread > 0 && (
          <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-brand-600 text-white text-xs font-semibold flex items-center justify-center">
            {unread}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:w-64 bg-white dark:bg-dark-bg border-r border-neutral-200 dark:border-dark-border flex flex-col">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-neutral-200 dark:border-dark-border">
        <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <span className="font-display font-bold text-xl text-neutral-900 dark:text-white">CivicChain</span>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-6 overflow-y-auto" aria-label="Sidebar navigation">
        {groups.map((group) => (
          <div key={group.title ?? 'nav'}>
            {group.title && (
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                {group.title}
              </p>
            )}
            <div className="space-y-1">{group.items.map(renderLink)}</div>
          </div>
        ))}
        {crossLinks.filter((link) => link.roles.includes(role as 'CITIZEN' | 'AUTHORITY' | 'ADMIN')).length > 0 && (
          <div className="pt-3 border-t border-neutral-200 dark:border-dark-border space-y-1">
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Other Workspaces
            </p>
            {crossLinks.map(renderLink)}
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-neutral-200 dark:border-dark-border">
        {status === 'authenticated' && user ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                <span className="text-sm font-medium text-brand-700 dark:text-brand-300">{initialsOf(user.name, user.email)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{user.name || user.email || 'Signed in'}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{ROLE_LABELS[(user as { role?: string }).role ?? ''] ?? (user as { role?: string }).role ?? ''}</p>
              </div>
            </div>
            <Button variant="secondary" size="sm" className="w-full justify-start" onClick={() => signOut({ callbackUrl: '/' })}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        ) : (
          <Button className="w-full justify-center" asChild>
            <Link href="/login">Sign In</Link>
          </Button>
        )}
      </div>
    </aside>
  );
}

export function DashboardSidebar() {
  return <SidebarShell groups={CITIZEN_NAV} crossLinks={CITIZEN_CROSS_LINKS} />;
}

export function DepartmentSidebar() {
  return <SidebarShell groups={DEPARTMENT_NAV} crossLinks={DEPARTMENT_CROSS_LINKS} />;
}

export function AdminSidebar() {
  return <SidebarShell groups={ADMIN_NAV} crossLinks={ADMIN_CROSS_LINKS} />;
}