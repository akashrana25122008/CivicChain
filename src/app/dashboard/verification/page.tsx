'use client';

import { useCallback, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/dashboard/EmptyState';
import { LoadingBlock } from '@/components/dashboard/LoadingBlock';
import { Shield, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import type { MyVerificationItem } from '@/lib/issues/types';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function VerificationPage() {
  const { data, isLoading, mutate } = useSWR<{
    items: MyVerificationItem[];
    stats: { total: number; pending: number; verified: number };
  }>('/api/my-verifications', fetcher, { refreshInterval: 30000 });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const items = data?.items ?? [];
  const stats = data?.stats;

  const submit = useCallback(
    async (id: string, outcome: 'VERIFIED' | 'DISPUTED') => {
      setBusyId(id);
      setActionError(null);
      try {
        const res = await fetch(`/api/issues/${id}/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ outcome }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message ?? 'Verification failed.');
        await mutate();
      } catch (e) {
        setActionError(e instanceof Error ? e.message : 'Verification failed.');
      } finally {
        setBusyId(null);
      }
    },
    [mutate],
  );

  const statCards = [
    { label: 'Awaiting Your Confirmation', value: stats?.pending ?? 0, color: 'text-violet-600', icon: Shield },
    { label: 'Confirmed Fixed', value: stats?.verified ?? 0, color: 'text-emerald-600', icon: CheckCircle2 },
    { label: 'Total Resolved Reports', value: stats?.total ?? 0, color: 'text-brand-600', icon: Shield },
  ];

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-neutral-900 dark:text-white">Resolution Verification</h1>
        <p className="text-neutral-600 dark:text-neutral-400 mt-2">
          Confirm whether resolved reports on your reports are actually fixed. Your confirmation is real, audited, and cannot be replayed.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {statCards.map((stat) => (
          <Card key={stat.label} variant="elevated" className="p-4 bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardContent>
              <p className="text-xs text-neutral-500 mb-1">{stat.label}</p>
              {stats ? (
                <p className={cn('text-2xl font-display font-bold', stat.color)}>{stat.value}</p>
              ) : (
                <div className="h-8 w-12 bg-neutral-100 dark:bg-dark-border rounded animate-pulse" />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {actionError && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          {actionError}
        </div>
      )}

      {isLoading && !data ? (
        <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
          <CardContent className="p-6"><LoadingBlock rows={3} /></CardContent>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nothing to verify yet"
          description="When a department marks one of your reports as resolved, it appears here for your final confirmation."
        />
      ) : (
        <div className="space-y-4">
          {items.map((ver) => (
            <Card key={ver.id} variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center',
                      ver.verificationState === 'VERIFIED' ? 'bg-emerald-50 dark:bg-emerald-900/30' : 'bg-violet-50 dark:bg-violet-900/30'
                    )}>
                      {ver.verificationState === 'VERIFIED' ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                      ) : (
                        <Shield className="w-6 h-6 text-violet-500" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-neutral-900 dark:text-white">{ver.publicId}</span>
                        <span className="text-sm text-neutral-600 dark:text-neutral-400">{ver.categoryLabel}</span>
                      </div>
                      <p className="text-sm text-neutral-700 dark:text-neutral-300 mt-0.5">{ver.title}</p>
                      <p className="text-xs text-neutral-500 mt-1">
                        {ver.authority ?? 'Department'} • resolved {new Date(ver.resolvedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="status" status={ver.verificationState === 'VERIFIED' ? 'resolved' : 'verificationPending'} size="sm" />
                    <Link href={`/my-reports/${ver.id}`}>
                      <Button variant="outline" size="sm">View</Button>
                    </Link>
                    {ver.verificationState === 'PENDING' ? (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busyId === ver.id}
                          onClick={() => submit(ver.id, 'VERIFIED')}
                        >
                          {busyId === ver.id ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                          Confirm fixed
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 dark:text-red-400"
                          disabled={busyId === ver.id}
                          onClick={() => submit(ver.id, 'DISPUTED')}
                        >
                          <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                          Dispute
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Confirmed by you</span>
                    )}
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