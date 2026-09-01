'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/dashboard/EmptyState';
import { LoadingBlock } from '@/components/dashboard/LoadingBlock';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import type { EscalationItem } from '@/lib/issues/types';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function EscalationsPage() {
  const { data, isLoading, error } = useSWR<{
    items: EscalationItem[];
    stats: { total: number; open: number; byLevel: Record<string, number> };
  }>('/api/my-escalations', fetcher, { refreshInterval: 30000 });

  const items = data?.items ?? [];
  const stats = data?.stats;

  const statCards = [
    { label: 'Total Escalations', value: stats?.total ?? 0, color: 'text-red-600' },
    { label: 'Open', value: stats?.open ?? 0, color: 'text-amber-600' },
    { label: 'Level 2+', value: ((stats?.byLevel?.[2] ?? 0) + (stats?.byLevel?.[3] ?? 0) + (stats?.byLevel?.[4] ?? 0)), color: 'text-violet-600' },
  ];

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-neutral-900 dark:text-white">Escalations</h1>
        <p className="text-neutral-600 dark:text-neutral-400 mt-2">
          Escalations raised on your reports — real records from the escalation ladder, with the level and reason attached.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {statCards.map((stat) => (
          <Card key={stat.label} variant="elevated" className="p-4 bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardContent>
              <p className="text-xs text-neutral-500 mb-1">{stat.label}</p>
              {data ? (
                <p className={cn('text-3xl font-display font-bold', stat.color)}>{stat.value}</p>
              ) : (
                <div className="h-9 w-12 bg-neutral-100 dark:bg-dark-border rounded animate-pulse" />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {isLoading && !data ? (
        <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
          <CardContent className="p-6"><LoadingBlock rows={3} /></CardContent>
        </Card>
      ) : error ? (
        <p className="text-sm text-red-600 dark:text-red-400 p-8 text-center">Could not load your escalations.</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="No escalations"
          description="None of your reports have needed escalation. If a commitment slips past its deadline, the escalation raises a real record here."
        />
      ) : (
        <div className="space-y-4">
          {items.map((esc) => (
            <Card key={esc.id} variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="w-6 h-6 text-red-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm font-bold text-neutral-900 dark:text-white">{esc.issuePublicId}</span>
                        <Badge variant="status" status="brokenPromise" size="sm" />
                        <span className="px-2 py-0.5 rounded text-xs font-mono bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
                          Level {esc.level}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">{esc.issueTitle}</p>
                      <p className="text-xs text-neutral-500">
                        {esc.caller ?? 'Automated escalation engine'} • {esc.timeLabel}
                      </p>
                      {esc.reason && (
                        <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border rounded-lg px-3 py-2">
                          {esc.reason}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-neutral-500 uppercase tracking-wide">
                      {esc.status.replace('_', ' ')}
                    </span>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/my-reports/${esc.issueId}`}>
                        View
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}