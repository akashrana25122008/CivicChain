'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import useSWR from 'swr';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ChevronDown,
  LogOut,
  Menu,
  X,
  Gauge,
  LayoutDashboard,
  FileText,
  ShieldCheck,
  AlertTriangle,
  BarChart3,
  Map as MapIcon,
  User,
  PanelLeft,
  PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';

/**
 * DepartmentShell — the primary layout for the Department Operations workspace.
 *
 * Structure:
 * ┌──────────────────────────────────────────────────────────────┐
 * │ CIVICCHAIN / DEPARTMENT  [Command nav]  [status] [🔔] [👤] │
 * ├──────────────────────────────────────────────────────────────┤
 * │                                                            │
 * │                    PAGE CONTENT                            │
 * │                                                            │
 * └──────────────────────────────────────────────────────────────┘
 *
 * Identity: Teal/Cyan accent (distinct from Admin blue, Citizen green)
 */

interface SessionUserLike {
  id?: string;
  role?: string;
  name?: string | null;
  email?: string | null;
}

interface WorkspaceMeta {
  title: string;
  description?: string;
}

const DEPT_PAGE_META: Array<{ prefix: string; meta: WorkspaceMeta }> = [
  { prefix: '/department/command-center', meta: { title: 'Command Center', description: 'Real-time operational control' } },
  { prefix: '/department/dashboard', meta: { title: 'Dashboard', description: 'Department operations overview' } },
  { prefix: '/department/issues', meta: { title: 'Issues', description: 'Assigned issue management' } },
  { prefix: '/department/verification', meta: { title: 'Verification', description: 'Evidence verification queue' } },
  { prefix: '/department/escalations', meta: { title: 'Escalations', description: 'Escalation management' } },
  { prefix: '/department/performance', meta: { title: 'Performance', description: 'Department performance metrics' } },
  { prefix: '/map', meta: { title: 'Map', description: 'Geographic intelligence' } },
  { prefix: '/dashboard/risk', meta: { title: 'Risk Intelligence', description: 'Predictive risk assessment' } },
  { prefix: '/dashboard/notifications', meta: { title: 'Notifications', description: 'Alert management' } },
  { prefix: '/dashboard/settings', meta: { title: 'Profile', description: 'Account settings' } },
];

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const DEPT_NAV_GROUPS: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      { href: '/department/command-center', label: 'Command Center', icon: Gauge },
      { href: '/department/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Operations',
    items: [
      { href: '/department/issues', label: 'Issues', icon: FileText },
      { href: '/department/verification', label: 'Verification', icon: ShieldCheck },
      { href: '/department/escalations', label: 'Escalations', icon: AlertTriangle },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { href: '/department/performance', label: 'Performance', icon: BarChart3 },
      { href: '/map', label: 'Map', icon: MapIcon },
    ],
  },
];

function headerFor(pathname: string): WorkspaceMeta {
  const hit = DEPT_PAGE_META.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (hit) return hit.meta;
  const seg = pathname.split('/').filter(Boolean).pop() ?? 'Department';
  const label = seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ');
  return { title: label };
}

function isActive(href: string, pathname: string): boolean {
  if (pathname === href) return true;
  return href !== '/' && pathname.startsWith(`${href}/`);
}

function initialsOf(name?: string | null, email?: string | null): string {
  const source = name || email || '?';
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

// ─── Live Clock ──────────────────────────────────────────────────────────────

function LiveClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="text-xs font-mono text-neutral-400 dark:text-neutral-500">{time}</span>;
}

// ─── System Status Pill ──────────────────────────────────────────────────────

function SystemStatusPill() {
  const { data } = useSWR<{ overall: { ok: boolean } }>(
    '/api/admin/health',
    (url: string) => fetch(url).then((r) => r.json()),
    { refreshInterval: 60_000 },
  );
  const ok = data?.overall?.ok;
  return (
    <div className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-md border border-neutral-200 dark:border-dark-border bg-neutral-50 dark:bg-dark-bg text-xs">
      <span className={cn('w-1.5 h-1.5 rounded-full', ok === false ? 'bg-red-500' : ok ? 'bg-emerald-500' : 'bg-neutral-300')} />
      <span className="text-neutral-500 dark:text-neutral-400 font-medium">{ok === false ? 'Issues' : ok ? 'Operational' : 'Checking'}</span>
    </div>
  );
}

// ─── Notification Bell ───────────────────────────────────────────────────────

function NotificationBell() {
  const { data } = useSWR<{ unreadCount: number }>(
    '/api/notifications',
    (url: string) => fetch(url).then((r) => r.json()),
    { refreshInterval: 30_000 },
  );
  const count = data?.unreadCount ?? 0;
  return (
    <Link
      href="/dashboard/notifications"
      className="relative p-1.5 rounded-lg text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
      aria-label={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
      </svg>
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  );
}

// ─── Mobile Nav Drawer ───────────────────────────────────────────────────────

function MobileNavDrawer({
  open,
  onClose,
  pathname,
}: {
  open: boolean;
  onClose: () => void;
  pathname: string;
}) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.aside
            initial={reduce ? { opacity: 0 } : { x: -280 }}
            animate={{ x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: -280 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-dark-bg border-r border-neutral-200 dark:border-dark-border shadow-xl overflow-y-auto"
          >
            <div className="flex items-center justify-between p-4 border-b border-neutral-100 dark:border-dark-border">
              <span className="text-sm font-bold text-neutral-900 dark:text-white">Navigation</span>
              <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label="Close menu">
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>
            <nav className="p-3 space-y-4" aria-label="Mobile department navigation">
              {DEPT_NAV_GROUPS.map((group) => (
                <div key={group.title}>
                  <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-400 dark:text-neutral-500">{group.title}</p>
                  {group.items.map((item) => {
                    const active = isActive(item.href, pathname);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        className={cn(
                          'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                          active
                            ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300'
                            : 'text-neutral-600 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800',
                        )}
                      >
                        <Icon className={cn('w-4 h-4', active ? 'text-teal-600 dark:text-teal-300' : 'text-neutral-400')} />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

// ─── Vertical nav (used by the persistent left panel) ───────────────────────

function DepartmentVerticalNav({ pathname }: { pathname: string }) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4 scrollbar-thin" aria-label="Department navigation">
      {DEPT_NAV_GROUPS.map((group) => (
        <div key={group.title}>
          <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-400 dark:text-neutral-500">
            {group.title}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(item.href, pathname);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150',
                    active
                      ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300'
                      : 'text-neutral-600 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800',
                  )}
                >
                  {active && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-teal-600"
                      aria-hidden="true"
                    />
                  )}
                  <Icon
                    className={cn(
                      'w-4 h-4 shrink-0 transition-colors',
                      active ? 'text-teal-600 dark:text-teal-300' : 'text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300',
                    )}
                    aria-hidden="true"
                  />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

// ─── DepartmentShell ─────────────────────────────────────────────────────────

export function DepartmentShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // key={pathname} forces remount on route change, naturally resetting drawer/profile state
  return <DepartmentShellInner key={pathname} pathname={pathname}>{children}</DepartmentShellInner>;
}

function DepartmentShellInner({ children, pathname }: { children: React.ReactNode; pathname: string }) {
  const reduce = useReducedMotion();
  const { data: session } = useSession();
  const user = (session?.user ?? null) as SessionUserLike | null;
  const meta = headerFor(pathname);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [navMode, setNavMode] = useState<'header' | 'sidebar'>('header');
  const profileRef = useRef<HTMLDivElement>(null);

  // Read persisted nav preference once after hydration (server always renders 'header').
  useEffect(() => {
    const saved = window.localStorage.getItem('cc-dept-nav-mode');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration sync from localStorage
    if (saved === 'sidebar') setNavMode('sidebar');
  }, []);
  // Persist on change.
  useEffect(() => {
    window.localStorage.setItem('cc-dept-nav-mode', navMode);
  }, [navMode]);

  // Close profile on outside click / Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawerOpen(false);
        setProfileOpen(false);
        setActiveGroup(null);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-dark-bg text-neutral-900">
      {/* Mobile nav drawer */}
      <MobileNavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} pathname={pathname} />

      {/* Persistent left panel — shown when the command nav is docked to the sidebar */}
      {navMode === 'sidebar' && (
        <aside className="fixed inset-y-0 left-0 top-0 z-30 hidden lg:flex lg:w-64 flex-col bg-white dark:bg-dark-bg border-r border-neutral-200 dark:border-dark-border">
          <div className="flex items-center justify-between gap-2 px-4 py-4 border-b border-neutral-200 dark:border-dark-border">
            {/* Return-to-header toggle (top of the left panel) */}
            <button
              type="button"
              onClick={() => setNavMode('header')}
              className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/30 hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors"
              aria-label="Move navigation back to the header"
              title="Move navigation back to the header"
            >
              <PanelLeftOpen className="w-4 h-4" />
              Header
            </button>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
              Navigation
            </span>
          </div>
          <DepartmentVerticalNav pathname={pathname} />
          <div className="p-3 border-t border-neutral-200 dark:border-dark-border">
            <p className="text-[11px] text-neutral-400 dark:text-neutral-500 text-center">
              Department Operations
            </p>
          </div>
        </aside>
      )}

      {/* ─── TOP COMMAND HEADER ─────────────────────────────────────────── */}
      <header className={cn('fixed top-0 inset-x-0 z-40 bg-white/95 dark:bg-dark-bg/95 backdrop-blur-md border-b border-neutral-200/80 dark:border-dark-border/80', navMode === 'sidebar' && 'lg:left-64')}>
        <div className="flex items-center justify-between h-14 px-4 md:px-6 lg:px-8">
          {/* LEFT — Department identity */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              className="lg:hidden p-1.5 -ml-1.5 rounded-lg text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <Link href="/department/command-center" className="flex items-center gap-2.5 shrink-0" aria-label="CivicChain Department">
              {/* Department brand mark — teal accent */}
              <span className="w-7 h-7 rounded-md bg-teal-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </span>
              <div className="hidden sm:block">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-600 dark:text-teal-400 leading-none">
                  Department
                </p>
                <p className="text-sm font-display font-bold text-neutral-900 dark:text-white leading-tight">
                  CivicChain
                </p>
              </div>
            </Link>

            {/* Separator + current section */}
            <div className="hidden md:flex items-center gap-2 ml-1">
              <span className="text-neutral-300 dark:text-neutral-600">/</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-800 dark:text-white truncate">
                  {meta.title}
                </p>
                {meta.description && (
                  <p className="text-[11px] text-neutral-400 dark:text-neutral-500 truncate hidden lg:block">
                    {meta.description}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* CENTER — Command navigation (desktop) */}
          {navMode === 'header' && (
            <div className="hidden lg:flex items-center gap-0.5">
              {/* Toggle: dock the command nav into the left panel */}
              <button
                type="button"
                onClick={() => setNavMode('sidebar')}
                className="mr-1 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors uppercase tracking-wider text-neutral-500 dark:text-neutral-400 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-900/30"
                aria-label="Move navigation to the left panel"
                title="Move navigation to the left panel"
              >
                <PanelLeft className="w-4 h-4" />
                Sidebar
              </button>
              <nav className="flex items-center gap-0.5" aria-label="Department command navigation">
                {DEPT_NAV_GROUPS.map((group) => {
                  const hasActive = group.items.some((item) => isActive(item.href, pathname));
                  return (
                    <div
                      key={group.title}
                      className="relative"
                      onMouseEnter={() => setActiveGroup(group.title)}
                      onMouseLeave={() => setActiveGroup(null)}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveGroup(activeGroup === group.title ? null : group.title)}
                        className={cn(
                          'px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors uppercase tracking-wider',
                          hasActive
                            ? 'text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/30'
                            : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 dark:hover:text-white dark:hover:bg-neutral-800',
                        )}
                      >
                        {group.title}
                      </button>
                      <AnimatePresence>
                        {activeGroup === group.title && (
                          <motion.div
                            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
                            transition={{ duration: 0.12 }}
                            className="absolute top-full left-0 mt-1 w-52 rounded-xl border border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg-card shadow-lg overflow-hidden z-50"
                          >
                            <div className="p-1.5">
                              {group.items.map((item) => {
                                const active = isActive(item.href, pathname);
                                const Icon = item.icon;
                                return (
                                  <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                      'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                                      active
                                        ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300'
                                        : 'text-neutral-600 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800',
                                    )}
                                  >
                                    <Icon className={cn('w-4 h-4', active ? 'text-teal-600 dark:text-teal-300' : 'text-neutral-400')} />
                                    {item.label}
                                  </Link>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </nav>
            </div>
          )}

          {/* RIGHT — Status, notifications, profile */}
          <div className="flex items-center gap-1.5 md:gap-2">
            <SystemStatusPill />
            <LiveClock />
            <NotificationBell />
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen((v) => !v)}
                aria-expanded={profileOpen}
                aria-haspopup="menu"
                className="flex items-center gap-1.5 rounded-lg p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <Avatar size="sm" fallback={initialsOf(user?.name, user?.email)} />
                <ChevronDown className={cn('hidden sm:block w-3.5 h-3.5 text-neutral-400 transition-transform duration-150', profileOpen && 'rotate-180')} />
              </button>
              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    role="menu"
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-64 rounded-xl border border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg-card shadow-lg overflow-hidden z-50"
                  >
                    <div className="px-4 py-3 border-b border-neutral-200 dark:border-dark-border">
                      <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
                        {user?.name || user?.email || 'Department User'}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{user?.email}</p>
                      <span className="mt-1.5 inline-block text-[10px] font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/30 px-2 py-0.5 rounded-full border border-teal-100 dark:border-teal-800">
                        Department
                      </span>
                    </div>
                    <div className="p-1.5">
                      <Link href="/dashboard/settings" role="menuitem" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                        <User className="w-4 h-4 text-neutral-400" />
                        Profile & Settings
                      </Link>
                      <button type="button" role="menuitem" onClick={() => signOut({ callbackUrl: '/' })} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left">
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      {/* ─── MAIN CONTENT ───────────────────────────────────────────────── */}
      <main className={cn('pt-14 min-h-screen', navMode === 'sidebar' && 'lg:pl-64')}>
        <div className="w-full max-w-[1600px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
