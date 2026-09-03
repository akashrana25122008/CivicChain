'use client';

import useSWR from 'swr';
import { Card, CardContent } from '@/components/ui/Card';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingBlock } from '@/components/dashboard/LoadingBlock';
import { ErrorState } from '@/components/dashboard/ErrorState';
import { RefreshCw, Bell, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  issueId?: string;
}

interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
  total: number;
}

const TYPE_ICONS: Record<string, typeof Bell> = {
  ISSUE_CREATED: AlertTriangle,
  ISSUE_ESCALATED: AlertTriangle,
  ISSUE_RESOLVED: CheckCircle2,
  SYSTEM: Info,
};

export default function AdminNotificationsPage() {
  const { data, error, isLoading, mutate } = useSWR<NotificationsResponse>(
    '/api/notifications',
    fetcher,
    { refreshInterval: 30_000 },
  );

  const notifications = data?.notifications ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Admin workspace"
        title="Notifications"
        description="System-wide notification feed and management."
      >
        <div className="flex items-center gap-2">
          {data && (
            <Badge variant="status" status={data.unreadCount > 0 ? 'brokenPromise' : 'resolved'} size="md">
              {data.unreadCount} unread
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => mutate()}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        </div>
      </PageHeader>

      {error && <ErrorState onRetry={() => mutate()} />}
      {isLoading && !data && <LoadingBlock rows={5} />}

      {data && notifications.length === 0 && (
        <div className="p-10 rounded-2xl border border-dashed border-neutral-300 dark:border-dark-border flex flex-col items-center text-center">
          <Bell className="w-10 h-10 text-neutral-300 mb-3" />
          <p className="font-display text-lg font-semibold text-neutral-700 dark:text-neutral-300">No notifications</p>
          <p className="text-sm text-neutral-500 mt-1">You&apos;re all caught up.</p>
        </div>
      )}

      {notifications.length > 0 && (
        <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
          <CardContent className="p-0">
            <div className="divide-y divide-neutral-100 dark:divide-dark-border">
              {notifications.map((n) => {
                const Icon = TYPE_ICONS[n.type] ?? Bell;
                return (
                  <div
                    key={n.id}
                    className={cn(
                      'flex items-start gap-3 p-4 transition-colors',
                      !n.read && 'bg-brand-50/50 dark:bg-brand-900/10',
                    )}
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                      n.read
                        ? 'bg-neutral-100 dark:bg-dark-border text-neutral-400'
                        : 'bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400',
                    )}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-sm', n.read ? 'text-neutral-600 dark:text-neutral-400' : 'font-semibold text-neutral-900 dark:text-white')}>
                        {n.title}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0 mt-2" />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
