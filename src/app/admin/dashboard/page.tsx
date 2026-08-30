'use client';

import useSWR from 'swr';
import Link from 'next/link';
import {
  Users,
  Building2,
  FileText,
  CheckCircle2,
  Activity,
  ShieldCheck,
  Bell,
  AlertTriangle,
  History,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { StatCard } from '@/components/dashboard/StatCard';
import { LoadingBlock } from '@/components/dashboard/LoadingBlock';
import { ErrorState } from '@/components/dashboard/ErrorState';
import type { AuditLogItem } from '@/lib/issues/types';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface PlatformStats {
  users: number;
  authorities: number;
  issues: number;
  resolved: number;
  activeIssues: number;
  auditLogs: number;
  notifications: number;
  escalations: number;
  verifiedEvidence: number;
  pendingEvidence: number;
}

interface HealthData {
  checks: {
    database: { ok: boolean; error?: string };
    postgis: { ok: boolean; version?: string; error?: string };
    auth: { ok: boolean; note?: string };
    email: { ok: boolean; note?: string };
    storage: { ok: boolean; writable?: boolean; error?: string };
  };
  totals: { users: number; issues: number; auditLogs: number; notificationsUnread: number; escalationsOpen: number; pendingEvidence: number; verifications: number };
}

export default function AdminDashboard() {
  const { data: statsData, error: statsError, mutate: mutateStats } = useSWR<{ stats: PlatformStats }>('/api/admin/stats', fetcher, { refreshInterval: 30000 });
  const { data: health } = useSWR<HealthData>('/api/admin/health', fetcher, { refreshInterval: 60000 });
  const { data: depts } = useSWR<{ authorities: Array<{ id: string; name: string; department: string; jurisdiction: string; assigned: number; active: number; escalationsOpen: number }> }>('/api/admin/departments', fetcher, { refreshInterval: 30000 });
  const { data: audit, error: auditError } = useSWR<{ logs: AuditLogItem[] }>('/api/admin/audit', fetcher, { refreshInterval: 30000 });

  const s = statsData?.stats;

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        kicker="Admin workspace"
        title="Platform Overview"
        description="Platform-wide health and activity across the CivicChain deployment."
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/health">Health check</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/analytics">Analytics</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/admin/issues">Manage issues</Link>
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <StatCard label="Users" value={s?.users ?? '…'} loading={!s} icon={Users} tone="brand" />
        <StatCard label="Departments" value={s?.authorities ?? '…'} loading={!s} icon={Building2} tone="violet" />
        <StatCard label="Issues" value={s?.issues ?? '…'} loading={!s} icon={FileText} tone="cyan"
          sub={s ? `${s.activeIssues} active` : undefined} />
        <StatCard label="Resolved" value={s?.resolved ?? '…'} loading={!s} icon={CheckCircle2} tone="emerald"
          sub={s && s.issues > 0 ? `${Math.round((s.resolved / s.issues) * 100)}% resolution rate` : undefined} />
        <StatCard label="Open Escalations" value={s?.escalations ?? '…'} loading={!s} icon={AlertTriangle} tone="red" />
        <StatCard label="Verified Evidence" value={s?.verifiedEvidence ?? '…'} loading={!s} icon={ShieldCheck} tone="emerald" />
        <StatCard label="Pending Evidence" value={s?.pendingEvidence ?? '…'} loading={!s} icon={ShieldCheck} tone="amber"
          sub="awaiting review" />
        <StatCard label="Audit Logs" value={s?.auditLogs ?? '…'} loading={!s} icon={History} tone="neutral" />
        <StatCard label="Notifications" value={s?.notifications ?? '…'} loading={!s} icon={Bell} tone="cyan" />
        <StatCard label="System" value={health ? (Object.values(health.checks).every((c) => c.ok) ? 'Healthy' : 'Attention') : '…'} loading={!health}
          icon={Activity} tone={health && Object.values(health.checks).every((c) => c.ok) ? 'emerald' : 'red'} />
      </div>

      {statsError && <ErrorState onRetry={() => mutateStats()} />}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle as="h2" className="text-lg">Recent Audit Activity</CardTitle>
              <Link href="/admin/audit" className="text-sm text-brand-600 dark:text-brand-400 flex items-center gap-1">
                Full trail <ArrowRight className="w-4 h-4" />
              </Link>
            </CardHeader>
            <CardContent>
              {!audit && !auditError ? (
                <LoadingBlock rows={4} />
              ) : auditError || (audit?.logs.length ?? 0) === 0 ? (
                <p className="text-sm text-neutral-500 py-6 text-center">No audit records yet.</p>
              ) : (
                <div className="space-y-2">
                  {audit?.logs.slice(0, 6).map((log) => (
                    <div key={log.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                          {log.issuePublicId && <span className="font-mono text-xs text-brand-600 dark:text-brand-400 mr-1.5">{log.issuePublicId}</span>}
                          {log.action.replace(/_/g, ' ').toLowerCase()}
                          {log.entityType && log.entityType !== 'Issue' && (
                            <span className="text-xs text-neutral-400 ml-1.5">on {log.entityType}</span>
                          )}
                        </p>
                        <p className="text-xs text-neutral-500 mt-0.5">by {log.actor ?? 'system'}</p>
                      </div>
                      <span className="text-[11px] text-neutral-400 whitespace-nowrap flex-shrink-0">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle as="h2" className="text-lg">Departments</CardTitle>
              <Link href="/admin/departments" className="text-xs text-brand-600 dark:text-brand-400">Manage</Link>
            </CardHeader>
            <CardContent>
              {!depts ? (
                <LoadingBlock rows={3} />
              ) : depts.authorities.length === 0 ? (
                <p className="text-sm text-neutral-500 py-4 text-center">No authorities configured.</p>
              ) : (
                <div className="space-y-2">
                  {depts.authorities.map((d) => (
                    <Link key={d.id} href="/admin/departments"
                      className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border hover:border-brand-300 dark:hover:border-brand-700 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">{d.department}</p>
                        <p className="text-xs text-neutral-500">{d.jurisdiction}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Badge variant="outline" size="sm">{d.assigned} assigned</Badge>
                        {d.escalationsOpen > 0 && <Badge variant="status" status="brokenPromise" size="sm">{d.escalationsOpen} esc</Badge>}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {health && (
            <Card variant="outlined" padding="sm" className={Object.values(health.checks).every((c) => c.ok) ? 'bg-emerald-50/40 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-900/40' : 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/40'}>
              <CardContent>
                <p className="text-sm font-medium mb-2 text-neutral-800 dark:text-neutral-200">System checks</p>
                <div className="space-y-1.5">
                  {Object.entries(health.checks).map(([key, check]) => (
                    <div key={key} className="flex items-center justify-between text-xs">
                      <span className="text-neutral-600 dark:text-neutral-400 capitalize">{key}</span>
                      <span className={check.ok ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-red-600 dark:text-red-400 font-medium'}>
                        {check.ok ? 'OK' : 'FAIL'}
                      </span>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="mt-3 w-full" asChild>
                  <Link href="/admin/health">Inspect health</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}