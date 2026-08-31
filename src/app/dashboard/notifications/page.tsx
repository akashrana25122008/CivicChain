'use client';

import useSWR from 'swr';
import { useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Bell, CheckCheck, ArrowRight } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

interface NotificationsResponse {
  notifications: Array<{
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
  }>;
  unreadCount: number;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function NotificationsPage() {
  const { data, isLoading, mutate } = useSWR<NotificationsResponse>(
    '/api/notifications',
    fetcher,
    { refreshInterval: 30000 },
  );

  const markRead = useCallback(
    async (id: string) => {
      if (!data) return;
      const optimistic = {
        ...data,
        notifications: data.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
        unreadCount: Math.max(0, data.unreadCount - 1),
      };
      await mutate(optimistic, false);
      await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: true }),
      }).catch(() => {
        mutate();
      });
    },
    [data, mutate],
  );

  const markAllRead = useCallback(async () => {
    if (!data) return;
    const optimistic = {
      ...data,
      notifications: data.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    };
    await mutate(optimistic, false);
    const res = await fetch(`/api/notifications/read-all`, { method: 'POST' });
    if (!res.ok) await mutate();
  }, [data, mutate]);

  const notifications = data?.notifications ?? [];

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-neutral-900 dark:text-white">Notifications</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-2">
            {data ? `${data.unreadCount} unread • stored in the database` : 'Loading…'}
          </p>
        </div>
        {data && data.unreadCount > 0 && (
          <Button variant="secondary" size="sm" onClick={markAllRead}>
            <CheckCheck className="w-4 h-4 mr-2" />
            Mark all as read
          </Button>
        )}
      </div>

      <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
        <CardContent className="p-0">
          {isLoading && !data ? (
            <div className="divide-y divide-neutral-200 dark:divide-dark-border">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 bg-neutral-100 dark:bg-dark-border animate-pulse" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center">
              <Bell className="w-10 h-10 text-neutral-300 dark:text-neutral-600 mx-auto mb-3" />
              <p className="text-sm text-neutral-500">No notifications yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-200 dark:divide-dark-border">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => !n.read && markRead(n.id)}
                  disabled={n.read}
                  className={cn(
                    'w-full text-left p-5 transition-colors',
                    !n.read
                      ? 'bg-brand-50/50 dark:bg-brand-900/10 hover:bg-brand-50 dark:hover:bg-brand-900/20'
                      : 'hover:bg-neutral-50 dark:hover:bg-dark-bg',
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className={cn('text-sm font-medium', n.read ? 'text-neutral-500 dark:text-neutral-400' : 'text-neutral-900 dark:text-white')}>
                        {n.title}
                      </p>
                      {n.message && (
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{n.message}</p>
                      )}
                      <p className="text-xs text-neutral-400 mt-2 font-mono">
                        {formatDate(n.createdAt)} • {n.timeLabel}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {(n.link || n.issuePublicId) && (
                        <Link
                          href={n.link ?? (n.issueId ? `/dashboard/issues/${n.issueId}` : '#')}
                          className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 inline-flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {n.issuePublicId ? `${n.issuePublicId} ` : 'View'}
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      )}
                      {!n.read && <span className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0" aria-label="Unread" />}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}