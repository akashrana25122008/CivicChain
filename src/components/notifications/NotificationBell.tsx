'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Bell, CheckCheck, ArrowRight } from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';

/**
 * Header notification bell with a recent-notifications dropdown (Phase 13).
 *
 * Shows the unread badge and a hover/click dropdown of the newest notifications
 * with one-click "mark all read" and a link to the full feed. Data comes from
 * the same authenticated `/api/notifications` endpoint as the side nav badge.
 */

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string | null;
  read: boolean;
  issueId: string | null;
  issuePublicId: string | null;
  link: string | null;
  createdAt: string;
  timeLabel: string;
}

interface NotificationsResponse {
  notifications: NotificationItem[];
  unreadCount: number;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function NotificationBell() {
  const { data, mutate } = useSWR<NotificationsResponse>(
    '/api/notifications',
    fetcher,
    { refreshInterval: 30000 },
  );
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  const notifications = data?.notifications ?? [];
  const unread = data?.unreadCount ?? 0;

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const markAllRead = async () => {
    if (unread === 0) return;
    const optimistic: NotificationsResponse = {
      notifications: notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    };
    await mutate(optimistic, false);
    const res = await fetch('/api/notifications/read-all', { method: 'POST' });
    if (!res.ok) await mutate();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        className="relative p-2 rounded-lg text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
      >
        <Bell className="w-5 h-5" aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-brand-600 text-white text-[10px] font-semibold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg-card shadow-lg overflow-hidden z-50"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-dark-border">
              <p className="text-sm font-semibold text-neutral-900 dark:text-white">Notifications</p>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="inline-flex items-center gap-1.5 text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700"
                >
                  <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-10 text-center">
                  <Bell className="w-8 h-8 text-neutral-300 dark:text-neutral-600 mx-auto mb-2" aria-hidden="true" />
                  <p className="text-sm text-neutral-500">No notifications yet.</p>
                </div>
              ) : (
                notifications.slice(0, 8).map((n) => (
                  <Link
                    key={n.id}
                    href={n.link ?? (n.issueId ? `/dashboard/issues/${n.issueId}` : '/dashboard/notifications')}
                    role="menuitem"
                    onClick={() => {
                      if (!n.read) {
                        mutate({
                          notifications: notifications.map((x) =>
                            x.id === n.id ? { ...x, read: true } : x,
                          ),
                          unreadCount: Math.max(0, unread - 1),
                        }, false);
                        fetch(`/api/notifications/${n.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ read: true }),
                        });
                      }
                      setOpen(false);
                    }}
                    className={cn(
                      'block w-full text-left px-4 py-3 border-b border-neutral-100 dark:border-dark-border transition-colors',
                      !n.read ? 'bg-brand-50/50 dark:bg-brand-900/10' : 'hover:bg-neutral-50 dark:hover:bg-dark-bg',
                    )}
                  >
                    <p className={cn('text-sm', n.read ? 'text-neutral-500 dark:text-neutral-400' : 'font-medium text-neutral-900 dark:text-white')}>
                      {n.title}
                    </p>
                    {n.message && (
                      <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5 line-clamp-2">
                        {n.message}
                      </p>
                    )}
                    <p className="text-[11px] text-neutral-400 mt-1">
                      {formatRelativeTime(n.createdAt)}
                    </p>
                  </Link>
                ))
              )}
            </div>

            <div className="px-4 py-2.5 border-t border-neutral-200 dark:border-dark-border">
              <Link
                href="/dashboard/notifications"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700"
              >
                View all notifications <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
