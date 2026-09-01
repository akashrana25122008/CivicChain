'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { cn, formatDate } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/dashboard/EmptyState';
import { LoadingBlock } from '@/components/dashboard/LoadingBlock';
import { Clock, Calendar, AlertTriangle, CheckCircle2, CalendarCheck } from 'lucide-react';
import type { PromiseItem } from '@/lib/issues/types';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function badgeFor(sla: PromiseItem['slaState']): string {
  if (sla === 'ON_TRACK') return 'onTrack';
  if (sla === 'AT_RISK') return 'atRisk';
  if (sla === 'BREACHED') return 'brokenPromise';
  return 'resolved';
}

export default function PromisesPage() {
  const { data, isLoading, error } = useSWR<{
    promises: PromiseItem[];
    stats: { total: number; onTrack: number; atRisk: number; breached: number; resolved: number };
  }>('/api/my-promises', fetcher, { refreshInterval: 30000 });

  const promises = data?.promises ?? [];
  const stats = data?.stats;

  const statCards = [
    { label: 'Total Promises', value: stats?.total ?? 0, icon: CalendarCheck, color: 'text-brand-500', bg: 'bg-brand-50 dark:bg-brand-900/20' },
    { label: 'On Track', value: stats?.onTrack ?? 0, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { label: 'At Risk', value: stats?.atRisk ?? 0, icon: Calendar, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    { label: 'Breached', value: stats?.breached ?? 0, icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
  ];

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-neutral-900 dark:text-white">Promise Engine</h1>
        <p className="text-neutral-600 dark:text-neutral-400 mt-2">
          Commitments made on your reports, with live SLA standing computed against every deadline.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} variant="elevated" className="p-4 bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
              <CardContent>
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-3', stat.bg)}>
                  <Icon className={cn('w-4 h-4', stat.color)} />
                </div>
                {stats ? (
                  <p className="text-2xl font-display font-bold text-neutral-900 dark:text-white">{stat.value}</p>
                ) : (
                  <div className="h-8 w-12 bg-neutral-100 dark:bg-dark-border rounded animate-pulse" />
                )}
                <p className="text-xs text-neutral-500 mt-1">{stat.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
        <CardContent className="p-0">
          {isLoading && !data ? (
            <div className="p-6"><LoadingBlock rows={4} /></div>
          ) : error ? (
            <p className="text-sm text-red-600 dark:text-red-400 p-8 text-center">Could not load your promises.</p>
          ) : promises.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={CalendarCheck}
                title="No commitments yet"
                description="Once a department accepts one of your reports, its resolution deadline appears here with real SLA tracking."
              />
            </div>
          ) : (
            <div className="divide-y divide-neutral-200 dark:divide-dark-border">
              {promises.map((promise) => (
                <Link
                  key={promise.id}
                  href={`/my-reports/${promise.id}`}
                  className="flex items-center justify-between p-6 hover:bg-neutral-50 dark:hover:bg-dark-bg transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center',
                      promise.slaState === 'ON_TRACK' ? 'bg-emerald-50 dark:bg-emerald-900/30' :
                      promise.slaState === 'AT_RISK' ? 'bg-amber-50 dark:bg-amber-900/30' :
                      promise.slaState === 'BREACHED' ? 'bg-red-50 dark:bg-red-900/30' :
                      'bg-emerald-50 dark:bg-emerald-900/30'
                    )}>
                      {promise.slaState === 'RESOLVED' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : promise.slaState === 'ON_TRACK' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : promise.slaState === 'AT_RISK' ? (
                        <Calendar className="w-5 h-5 text-amber-500" />
                      ) : (
                        <Clock className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-neutral-900 dark:text-white">{promise.publicId}</span>
                        <span className="text-sm text-neutral-600 dark:text-neutral-400">{promise.title}</span>
                      </div>
                      <p className="text-xs text-neutral-500 mt-1">
                        {promise.authority ?? 'Department'} • Promised {promise.createdAt ? formatDate(promise.createdAt) : ''} • {promise.timeLabel}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right hidden md:block">
                      <p className="text-xs text-neutral-500">Deadline</p>
                      <p className="text-sm font-medium text-neutral-900 dark:text-white">{formatDate(promise.deadline)}</p>
                    </div>
                    <Badge variant="status" status={badgeFor(promise.slaState)} size="sm" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}