'use client';

import useSWR from 'swr';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Users,
  ArrowRight,
  MapPin,
  Activity,
  Database,
} from 'lucide-react';
import Link from 'next/link';
import type { IssueListItem } from '@/lib/issues/types';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const ACTIVE_STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS'];

function useDashboardData() {
  const issues = useSWR<{ issues: IssueListItem[] }>('/api/issues', fetcher, { refreshInterval: 30000 });
  const myReports = useSWR<{ issues: IssueListItem[] }>('/api/my-reports', fetcher, { refreshInterval: 30000 });
  const notifications = useSWR<{ unreadCount: number }>('/api/notifications', fetcher, { refreshInterval: 30000 });
  return { issues, myReports, notifications };
}

export default function DashboardPage() {
  const { issues, myReports, notifications } = useDashboardData();

  const list = issues.data?.issues ?? [];
  const active = list.filter((i) => ACTIVE_STATUSES.includes(i.status)).length;
  const resolved = list.filter((i) => i.status === 'RESOLVED').length;
  const promisesTracked = list.filter((i) => i.promiseLabel !== null).length;
  const broken = list.filter((i) => i.displayStatus === 'brokenPromise').length;
  const myTotal = myReports.data?.issues.length ?? 0;
  const unread = notifications.data?.unreadCount ?? 0;
  const loading = issues.isLoading && !issues.data;

  const KPI = [
    { label: 'Active Issues', value: loading ? '…' : String(active), sub: active > 0 ? `${list.length} total in database` : 'no active reports yet', icon: FileText, color: 'text-brand-500', bg: 'bg-brand-50 dark:bg-brand-900/20' },
    { label: 'Resolved Issues', value: loading ? '…' : String(resolved), sub: resolved > 0 ? 'marked resolved' : 'none resolved yet', icon: TrendingUp, color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-900/20' },
    { label: 'My Reports', value: loading ? '…' : String(myTotal), sub: myTotal > 0 ? 'submitted by you' : 'submit your first report', icon: FileText, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { label: 'Promises Tracked', value: loading ? '…' : String(promisesTracked), sub: promisesTracked > 0 ? 'with authority promise' : 'no promises yet', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { label: 'Broken Promises', value: loading ? '…' : String(broken), sub: broken > 0 ? 'deadlines missed' : 'no broken promises', icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
    { label: 'Citizen Verifications', value: 'Phase 2', sub: 'AI verification not yet live', icon: Users, color: 'text-cyan-500', bg: 'bg-cyan-50 dark:bg-cyan-900/20' },
  ];

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-neutral-900 dark:text-white">Civic Overview</h1>
        <p className="text-neutral-600 dark:text-neutral-400 mt-2">
          Live counts from the CivicChain database{unread > 0 && (
            <Link href="/dashboard/notifications" className="ml-2 text-brand-600 dark:text-brand-400 font-medium">
              {unread} unread notification{unread === 1 ? '' : 's'} →
            </Link>
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {KPI.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} variant="elevated" className="p-4 bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
              <CardContent>
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-3', item.bg)}>
                  <Icon className={cn('w-4 h-4', item.color)} />
                </div>
                <p className="text-2xl font-display font-bold text-neutral-900 dark:text-white">{item.value}</p>
                <p className="text-xs text-neutral-500 mt-1">{item.label}</p>
                <p className="text-[10px] text-neutral-400 mt-1 font-mono">{item.sub}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle as="h2" className="text-lg">Recent Civic Issues</CardTitle>
              <Link href="/dashboard/issues" className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 flex items-center gap-1">
                View All <ArrowRight className="w-4 h-4" />
              </Link>
            </CardHeader>
            <CardContent>
              {issues.isLoading && !issues.data ? (
                <div className="space-y-4">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-16 rounded-xl bg-neutral-100 dark:bg-dark-border animate-pulse" />
                  ))}
                </div>
              ) : list.length === 0 ? (
                <div className="text-center py-10">
                  <Database className="w-10 h-10 text-neutral-300 dark:text-neutral-600 mx-auto mb-3" />
                  <p className="text-sm text-neutral-500">No civic issues reported yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {list.slice(0, 4).map((issue) => (
                    <Link
                      key={issue.id}
                      href={`/dashboard/issues/${issue.id}`}
                      className="flex items-center justify-between p-4 rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border hover:border-brand-300 dark:hover:border-brand-700 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center">
                          <MapPin className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold text-neutral-900 dark:text-white">{issue.publicId}</span>
                            <span className="text-sm text-neutral-600 dark:text-neutral-400">{issue.categoryLabel}</span>
                            {issue.byCurrentUser && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                                YOU
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-neutral-500 mt-1">{issue.location || 'Location not provided'} • {issue.timeLabel}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right hidden md:block">
                          <p className="text-xs text-neutral-500">Severity</p>
                          <p className="font-mono text-sm font-bold text-neutral-900 dark:text-white">
                            {issue.severityLabel ?? 'Pending AI'}
                          </p>
                        </div>
                        <Badge variant="status" status={issue.displayStatus} size="sm" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardHeader>
              <CardTitle as="h2" className="text-lg">Escalations Requiring Attention</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Escalation workflows arrive in Phase 2. No simulated escalations are shown.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardHeader>
              <CardTitle as="h2" className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Link href="/report" className="flex items-center gap-3 p-3 rounded-xl bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 hover:bg-brand-100 dark:hover:bg-brand-900/30 transition-colors">
                  <FileText className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                  <span className="text-sm font-medium text-brand-700 dark:text-brand-300">Report New Issue</span>
                </Link>
                <Link href="/my-reports" className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border hover:bg-neutral-100 dark:hover:bg-dark-bg-card transition-colors">
                  <Activity className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">My Reports</span>
                </Link>
                <Link href="/dashboard/notifications" className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border hover:bg-neutral-100 dark:hover:bg-dark-bg-card transition-colors">
                  <CheckCircle2 className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Notifications{unread > 0 ? ` (${unread} unread)` : ''}
                  </span>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}