'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import useSWR from 'swr';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, LogOut, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import {
  ROLE_LABELS,
  navForRole,
  type WorkspaceNavGroup,
} from './workspaceNav';

/**
 * Persistent application workspace: role-aware left sidebar + top header.
 * Auth is enforced upstream (Proxy + server layouts). This component only
 * decides HOW the signed-in workspace is rendered — never what a user may
 * access. The nav is keyed off the session role (written at sign-in from the
 * authoritative database record), so a stale or forged client role gets the
 * citizen view at worst — the server still rejects anything out of scope.
 *
 * Visual identity: clean light theme (white cards, neutral surfaces) with the
 * CivicChain brand scale applied selectively as accents — primary buttons,
 * active nav, logo, unread badges, focus/hover states.
 */

interface WorkspaceMeta {
  title: string;
  description?: string;
}

const HEADER_META: Array<{ prefix: string; meta: WorkspaceMeta }> = [
  { prefix: '/report', meta: { title: 'Report an Issue', description: 'Submit a civic issue with evidence and a precise location.' } },
  { prefix: '/my-reports', meta: { title: 'My Reports', description: 'Everything you have reported and its current status.' } },
  { prefix: '/map', meta: { title: 'Civic Map', description: 'Live geographic view of real civic reports.' } },
  { prefix: '/dashboard/issues', meta: { title: 'Civic Issues', description: 'Community reports, from submission to resolution.' } },
  { prefix: '/dashboard/notifications', meta: { title: 'Notifications', description: 'Updates on your reports, promises and escalations.' } },
  { prefix: '/dashboard/settings', meta: { title: 'Profile & Settings', description: 'Manage your account and preferences.' } },
  { prefix: '/dashboard/community', meta: { title: 'Community', description: 'Citizen community activity.' } },
  { prefix: '/dashboard/promises', meta: { title: 'Promises', description: 'Deadline-tracked commitments.' } },
  { prefix: '/dashboard/verification', meta: { title: 'Verification', description: 'Community evidence verification.' } },
  { prefix: '/dashboard/escalations', meta: { title: 'Escalations', description: 'Issues that escalated beyond their deadline.' } },
  { prefix: '/dashboard/risk', meta: { title: 'Risk Intelligence', description: 'Predictive signals for the city.' } },
  { prefix: '/dashboard', meta: { title: 'Civic Dashboard', description: 'Monitor your civic reports and community activity.' } },
  { prefix: '/department/issues', meta: { title: 'Department Workbench', description: 'Issues assigned to your department.' } },
  { prefix: '/department/verification', meta: { title: 'Evidence Verification', description: 'Review reported evidence for accuracy.' } },
  { prefix: '/department/escalations', meta: { title: 'Escalations', description: 'Escalated issues that need attention.' } },
  { prefix: '/department/performance', meta: { title: 'Department Performance', description: 'Resolution metrics from the real audit trail.' } },
  { prefix: '/department/dashboard', meta: { title: 'Department Operations', description: 'Manage assigned civic issues and resolution workflows.' } },
  { prefix: '/admin/users', meta: { title: 'Users', description: 'Everyone registered on CivicChain.' } },
  { prefix: '/admin/departments', meta: { title: 'Departments', description: 'Authorities and their live workload.' } },
  { prefix: '/admin/issues', meta: { title: 'Issue Management', description: 'Manage every report on the platform.' } },
  { prefix: '/admin/analytics', meta: { title: 'Analytics', description: 'Platform-wide trends and patterns.' } },
  { prefix: '/admin/audit', meta: { title: 'Audit Logs', description: 'Chronological trail of every business action.' } },
  { prefix: '/admin/health', meta: { title: 'System Health', description: 'Liveness of CivicChain services.' } },
  { prefix: '/admin/dashboard', meta: { title: 'CivicChain Control Center', description: 'Monitor the complete civic ecosystem.' } },
];

function headerFor(pathname: string): WorkspaceMeta {
  const hit = HEADER_META.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (hit) return hit.meta;
  const seg = pathname.split('/').filter(Boolean).pop() ?? 'Workspace';
  const label = seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ');
  return { title: label };
}

function isActive(href: string, pathname: string): boolean {
  if (href === '/map') {
    return pathname === '/map' || pathname.startsWith('/dashboard/map');
  }
  if (pathname === href) return true;
  return href !== '/' && pathname.startsWith(`${href}/`);
}

function initialsOf(name?: string | null, email?: string | null): string {
  const source = name || email || '?';
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

interface SessionUserLike {
  id?: string;
  role?: string;
  name?: string | null;
  email?: string | null;
}

function useUnreadCount(): number {
  const { data } = useSWR<{ unreadCount: number }>(
    '/api/notifications',
    (url: string) => fetch(url, { next: { revalidate: 60 } }).then((r) => r.json()),
    { refreshInterval: 60000 },
  );
  return data?.unreadCount ?? 0;
}

function BrandMark() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="CivicChain Home">
      <span className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      </span>
      <span className="font-display font-bold text-lg text-neutral-900 dark:text-white">
        CivicChain
      </span>
    </Link>
  );
}

function NavList({
  groups,
  pathname,
  onNavigate,
}: {
  groups: WorkspaceNavGroup[];
  pathname: string;
  onNavigate?: () => void;
}) {
  const unread = useUnreadCount();
  return (
    <nav aria-label="Workspace navigation" className="flex-1 overflow-y-auto px-3 py-5 space-y-5 scrollbar-thin">
      {groups.map((group) => (
        <div key={group.title}>
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
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
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150',
                    active
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800',
                  )}
                >
                  {active && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-brand-600"
                      aria-hidden="true"
                    />
                  )}
                  <Icon
                    className={cn(
                      'w-4 h-4 shrink-0 transition-colors duration-150',
                      active ? 'text-brand-600 dark:text-brand-300' : 'text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300',
                    )}
                    aria-hidden="true"
                  />
                  <span className="truncate">{item.label}</span>
                  {item.href.endsWith('/notifications') && unread > 0 && (
                    <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-brand-600 text-white text-xs font-semibold flex items-center justify-center">
                      {unread}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function UserBlock({
  user,
  onNavigate,
}: {
  user: SessionUserLike | null;
  onNavigate?: () => void;
}) {
  const role = (user?.role ?? 'CITIZEN') as 'CITIZEN' | 'AUTHORITY' | 'ADMIN';
  return (
    <div className="p-3 border-t border-neutral-200 dark:border-dark-border">
      <div className="flex items-center gap-3 px-2 py-2">
        <Avatar size="sm" fallback={initialsOf(user?.name, user?.email)} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
            {user?.name || user?.email || 'Signed in'}
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
            {ROLE_LABELS[role] ?? role}
          </p>
        </div>
      </div>
      <Button
        variant="secondary"
        size="sm"
        className="w-full justify-start mt-1"
        onClick={() => signOut({ callbackUrl: '/' })}
      >
        <LogOut className="w-4 h-4" aria-hidden="true" />
        Sign Out
      </Button>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const { data: session } = useSession();
  const user = (session?.user ?? null) as SessionUserLike | null;
  const role = user?.role ?? null;
  const groups = navForRole(role);
  const meta = headerFor(pathname);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDrawerOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawerOpen(false);
        setProfileOpen(false);
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
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden lg:flex lg:w-64 flex-col bg-white dark:bg-dark-bg border-r border-neutral-200 dark:border-dark-border">
        <div className="flex items-center px-5 py-5 border-b border-neutral-200 dark:border-dark-border">
          <BrandMark />
        </div>
        <NavList groups={groups} pathname={pathname} />
        <UserBlock user={user} />
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <div className="lg:hidden fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Workspace navigation">
            <motion.div
              className="absolute inset-0 bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.2 }}
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              className="absolute inset-y-0 left-0 w-[78vw] max-w-72 flex flex-col bg-white dark:bg-dark-bg border-r border-neutral-200 dark:border-dark-border"
              initial={reduce ? { x: -288 } : { x: -300 }}
              animate={{ x: 0 }}
              exit={reduce ? { x: -288 } : { x: -300 }}
              transition={{ type: 'tween', duration: reduce ? 0 : 0.25, ease: [0.4, 0, 0.2, 1] }}
            >
              <div className="flex items-center justify-between px-5 py-5 border-b border-neutral-200 dark:border-dark-border">
                <BrandMark />
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close menu"
                  className="p-2 rounded-lg text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
              <NavList groups={groups} pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
              <UserBlock user={user} onNavigate={() => setDrawerOpen(false)} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Main column */}
      <div className="lg:pl-64">
        {/* Top header */}
        <header className="sticky top-0 z-30 bg-white/90 dark:bg-dark-bg/90 backdrop-blur-md border-b border-neutral-200 dark:border-dark-border">
          <div className="flex items-center justify-between gap-4 px-4 md:px-6 lg:px-8 h-16">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                className="lg:hidden p-2 -ml-2 rounded-lg text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                onClick={() => setDrawerOpen(true)}
                aria-label="Open navigation menu"
              >
                <Menu className="w-5 h-5" aria-hidden="true" />
              </button>
              <div className="min-w-0">
                <h1 className="font-display text-lg md:text-xl font-bold text-neutral-900 dark:text-white truncate">
                  {meta.title}
                </h1>
                {meta.description && (
                  <p className="hidden sm:block text-xs text-neutral-500 dark:text-neutral-400 truncate">
                    {meta.description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 md:gap-2">
              {/* Notifications */}
              <NotificationBell />

              {/* Profile / role indicator */}
              <div className="relative" ref={profileRef}>
                <button
                  type="button"
                  onClick={() => setProfileOpen((v) => !v)}
                  aria-expanded={profileOpen}
                  aria-haspopup="menu"
                  className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <Avatar size="sm" fallback={initialsOf(user?.name, user?.email)} />
                  <span className="hidden md:flex flex-col items-start text-left leading-tight">
                    <span className="text-sm font-medium text-neutral-900 dark:text-white max-w-40 truncate">
                      {user?.name || user?.email || 'Signed in'}
                    </span>
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      {ROLE_LABELS[(role as 'CITIZEN' | 'AUTHORITY' | 'ADMIN') ?? 'CITIZEN'] ?? role}
                    </span>
                  </span>
                  <ChevronDown
                    className={cn('hidden md:block w-4 h-4 text-neutral-400 transition-transform duration-200', profileOpen && 'rotate-180')}
                    aria-hidden="true"
                  />
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
                          {user?.name || user?.email || 'Signed in'}
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{user?.email}</p>
                        <span className="mt-1.5 inline-block text-[10px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/30 px-2 py-0.5 rounded-full border border-brand-100 dark:border-brand-800">
                          {ROLE_LABELS[(role as 'CITIZEN' | 'AUTHORITY' | 'ADMIN') ?? 'CITIZEN'] ?? role}
                        </span>
                      </div>
                      <div className="p-1.5">
                        <Link
                          href="/dashboard/settings"
                          role="menuitem"
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                        >
                          Profile & Settings
                        </Link>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => signOut({ callbackUrl: '/' })}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
                        >
                          <LogOut className="w-4 h-4" aria-hidden="true" />
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

        <main className="w-full max-w-[1600px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
