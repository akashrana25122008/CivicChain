'use client';

import useSWR from 'swr';
import Link from 'next/link';
import {
  FileText,
  Activity,
  CheckCircle2,
  ShieldCheck,
  ImageIcon,
  Award,
  ArrowRight,
  PlusCircle,
  Bell,
  MapPin,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { StatCard } from '@/components/dashboard/StatCard';
import { LoadingBlock } from '@/components/dashboard/LoadingBlock';
import { EmptyState } from '@/components/dashboard/EmptyState';
import { ErrorState } from '@/components/dashboard/ErrorState';
import { IssuesMap } from '@/components/dashboard/IssuesMap';
import { RiskEngine } from '@/components/dashboard/RiskEngine';
import { cn } from '@/lib/utils';
import type { IssueDetail, IssueListItem, NotificationItem } from '@/lib/issues/types';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface CitizenStats {
  total: number;
  active: number;
  resolved: number;
  rejected: number;
  awaitingVerification: number;
  evidenceTotal: number;
  evidencePending: number;
  karmaScore: number;
  notificationsUnread: number;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function firstName(name?: string | null): string {
  if (!name) return 'there';
  return name.split(/\s+/)[0];
}

export function CitizenDashboard({ name }: { name?: string | null }) {
  const { data: summary, error: summaryError, isLoading: summaryLoading, mutate: mutateSummary } =
    useSWR<{ stats: CitizenStats }>('/api/citizen/summary', fetcher, { refreshInterval: 30000 });
  const { data: mine } = useSWR<{ issues: IssueListItem[] }>('/api/my-reports', fetcher, { refreshInterval: 30000 });
  const { data: all } = useSWR<{ issues: IssueListItem[] }>('/api/issues', fetcher, { refreshInterval: 60000 });
  const { data: notifications, mutate: mutateNotifications } = useSWR<{ notifications: NotificationItem[]; unreadCount: number }>(
    '/api/notifications',
    fetcher,
    { refreshInterval: 30000 },
  );

  const myIssues = mine?.issues ?? [];
  const latest = myIssues[0];
  const { data: latestDetail } = useSWR<{ issue: IssueDetail }>(
    latest ? `/api/my-reports/${latest.id}` : null,
    fetcher,
  );

  const stats = summary?.stats;
  const myMapPoints = myIssues
    .filter((i) => i.latitude != null && i.longitude != null)
    .map((i) => ({ id: i.id, publicId: i.publicId, title: i.title, latitude: i.latitude!, longitude: i.longitude!, displayStatus: i.displayStatus }));

  const recentUpdates = (all?.issues ?? []).slice(0, 3);

  return (
    <div className="space-y-8">
      <PageHeader
        kicker="Citizen workspace"
        title={`${greeting()}, ${firstName(name)}`}
        description="Your civic reports, live from the CivicChain database."
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/my-reports">My Reports</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/report">
              <PlusCircle className="w-4 h-4" /> Report Issue
            </Link>
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard label="My Reports" value={stats?.total ?? '…'} loading={summaryLoading} icon={FileText} tone="brand"
          sub={stats ? `${stats.rejected} rejected` : undefined} />
        <StatCard label="Active" value={stats?.active ?? '…'} loading={summaryLoading} icon={Activity} tone="amber"
          sub={stats ? 'in the field' : undefined} />
        <StatCard label="Resolved" value={stats?.resolved ?? '…'} loading={summaryLoading} icon={CheckCircle2} tone="emerald"
          sub={stats && stats.total > 0 ? `${Math.round((stats.resolved / stats.total) * 100)}% of reports` : undefined} />
        <StatCard label="Awaiting Verification" value={stats?.awaitingVerification ?? '…'} loading={summaryLoading} icon={ShieldCheck} tone="violet"
          sub="evidence not yet confirmed" />
        <StatCard label="Evidence Attached" value={stats?.evidenceTotal ?? '…'} loading={summaryLoading} icon={ImageIcon} tone="cyan"
          sub={stats ? `${stats.evidencePending} pending review` : undefined} />
        <StatCard label="Karma" value={stats?.karmaScore ?? '…'} loading={summaryLoading} icon={Award} tone="neutral"
          sub="reputation engine arrives later" />
      </div>

      {summaryError && <ErrorState onRetry={() => mutateSummary()} />}

      {/* ===== Hero: Live Map (primary) + Risk Intelligence (accent) ===== */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle as="h2" className="text-lg">Civic Intelligence Map</CardTitle>
              <Link href="/map" className="text-xs text-brand-600 dark:text-brand-400 flex items-center gap-1">
                Full map <ArrowRight className="w-3 h-3" />
              </Link>
            </CardHeader>
            <CardContent>
              <Link href="/map" className="block group" aria-label="Open full civic map">
                <span className="relative block">
                  <IssuesMap issues={myMapPoints} />
                  <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-brand-600 text-white text-xs font-semibold px-3 py-1.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    Open full map <ArrowRight className="w-3 h-3" />
                  </span>
                </span>
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <RiskEngine
            score={stats ? Math.min(100, Math.max(1, (stats.active ?? 0) + 10)) : undefined}
            level={stats && stats.active > 20 ? 'HIGH' : stats && stats.active > 8 ? 'MODERATE' : 'LOW'}
            ward="Your city · live"
            trend={stats ? `~${stats.active ?? 0} active` : undefined}
            confidence={0.92}
            predictedIncidents={stats?.active ?? undefined}
            live
          />

          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardHeader>
              <CardTitle as="h2" className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Link href="/report" className="flex items-center gap-3 p-3 rounded-xl bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 hover:bg-brand-100 dark:hover:bg-brand-900/30 transition-colors">
                  <PlusCircle className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                  <span className="text-sm font-medium text-brand-700 dark:text-brand-300">Report New Issue</span>
                </Link>
                <Link href="/my-reports" className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border hover:bg-neutral-100 dark:hover:bg-dark-bg-card transition-colors">
                  <FileText className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">My Reports</span>
                </Link>
                <Link href="/dashboard/notifications" className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border hover:bg-neutral-100 dark:hover:bg-dark-bg-card transition-colors">
                  <Bell className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Notifications{notifications?.unreadCount ? ` (${notifications.unreadCount} unread)` : ''}
                  </span>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ===== Reports + Timeline ===== */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle as="h2" className="text-lg">My Latest Reports</CardTitle>
              <Link href="/my-reports" className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 flex items-center gap-1">
                View All <ArrowRight className="w-4 h-4" />
              </Link>
            </CardHeader>
            <CardContent>
              {mine == null ? (
                <LoadingBlock rows={3} />
              ) : myIssues.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No reports yet"
                  description="Your first civic report can go in with a photo and a location."
                >
                  <Button size="sm" asChild><Link href="/report">Report an issue</Link></Button>
                </EmptyState>
              ) : (
                <div className="space-y-3">
                  {myIssues.slice(0, 5).map((issue) => (
                    <Link
                      key={issue.id}
                      href={`/my-reports/${issue.id}`}
                      className="flex items-center justify-between p-4 rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border hover:border-brand-300 dark:hover:border-brand-700 transition-colors"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0">
                          <MapPin className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-bold text-neutral-900 dark:text-white">{issue.publicId}</span>
                            <span className="text-sm text-neutral-600 dark:text-neutral-400">{issue.categoryLabel}</span>
                          </div>
                          <p className="text-sm text-neutral-700 dark:text-neutral-300 truncate">{issue.title}</p>
                          <p className="text-xs text-neutral-500 mt-1">{issue.location || 'Location not provided'} · {issue.timeLabel}</p>
                        </div>
                      </div>
                      <Badge variant="status" status={issue.displayStatus} size="sm" className="flex-shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle as="h2" className="text-lg">Latest Report Timeline</CardTitle>
              {latest && (
                <Link href={`/my-reports/${latest.id}`} className="text-sm text-brand-600 dark:text-brand-400 flex items-center gap-1">
                  Open <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </CardHeader>
            <CardContent>
              {!latest ? (
                <EmptyState icon={Activity} title="Nothing to track yet" description="Report your first issue to start a progress timeline here." />
              ) : !latestDetail ? (
                <LoadingBlock rows={3} />
              ) : latestDetail.issue.timeline.length === 0 ? (
                <p className="text-sm text-neutral-500 py-6 text-center">No activity has been recorded on {latest.publicId} yet.</p>
              ) : (
                <ol className="space-y-0">
                  {latestDetail.issue.timeline.map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span className={cn(
                          'w-2.5 h-2.5 rounded-full mt-1.5',
                          step.state === 'current' ? 'bg-brand-600 dark:bg-brand-400' : 'bg-neutral-300 dark:bg-neutral-600',
                        )} />
                        {i < latestDetail.issue.timeline.length - 1 && <span className="w-px flex-1 bg-neutral-200 dark:bg-dark-border" />}
                      </div>
                      <div className="pb-5">
                        <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{step.label}</p>
                        <p className="text-xs text-neutral-500">{step.date}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ===== Updates ===== */}
      <div className="grid sm:grid-cols-2 gap-6">
        <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle as="h2" className="text-lg">Latest Updates</CardTitle>
            <Link href="/dashboard/notifications" className="text-xs text-brand-600 dark:text-brand-400">View all</Link>
          </CardHeader>
          <CardContent>
            {!notifications ? (
              <LoadingBlock rows={2} />
            ) : notifications.notifications.length === 0 ? (
              <p className="text-sm text-neutral-500 py-4 text-center">No notifications yet.</p>
            ) : (
              <div className="space-y-3">
                {notifications.notifications.slice(0, 3).map((n) => (
                  <Link key={n.id} href="/dashboard/notifications" onClick={() => mutateNotifications()}
                    className="block p-3 rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border hover:border-brand-300 dark:hover:border-brand-700 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                        {n.issuePublicId && <span className="font-mono text-xs text-brand-600 dark:text-brand-400 mr-1.5">{n.issuePublicId}</span>}
                        {n.title}
                      </p>
                      <span className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', n.read ? 'bg-neutral-300 dark:bg-neutral-600' : 'bg-brand-500')} aria-hidden="true" />
                    </div>
                    {n.message && <p className="text-xs text-neutral-500 mt-1">{n.message}</p>}
                    <p className="text-[11px] text-neutral-400 mt-1.5">{n.timeLabel}</p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle as="h2" className="text-lg">Recent Civic Updates</CardTitle>
            <Link href="/dashboard/issues" className="text-xs text-brand-600 dark:text-brand-400">All issues</Link>
          </CardHeader>
          <CardContent>
            {!all ? (
              <LoadingBlock rows={2} />
            ) : recentUpdates.length === 0 ? (
              <p className="text-sm text-neutral-500 py-4 text-center">No civic issues reported yet.</p>
            ) : (
              <div className="space-y-2">
                {recentUpdates.map((issue) => (
                  <Link key={issue.id} href={`/dashboard/issues/${issue.id}`}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border hover:border-brand-300 dark:hover:border-brand-700 transition-colors">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-bold text-neutral-900 dark:text-white">{issue.publicId}</p>
                      <p className="text-sm text-neutral-700 dark:text-neutral-300 truncate">{issue.title}</p>
                    </div>
                    <Badge variant="status" status={issue.displayStatus} size="sm" className="flex-shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}