'use client';

import { useCallback, useEffect, useState } from 'react';
import useSWR from 'swr';
import { AlertTriangle, ArrowUpRight, CheckCircle2, PlayCircle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { LoadingBlock } from '@/components/dashboard/LoadingBlock';
import { EmptyState } from '@/components/dashboard/EmptyState';
import { ErrorState } from '@/components/dashboard/ErrorState';
import { cn } from '@/lib/utils';
import type { EscalationItem } from '@/lib/issues/types';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function DepartmentEscalations() {
  const { data, error, isLoading, mutate } = useSWR<{ escalations: EscalationItem[] }>(
    '/api/department/escalations',
    fetcher,
    { refreshInterval: 15000 },
  );

  const [busy, setBusy] = useState<string | null>(null);
  const [float, setFloat] = useState<string | null>(null);

  useEffect(() => {
    if (!float) return;
    const t = setTimeout(() => setFloat(null), 3000);
    return () => clearTimeout(t);
  }, [float]);

  const change = useCallback(
    async (escalation: EscalationItem, next: 'RESOLVED' | 'IN_PROGRESS') => {
      if (busy) return;
      setBusy(escalation.id);
      try {
        const res = await fetch(`/api/department/escalations/${escalation.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: next }),
        });
        if (!res.ok) throw new Error();
        await mutate();
        setFloat(next === 'RESOLVED' ? 'Escalation closed' : 'Escalation put in progress');
      } catch {
        setFloat('Update failed');
      } finally {
        setBusy(null);
      }
    },
    [busy, mutate],
  );

  const open = data?.escalations.filter((e) => e.status !== 'RESOLVED') ?? [];
  const closed = data?.escalations.filter((e) => e.status === 'RESOLVED') ?? [];

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        kicker="Department workspace"
        title="Escalations"
        description="Reports raised up a level. Each escalation carries its own audit trail; closing one records who closed it and when."
      />

      {error && <ErrorState onRetry={() => mutate()} />}

      <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle as="h2" className="text-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Open
          </CardTitle>
          <span className="text-xs text-neutral-500">{open.length}</span>
        </CardHeader>
        <CardContent>
          {isLoading && !data ? (
            <LoadingBlock rows={2} />
          ) : open.length === 0 ? (
            <EmptyState icon={AlertTriangle} title="No open escalations" description="Escalations raised on your department's reports appear here." />
          ) : (
            <div className="space-y-3">
              {open.map((esc) => (
                <div key={esc.id} className="p-4 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-900/10">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-brand-600 dark:text-brand-400">{esc.issuePublicId}</span>
                        <Badge variant="outline" size="sm">Level {esc.level}</Badge>
                        {esc.status === 'IN_PROGRESS' && <Badge variant="status" status="verificationPending" size="sm">In progress</Badge>}
                      </div>
                      <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 mt-1">{esc.issueTitle}</p>
                      {esc.reason && <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">“{esc.reason}”</p>}
                      <p className="text-xs text-neutral-500 mt-1.5">raised by {esc.caller ?? 'a department member'} · {esc.timeLabel}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 pt-1">
                      {esc.status === 'IN_PROGRESS' ? (
                        <Button size="sm" loading={busy === esc.id} onClick={() => change(esc, 'RESOLVED')}>
                          <CheckCircle2 className="w-4 h-4" /> Close
                        </Button>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" loading={busy === esc.id} onClick={() => change(esc, 'IN_PROGRESS')}>
                            <PlayCircle className="w-4 h-4" /> Start
                          </Button>
                          <Button size="sm" loading={busy === esc.id} onClick={() => change(esc, 'RESOLVED')}>
                            <CheckCircle2 className="w-4 h-4" /> Close
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle as="h2" className="text-lg flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4 text-neutral-400" /> History
          </CardTitle>
          <span className="text-xs text-neutral-500">{closed.length} closed</span>
        </CardHeader>
        <CardContent>
          {closed.length === 0 ? (
            <p className="text-sm text-neutral-500 py-6 text-center">No closed escalations yet.</p>
          ) : (
            <div className="space-y-2">
              {closed.map((esc) => (
                <div key={esc.id} className={cn(
                  'p-3 rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border',
                )}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-neutral-700 dark:text-neutral-300">{esc.issuePublicId}</span>
                    <Badge variant="outline" size="sm">Level {esc.level}</Badge>
                    <Badge variant="status" status="resolved" size="sm">Closed</Badge>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">{esc.issueTitle} · closed {esc.timeLabel}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {float && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-neutral-900 text-white dark:bg-dark-bg-card dark:text-neutral-100 border border-neutral-200 dark:border-dark-border text-sm shadow-lg z-50">
          {float}
        </div>
      )}
    </div>
  );
}