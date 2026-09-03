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
  Building2,
  FileText,
  Users,
  BarChart3,
  Map as MapIcon,
  ShieldAlert,
  ScrollText,
  HeartPulse,
  User,
  Gauge,
  LayoutDashboard,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';
import { NotificationBell } from '@/components/notifications/NotificationBell';

/**
 * Admin Command Center Shell — replaces the traditional sidebar-dominant layout
 * with a top command header that establishes the administrative context at the
 * top-left, matching the "Civic Intelligence Command Center" identity.
 *
 * Structure:
 * ┌──────────────────────────────────────────────────────────────┐
 * │ CIVICCHAIN / ADMIN  [Command nav]    [status] [🔔] [👤]    │
 * ├──────────────────────────────────────────────────────────────┤
 * │                                                            │
 * │                    PAGE CONTENT                            │
 * │                                                            │
 * └──────────────────────────────────────────────────────────────┘
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

const ADMIN_PAGE_META: Array<{ prefix: string; meta: WorkspaceMeta }> = [
  { prefix: '/admin/command-center', meta: { title: 'Command Center', description: 'Real-time civic operations control' } },
  { prefix: '/admin/dashboard', meta: { title: 'Dashboard', description: 'Platform overview and operational intelligence' } },
  { prefix: '/admin/users', meta: { title: 'Users', description: 'Account management and role administration' } },
  { prefix: '/admin/departments', meta: { title: 'Departments', description: 'Authority workload and performance' } },
  { prefix: '/admin/issues', meta: { title: 'Issues', description: 'Report management and resolution tracking' } },
  { prefix: '/admin/analytics', meta: { title: 'Analytics', description: 'Intelligence and trend analysis' } },
  { prefix: '/admin/map', meta: { title: 'Map', description: 'Geographic intelligence operations' } },
  { prefix: '/admin/risk', meta: { title: 'Risk Intelligence', description: 'Predictive risk assessment and hotspots' } },
  { prefix: '/admin/audit', meta: { title: 'Audit Logs', description: 'Administrative action trail' } },
  { prefix: '/admin/health', meta: { title: 'System Health', description: 'Service status and operational probes' } },
  { prefix: '/admin/notifications', meta: { title: 'Notifications', description: 'Alert and notification management' } },
  { prefix: '/admin/profile', meta: { title: 'Profile', description: 'Administrator account settings' } },
  { prefix: '/map', meta: { title: 'Map', description: 'Geographic intelligence operations' } },
  { prefix: '/dashboard/risk', meta: { title: 'Risk Intelligence', description: 'Predictive risk assessment' } },
  { prefix: '/dashboard/notifications', meta: { title: 'Notifications', description: 'Alert management' } },
  { prefix: '/dashboard/settings', meta: { title: 'Profile', description: 'Account settings' } },
];

// ─── Navigation Groups ───────────────────────────────────────────────────────

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    title: 'Command',
    items: [
      { href: '/admin/command-center', label: 'Command Center', icon: Gauge },
      { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Operations',
    items: [
      { href: '/admin/issues', label: 'Issues', icon: FileText },
      { href: '/admin/users', label: 'Users', icon: Users },
      { href: '/admin/departments', label: 'Departments', icon: Building2 },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
      { href: '/admin/map', label: 'Map', icon: MapIcon },
      { href: '/admin/risk', label: 'Risk', icon: ShieldAlert },
    ],
  },
  {
    title: 'Oversight',
    items: [
      { href: '/admin/audit', label: 'Audit', icon: ScrollText },
      { href: '/admin/health', label: 'Health', icon: HeartPulse },
      { href: '/admin/notifications', label: 'Notifications', icon: FileText },
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function headerFor(pathname: string): WorkspaceMeta {
  const hit = ADMIN_PAGE_META.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (hit) return hit.meta;
  const seg = pathname.split('/').filter(Boolean).pop() ?? 'Admin';
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

  return (
    <span className="font-mono text-xs text-neutral-400 dark:text-neutral-500 tabular-nums">
      {time}
    </span>
  );
}

// ─── System Status Pill ──────────────────────────────────────────────────────

function SystemStatusPill() {
  const { data } = useSWR<{ overall: { ok: boolean } }>(
    '/api/admin/health',
    (url: string) => fetch(url).then((r) => r.json()),
    { refreshInterval: 60000 },
  );
  const ok = data?.overall?.ok;
  return (
    <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg-card px-2.5 py-1.5">
      <span className="relative flex h-1.5 w-1.5">
        <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-60', ok !== false ? 'animate-ping bg-emerald-400' : 'bg-red-400')} />
        <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', ok !== false ? 'bg-emerald-500' : 'bg-red-500')} />
      </span>
      <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
        {ok === false ? 'ALERT' : 'OPERATIONAL'}
      </span>
    </div>
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
        <div className="lg:hidden fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Admin navigation">
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
            onClick={onClose}
          />
          <motion.aside
            className="absolute inset-y-0 left-0 w-[80vw] max-w-80 flex flex-col bg-white dark:bg-dark-bg border-r border-neutral-200 dark:border-dark-border shadow-2xl"
            initial={reduce ? { x: -320 } : { x: -320 }}
            animate={{ x: 0 }}
            exit={reduce ? { x: -320 } : { x: -320 }}
            transition={{ type: 'tween', duration: reduce ? 0 : 0.25, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-dark-border">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-500 dark:text-brand-400">Admin</p>
                <p className="text-sm font-display font-bold text-neutral-900 dark:text-white">CivicChain</p>
              </div>
              <button type="button" onClick={onClose} aria-label="Close menu" className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
              {ADMIN_NAV_GROUPS.map((group) => (
                <div key={group.title}>
                  <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-400 dark:text-neutral-500">
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
                          onClick={onClose}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                            active
                              ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                              : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800',
                          )}
                        >
                          <Icon className={cn('w-4 h-4 shrink-0', active ? 'text-brand-600 dark:text-brand-300' : 'text-neutral-400')} aria-hidden="true" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

// ─── AdminShell ──────────────────────────────────────────────────────────────

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // key={pathname} forces remount on route change, naturally resetting drawer/profile state
  return <AdminShellInner key={pathname} pathname={pathname}>{children}</AdminShellInner>;
}

function AdminShellInner({ children, pathname }: { children: React.ReactNode; pathname: string }) {
  const reduce = useReducedMotion();
  const { data: session } = useSession();
  const user = (session?.user ?? null) as SessionUserLike | null;
  const meta = headerFor(pathname);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);

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

      {/* ─── TOP COMMAND HEADER ─────────────────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-40 bg-white/95 dark:bg-dark-bg/95 backdrop-blur-md border-b border-neutral-200/80 dark:border-dark-border/80">
        <div className="flex items-center justify-between h-14 px-4 md:px-6 lg:px-8">
          {/* LEFT — Admin identity */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              className="lg:hidden p-1.5 -ml-1.5 rounded-lg text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <Link href="/admin/dashboard" className="flex items-center gap-2.5 shrink-0" aria-label="CivicChain Admin">
              {/* CivicChain brand mark */}
              <span className="w-7 h-7 rounded-md bg-brand-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </span>
              <div className="hidden sm:block">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-500 dark:text-brand-400 leading-none">
                  Admin
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
          <nav className="hidden lg:flex items-center gap-0.5" aria-label="Admin command navigation">
            {ADMIN_NAV_GROUPS.map((group) => {
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
                        ? 'text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/30'
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
                                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                                    : 'text-neutral-600 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800',
                                )}
                              >
                                <Icon className={cn('w-4 h-4', active ? 'text-brand-600 dark:text-brand-300' : 'text-neutral-400')} />
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
                        {user?.name || user?.email || 'Administrator'}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{user?.email}</p>
                      <span className="mt-1.5 inline-block text-[10px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/30 px-2 py-0.5 rounded-full border border-brand-100 dark:border-brand-800">
                        Administrator
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
      <main className="pt-14 min-h-screen">
        <div className="w-full max-w-[1600px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
