'use client';

import useSWR from 'swr';
import { TrendingUp, Clock, ShieldCheck, XCircle, Timer, AlertTriangle, CheckCircle2, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { StatCard } from '@/components/dashboard/StatCard';
import { LoadingBlock } from '@/components/dashboard/LoadingBlock';
import { ErrorState } from '@/components/dashboard/ErrorState';
import { cn } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface PerformanceData {
  summary: {
    total: number;
    active: number;
    resolved: number;
    rejected: number;
    inProgress: number;
    awaitingVerification: number;
    escalationsTotal: number;
    escalationsOpen: number;
    promisesActive: number;
    promisesBroken: number;
    promisesCompleted: number;
    avgResolutionMinutes: number | null;
    resolutionRate: number | null;
    verifiedVerifications: number;
    rejectedVerifications: number;
  };
  byStatus: Array<{ status: string; label: string; count: number }>;
  byDay: Array<{ day: string; created: number }>;
}

function formatMinutes(minutes: number | null): string {
  if (minutes === null) return '—';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function shortDay(day: string): string {
  const [, m, d] = day.split('-');
  return `${Number(m)}/${Number(d)}`;
}

export default function DepartmentPerformance() {
  const { data, error, isLoading, mutate } = useSWR<PerformanceData>(
    '/api/department/performance',
    fetcher,
    { refreshInterval: 60000 },
  );

  const s = data?.summary;
  const maxStatus = Math.max(1, ...(data?.byStatus.map((b) => b.count) ?? []));
  const maxDay = Math.max(1, ...(data?.byDay.map((b) => b.created) ?? []));

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        kicker="Department workspace"
        title="Performance"
        description="Resolution metrics and workload trends — derived from the real audit trail and report data."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Resolution Rate" value={s?.resolutionRate != null ? `${s.resolutionRate}%` : '—'} loading={isLoading} icon={TrendingUp} tone="emerald"
          sub={s?.resolutionRate == null ? 'nothing resolved yet' : 'of all assigned reports'} />
        <StatCard label="Avg Resolution Time" value={s ? formatMinutes(s.avgResolutionMinutes) : '…'} loading={isLoading} icon={Clock} tone="violet"
          sub={s?.avgResolutionMinutes === null ? 'no resolved reports yet' : 'from audit trail'} />
        <StatCard label="Verified / Rejected" value={s ? `${s.verifiedVerifications} / ${s.rejectedVerifications}` : '…'} loading={isLoading} icon={ShieldCheck} tone="cyan"
          sub="verifications recorded" />
        <StatCard label="Awaiting Verification" value={s?.awaitingVerification ?? '…'} loading={isLoading} icon={XCircle} tone="amber"
          sub="evidence to review now" />
        <StatCard label="Promises Active" value={s?.promisesActive ?? '…'} loading={isLoading} icon={Timer} tone="neutral"
          sub="tracked deadlines" />
        <StatCard label="Promises Completed" value={s?.promisesCompleted ?? '…'} loading={isLoading} icon={CheckCircle2} tone="emerald" />
        <StatCard label="Promises Broken" value={s?.promisesBroken ?? '…'} loading={isLoading} icon={AlertTriangle} tone="red"
          sub={s?.promisesBroken ? 'deadlines missed' : 'none missed'} />
        <StatCard label="Escalations" value={s ? `${s.escalationsOpen} / ${s.escalationsTotal}` : '…'} loading={isLoading} icon={BarChart3} tone="brand"
          sub="open / lifetime" />
      </div>

      {error && <ErrorState onRetry={() => mutate()} />}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
          <CardHeader>
            <CardTitle as="h2" className="text-lg">Reports by Status</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && !data ? (
              <LoadingBlock rows={4} />
            ) : (data?.byStatus.length ?? 0) === 0 ? (
              <p className="text-sm text-neutral-500 py-6 text-center">No reports assigned to this department yet.</p>
            ) : (
              <div className="space-y-3">
                {data?.byStatus.map((row) => (
                  <div key={row.status}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-neutral-700 dark:text-neutral-300">{row.label}</span>
                      <span className="font-mono text-xs text-neutral-500">{row.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-neutral-100 dark:bg-dark-border overflow-hidden">
                      <div
                        className="h-full rounded-full bg-brand-600 dark:bg-brand-500 transition-all duration-500"
                        style={{ width: `${(row.count / maxStatus) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle as="h2" className="text-lg">New Reports · Last 14 Days</CardTitle>
            <span className="text-xs text-neutral-500">created per day</span>
          </CardHeader>
          <CardContent>
            {isLoading && !data ? (
              <LoadingBlock rows={4} />
            ) : (data?.byDay.length ?? 0) === 0 ? (
              <p className="text-sm text-neutral-500 py-6 text-center">No data in the last 14 days.</p>
            ) : (
              <div className="flex items-end gap-1.5 h-40">
                {data?.byDay.map((point) => (
                  <div key={point.day} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group" title={`${point.day}: ${point.created} report${point.created === 1 ? '' : 's'}`}>
                    <span className={cn('text-[10px] font-mono text-neutral-400 transition-opacity opacity-0 group-hover:opacity-100')}>
                      {point.created > 0 ? point.created : ''}
                    </span>
                    <div
                      className={cn(
                        'w-full rounded-t-md transition-all duration-500',
                        point.created > 0 ? 'bg-brand-600 dark:bg-brand-500' : 'bg-neutral-200 dark:bg-dark-border',
                      )}
                      style={{ height: `${(point.created / maxDay) * 100}%` }}
                    />
                    <span className="text-[10px] text-neutral-400">{shortDay(point.day)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}