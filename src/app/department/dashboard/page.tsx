'use client';

import useSWR from 'swr';
import Link from 'next/link';
import {
  FileText,
  Activity,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Timer,
  BadgeCheck,
  ArrowRight,
  History,
  Scale,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { StatCard } from '@/components/dashboard/StatCard';
import { LoadingBlock } from '@/components/dashboard/LoadingBlock';
import { ErrorState } from '@/components/dashboard/ErrorState';
import { EmptyState } from '@/components/dashboard/EmptyState';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface DepartmentSummary {
  authority: { name: string; department: string; jurisdiction: string };
  stats: {
    assigned: number;
    active: number;
    open: number;
    inProgress: number;
    resolved: number;
    rejected: number;
    awaitingVerification: number;
    escalationsOpen: number;
    promisesActive: number;
    promisesBroken: number;
    avgResolutionMinutes: number | null;
  };
  activity: Array<{ id: string; action: string; issuePublicId: string | null; actor: string | null; createdAt: string; timeLabel: string }>;
}

function formatMinutes(minutes: number | null): string {
  if (minutes === null) return '—';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function DepartmentDashboard() {
  const { data, error, isLoading, mutate } = useSWR<DepartmentSummary>(
    '/api/department/summary',
    fetcher,
    { refreshInterval: 30000 },
  );

  const stats = data?.stats;
  const a = data?.authority;

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        kicker={a ? `${a.name} · ${a.department}` : 'Department workspace'}
        title={a ? `${a.name}` : 'Department Overview'}
        description={a ? `Operational overview for ${a.jurisdiction}. All numbers come from the live database, scoped to this department.` : 'Operational overview. Loading department scope…'}
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/department/verification">Verification queue</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/department/escalations">Escalations</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/department/issues">Open workbench</Link>
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Assigned Reports" value={stats?.assigned ?? '…'} loading={isLoading} icon={FileText} tone="brand"
          sub={stats ? `${stats.open} awaiting assignment` : undefined} />
        <StatCard label="Active" value={stats?.active ?? '…'} loading={isLoading} icon={Activity} tone="amber"
          sub={stats ? `${stats.inProgress} in progress` : undefined} />
        <StatCard label="Resolved" value={stats?.resolved ?? '…'} loading={isLoading} icon={CheckCircle2} tone="emerald"
          sub={stats && stats.assigned > 0 ? `${Math.round((stats.resolved / stats.assigned) * 100)}% of all reports` : undefined} />
        <StatCard label="Avg Resolution Time" value={stats ? formatMinutes(stats.avgResolutionMinutes) : '…'} loading={isLoading} icon={Clock} tone="violet"
          sub={stats?.avgResolutionMinutes === null ? 'no resolved reports yet' : 'from real audit trail'} />
        <StatCard label="Awaiting Verification" value={stats?.awaitingVerification ?? '…'} loading={isLoading} icon={ShieldCheck} tone="cyan"
          sub={stats?.awaitingVerification ? 'evidence needs review' : 'nothing pending'} />
        <StatCard label="Open Escalations" value={stats?.escalationsOpen ?? '…'} loading={isLoading} icon={AlertTriangle} tone="red"
          sub={stats?.escalationsOpen ? 'need attention' : 'all clear'} />
        <StatCard label="Active Promises" value={stats?.promisesActive ?? '…'} loading={isLoading} icon={Timer} tone="neutral"
          sub="deadline-tracked commitments" />
        <StatCard label="Broken Promises" value={stats?.promisesBroken ?? '…'} loading={isLoading} icon={BadgeCheck} tone="amber"
          sub={stats?.promisesBroken ? 'deadlines missed' : 'no missed deadlines'} />
      </div>

      {error && <ErrorState onRetry={() => mutate()} />}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle as="h2" className="text-lg flex items-center gap-2">
                <History className="w-4 h-4 text-neutral-400" /> Recent Activity
              </CardTitle>
              <span className="text-xs text-neutral-500">{data?.activity.length ?? 0} entries</span>
            </CardHeader>
            <CardContent>
              {!data ? (
                <LoadingBlock rows={4} />
              ) : data.activity.length === 0 ? (
                <EmptyState icon={History} title="No activity yet" description="Audit records from your department appear here as reports move through the system." />
              ) : (
                <div className="space-y-2">
                  {data.activity.map((log) => (
                    <div key={log.id} className="flex items-start justify-between gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border">
                      <div>
                        <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                          {log.issuePublicId && <span className="font-mono text-xs text-brand-600 dark:text-brand-400 mr-1.5">{log.issuePublicId}</span>}
                          {log.action.replace(/_/g, ' ').toLowerCase()}
                        </p>
                        <p className="text-xs text-neutral-500 mt-0.5">by {log.actor ?? 'system'}</p>
                      </div>
                      <p className="text-[11px] text-neutral-400 flex-shrink-0">{log.timeLabel}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardHeader>
              <CardTitle as="h2" className="text-lg flex items-center gap-2"><Scale className="w-4 h-4 text-neutral-400" /> Focus</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Link href="/department/issues" className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border hover:border-brand-300 dark:hover:border-brand-700 transition-colors">
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Workbench</span>
                  <span className="text-xs font-mono text-neutral-500">{stats?.active ?? '…'} active</span>
                </Link>
                <Link href="/department/verification" className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border hover:border-brand-300 dark:hover:border-brand-700 transition-colors">
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Verification queue</span>
                  <span className="text-xs font-mono text-neutral-500">{stats?.awaitingVerification ?? '…'} pending</span>
                </Link>
                <Link href="/department/escalations" className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border hover:border-brand-300 dark:hover:border-brand-700 transition-colors">
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Escalations</span>
                  <span className="text-xs font-mono text-neutral-500">{stats?.escalationsOpen ?? '…'} open</span>
                </Link>
                <Link href="/department/performance" className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border hover:border-brand-300 dark:hover:border-brand-700 transition-colors">
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Performance</span>
                  <ArrowRight className="w-4 h-4 text-neutral-400" />
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card variant="outlined" padding="sm" className="bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/40">
            <CardContent>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                AI-prioritized triage stays a later phase. This dashboard shows only verified, database-backed numbers — no simulated workload.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}