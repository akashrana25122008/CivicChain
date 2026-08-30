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
} from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  CITIZEN: 'Citizen Reporter',
  AUTHORITY: 'Civic Authority',
  ADMIN: 'Administrator',
};

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/map', label: 'Civic Map', icon: MapPin },
  { href: '/dashboard/issues', label: 'Issues', icon: FileText },
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
  { href: '/dashboard/promises', label: 'Promises', icon: Gavel },
  { href: '/dashboard/escalations', label: 'Escalations', icon: AlertTriangle },
  { href: '/dashboard/verification', label: 'AI Verification', icon: Search },
  { href: '/dashboard/risk', label: 'Risk Intelligence', icon: BarChart3 },
  { href: '/dashboard/community', label: 'Community', icon: Users },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

const PERSONAL_ITEMS = [{ href: '/my-reports', label: 'My Reports', icon: ClipboardList }];

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

export function Navigation() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
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

  const signedIn = status === 'authenticated' && !!session?.user;

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
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                        : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800'
                    )}
                    aria-current={isActive ? 'page' : undefined}
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
                    <Link href="/dashboard">Dashboard</Link>
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
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-all duration-200',
                      isActive
                        ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                        : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800'
                    )}
                    onClick={() => setMobileOpen(false)}
                    aria-current={isActive ? 'page' : undefined}
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
                      <Link href="/my-reports" onClick={() => setMobileOpen(false)}>My Reports</Link>
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

export function DashboardSidebar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const user = session?.user;
  const unread = useUnreadCount();

  const renderNav = (items: typeof NAV_ITEMS) =>
    items.map((item) => {
      const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
      const Icon = item.icon;
      return (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
            isActive
              ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800'
          )}
          aria-current={isActive ? 'page' : undefined}
        >
          <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
          <span className="truncate">{item.label}</span>
          {item.href === '/dashboard/notifications' && unread > 0 && (
            <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-brand-600 text-white text-xs font-semibold flex items-center justify-center">
              {unread}
            </span>
          )}
        </Link>
      );
    });

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

      <nav className="flex-1 px-4 py-6 space-y-4 overflow-y-auto" aria-label="Dashboard navigation">
        <div className="space-y-1">{renderNav(NAV_ITEMS)}</div>
        {status === 'authenticated' && (
          <>
            <div className="pt-3 border-t border-neutral-200 dark:border-dark-border space-y-1">
              {renderNav(PERSONAL_ITEMS)}
              {user?.role === 'ADMIN' && (
                <Link
                  href="/admin"
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                    pathname.startsWith('/admin')
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800'
                  )}
                >
                  <ShieldCheck className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                  <span className="truncate">Admin Panel</span>
                </Link>
              )}
            </div>
          </>
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
                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{ROLE_LABELS[user.role] ?? user.role}</p>
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