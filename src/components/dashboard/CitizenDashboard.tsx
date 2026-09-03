'use client';

import { useReducedMotion, motion } from 'framer-motion';
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
  TrendingUp,
  Users,
  Target,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { StatCard } from '@/components/dashboard/StatCard';
import { MetricRing } from '@/components/dashboard/MetricRing';
import { LoadingBlock } from '@/components/dashboard/LoadingBlock';
import { EmptyState } from '@/components/dashboard/EmptyState';
import { ErrorState } from '@/components/dashboard/ErrorState';
import { IssuesMap } from '@/components/dashboard/IssuesMap';
import { RiskEngine } from '@/components/dashboard/RiskEngine';
import { fadeUp, staggerContainer, listItem } from '@/lib/motion';
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

interface RiskSummaryData {
  totalAreas: number;
  totalActiveIssues: number;
  totalSlaBreaches: number;
  averageRiskScore: number;
  overallTrend: { direction: 'INCREASING' | 'STABLE' | 'DECREASING'; percentage: number } | null;
  topHotspots: Array<{ areaName: string; riskScore: number; riskLevel: string }>;
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

const EMPTY_ISSUES: IssueListItem[] = [];

export function CitizenDashboard({ name }: { name?: string | null }) {
  const reduce = useReducedMotion();
  const { data: summary, error: summaryError, isLoading: summaryLoading, mutate: mutateSummary } =
    useSWR<{ stats: CitizenStats }>('/api/citizen/summary', fetcher, { refreshInterval: 30000 });
  const { data: mine } = useSWR<{ issues: IssueListItem[] }>('/api/my-reports', fetcher, { refreshInterval: 30000 });
  const { data: all } = useSWR<{ issues: IssueListItem[] }>('/api/issues', fetcher, { refreshInterval: 60000 });
  const { data: notifications, mutate: mutateNotifications } = useSWR<{ notifications: NotificationItem[]; unreadCount: number }>(
    '/api/notifications',
    fetcher,
    { refreshInterval: 30000 },
  );
  const { data: risk } = useSWR<RiskSummaryData>('/api/risk/summary', fetcher, { refreshInterval: 60000 });

  const myIssues = mine?.issues ?? EMPTY_ISSUES;
  const latest = myIssues[0];
  const { data: latestDetail } = useSWR<{ issue: IssueDetail }>(
    latest ? `/api/my-reports/${latest.id}` : null,
    fetcher,
  );

  const stats = summary?.stats;
  const riskLevel =
    risk?.averageRiskScore == null
      ? null
      : risk.averageRiskScore >= 75
        ? 'CRITICAL'
        : risk.averageRiskScore >= 50
          ? 'HIGH'
          : risk.averageRiskScore >= 25
            ? 'MEDIUM'
            : 'LOW';
  const riskTrend = risk?.overallTrend
    ? `${risk.overallTrend.direction === 'INCREASING' ? '+' : risk.overallTrend.direction === 'DECREASING' ? '−' : ''}${risk.overallTrend.percentage}% vs prior cycle`
    : null;
  const allIssues = all?.issues ?? EMPTY_ISSUES;

  const recentUpdates = allIssues.slice(0, 3);
  const resolutionRate = stats && stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0;

  return (
    <div className="space-y-8">
      <PageHeader
        kicker="Citizen workspace"
        title={`${greeting()}, ${firstName(name)}`}
        description="Your civic impact, tracked in real time."
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/my-reports">
            <FileText className="w-4 h-4 flex-shrink-0" />
            My Reports
          </Link>
        </Button>
        <Button size="sm" asChild>
          <Link href="/report">
            <PlusCircle className="w-4 h-4 flex-shrink-0" />
            Report Issue
          </Link>
        </Button>
      </PageHeader>

      {summaryError && <ErrorState onRetry={() => mutateSummary()} />}

      {/* Primary metrics */}
      <motion.div
        variants={reduce ? undefined : staggerContainer(0.05, 0.1)}
        initial={reduce ? undefined : 'hidden'}
        animate={reduce ? undefined : 'visible'}
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"
      >
        {[
          { label: 'My Reports', value: stats?.total, icon: FileText, tone: 'brand' as const, sub: stats ? `${stats.rejected} rejected` : undefined },
          { label: 'Active', value: stats?.active, icon: Activity, tone: 'amber' as const, sub: stats ? 'in the field' : undefined },
          { label: 'Resolved', value: stats?.resolved, icon: CheckCircle2, tone: 'emerald' as const, sub: stats && stats.total > 0 ? `${resolutionRate}% of reports` : undefined },
          { label: 'Awaiting Verification', value: stats?.awaitingVerification, icon: ShieldCheck, tone: 'violet' as const, sub: 'evidence pending' },
          { label: 'Evidence Attached', value: stats?.evidenceTotal, icon: ImageIcon, tone: 'cyan' as const, sub: stats ? `${stats.evidencePending} pending` : undefined },
          { label: 'Karma', value: stats?.karmaScore, icon: Award, tone: 'neutral' as const, sub: 'earned score' },
        ].map((item) => (
          <motion.div key={item.label} variants={reduce ? undefined : listItem(12)}>
            <StatCard
              label={item.label}
              value={item.value ?? '…'}
              loading={summaryLoading}
              icon={item.icon}
              tone={item.tone}
              sub={item.sub}
            />
          </motion.div>
        ))}
      </motion.div>

      {/* Hero: Live Map + Risk + Community Impact */}
      <div className="grid lg:grid-cols-3 gap-6">
        <motion.div
          variants={reduce ? undefined : fadeUp(20, 0.15)}
          initial={reduce ? undefined : 'hidden'}
          animate={reduce ? undefined : 'visible'}
          className="lg:col-span-2 space-y-6"
        >
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200/80 dark:border-dark-border/80 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle as="h2" className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-brand-500" />
                Civic Intelligence Map
              </CardTitle>
              <Link href="/map" className="text-xs text-brand-600 dark:text-brand-400 flex items-center gap-1 hover:underline">
                Full map <ArrowRight className="w-3 h-3" />
              </Link>
            </CardHeader>
            <CardContent className="p-0 relative">
              <IssuesMap issues={allIssues} />
              <Link href="/map" className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-brand-700 text-white text-xs font-semibold px-3 py-1.5 shadow-lg opacity-0 hover:opacity-100 transition-opacity duration-200" aria-label="Open full civic map">
                Open full map <ArrowRight className="w-3 h-3" />
              </Link>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          variants={reduce ? undefined : fadeUp(20, 0.2)}
          initial={reduce ? undefined : 'hidden'}
          animate={reduce ? undefined : 'visible'}
          className="space-y-6"
        >
          <RiskEngine
            score={risk && risk.totalAreas > 0 ? Math.max(0, Math.min(100, Math.round(risk.averageRiskScore))) : undefined}
            level={risk && risk.totalAreas > 0 ? riskLevel : undefined}
            ward={risk && risk.topHotspots[0]?.areaName ? risk.topHotspots[0].areaName : undefined}
            trend={risk && risk.totalAreas > 0 ? riskTrend : undefined}
            confidence={risk && risk.totalAreas > 0 ? Math.max(0, Math.min(1, risk.averageRiskScore / 100)) : undefined}
            predictedIncidents={risk && risk.totalAreas > 0 ? risk.totalActiveIssues : undefined}
            live
          />

          {/* Community Impact */}
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200/80 dark:border-dark-border/80">
            <CardHeader>
              <CardTitle as="h2" className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Community Pulse
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-around py-2">
                <MetricRing
                  value={stats?.active ?? 0}
                  max={stats ? Math.max(stats.total, 1) : 1}
                  label="Active Issues"
                  sublabel="community"
                  color="#f59e0b"
                  size={72}
                  strokeWidth={7}
                />
                <MetricRing
                  value={stats?.resolved ?? 0}
                  max={stats ? Math.max(stats.total, 1) : 1}
                  label="Resolved"
                  sublabel="citywide"
                  color="#16a34a"
                  size={72}
                  strokeWidth={7}
                />
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200/80 dark:border-dark-border/80">
            <CardHeader>
              <CardTitle as="h2" className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { href: '/report', icon: PlusCircle, label: 'Report New Issue', color: 'text-brand-500', highlight: true },
                  { href: '/my-reports', icon: FileText, label: 'My Reports', color: 'text-neutral-500', highlight: false },
                  { href: '/dashboard/notifications', icon: Bell, label: `Notifications${notifications?.unreadCount ? ` (${notifications.unreadCount})` : ''}`, color: 'text-neutral-500', highlight: false },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group',
                      item.highlight
                        ? 'bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 hover:bg-brand-100 dark:hover:bg-brand-900/30'
                        : 'bg-neutral-50 dark:bg-dark-bg border border-neutral-200/80 dark:border-dark-border/80 hover:border-brand-300 dark:hover:border-brand-700'
                    )}
                  >
                    <item.icon className={cn('w-5 h-5', item.color)} />
                    <span className={cn('text-sm font-medium', item.highlight ? 'text-brand-700 dark:text-brand-300' : 'text-neutral-700 dark:text-neutral-300 group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors')}>
                      {item.label}
                    </span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Reports + Timeline */}
      <div className="grid lg:grid-cols-3 gap-6">
        <motion.div
          variants={reduce ? undefined : fadeUp(20, 0.25)}
          initial={reduce ? undefined : 'hidden'}
          animate={reduce ? undefined : 'visible'}
          className="lg:col-span-2 space-y-6"
        >
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200/80 dark:border-dark-border/80">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle as="h2" className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
                <Target className="w-4 h-4" />
                My Latest Reports
              </CardTitle>
              <Link href="/my-reports" className="text-xs text-brand-600 dark:text-brand-400 flex items-center gap-1 hover:underline">
                View All <ArrowRight className="w-3 h-3" />
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
                <div className="space-y-2">
                  {myIssues.slice(0, 5).map((issue, i) => (
                    <motion.div
                      key={issue.id}
                      initial={reduce ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.05 }}
                    >
                      <Link
                        href={`/my-reports/${issue.id}`}
                        className="flex items-center justify-between p-4 rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200/80 dark:border-dark-border/80 hover:border-brand-300 dark:hover:border-brand-700 hover:bg-brand-50/30 dark:hover:bg-brand-900/10 transition-all duration-200 group"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0 group-hover:bg-brand-100 dark:group-hover:bg-brand-900/50 transition-colors">
                            <MapPin className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-sm font-bold text-neutral-900 dark:text-white">{issue.publicId}</span>
                              <span className="text-xs text-neutral-500 dark:text-neutral-400">{issue.categoryLabel}</span>
                            </div>
                            <p className="text-sm text-neutral-700 dark:text-neutral-300 truncate mt-0.5">{issue.title}</p>
                            <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">{issue.location || 'Location not provided'} · {issue.timeLabel}</p>
                          </div>
                        </div>
                        <Badge variant="status" status={issue.displayStatus} size="sm" className="flex-shrink-0 ml-3" />
                      </Link>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          variants={reduce ? undefined : fadeUp(20, 0.3)}
          initial={reduce ? undefined : 'hidden'}
          animate={reduce ? undefined : 'visible'}
          className="space-y-6"
        >
          {/* Timeline */}
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200/80 dark:border-dark-border/80">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle as="h2" className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Latest Timeline
              </CardTitle>
              {latest && (
                <Link href={`/my-reports/${latest.id}`} className="text-xs text-brand-600 dark:text-brand-400 flex items-center gap-1 hover:underline">
                  Open <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </CardHeader>
            <CardContent>
              {!latest ? (
                <div className="py-8 text-center">
                  <Activity className="w-8 h-8 text-neutral-300 dark:text-neutral-600 mx-auto mb-2" />
                  <p className="text-sm text-neutral-500">Nothing to track yet</p>
                  <p className="text-xs text-neutral-400 mt-1">Report your first issue to start.</p>
                </div>
              ) : !latestDetail ? (
                <LoadingBlock rows={3} />
              ) : latestDetail.issue.timeline.length === 0 ? (
                <p className="text-sm text-neutral-500 py-6 text-center">No activity recorded on {latest.publicId} yet.</p>
              ) : (
                <ol className="space-y-0">
                  {latestDetail.issue.timeline.map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span className={cn(
                          'w-2.5 h-2.5 rounded-full mt-1.5 ring-4 ring-white dark:ring-dark-bg-card',
                          step.state === 'current' ? 'bg-brand-600 dark:bg-brand-400' : 'bg-neutral-300 dark:bg-neutral-600',
                        )} />
                        {i < latestDetail.issue.timeline.length - 1 && <span className="w-px flex-1 bg-neutral-200 dark:bg-dark-border" />}
                      </div>
                      <div className="pb-5">
                        <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{step.label}</p>
                        <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5">{step.date}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Notifications + Updates */}
      <div className="grid sm:grid-cols-2 gap-6">
        <motion.div
          variants={reduce ? undefined : fadeUp(20, 0.35)}
          initial={reduce ? undefined : 'hidden'}
          animate={reduce ? undefined : 'visible'}
        >
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200/80 dark:border-dark-border/80 h-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle as="h2" className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
                <Bell className="w-4 h-4" />
                Latest Updates
              </CardTitle>
              <Link href="/dashboard/notifications" className="text-xs text-brand-600 dark:text-brand-400 hover:underline">View all</Link>
            </CardHeader>
            <CardContent>
              {!notifications ? (
                <LoadingBlock rows={2} />
              ) : notifications.notifications.length === 0 ? (
                <div className="py-8 text-center">
                  <Bell className="w-8 h-8 text-neutral-300 dark:text-neutral-600 mx-auto mb-2" />
                  <p className="text-sm text-neutral-500">No notifications yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {notifications.notifications.slice(0, 3).map((n) => (
                    <Link key={n.id} href="/dashboard/notifications" onClick={() => mutateNotifications()}
                      className="block p-3 rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200/80 dark:border-dark-border/80 hover:border-brand-300 dark:hover:border-brand-700 transition-colors group">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors">
                          {n.issuePublicId && <span className="font-mono text-xs text-brand-600 dark:text-brand-400 mr-1.5">{n.issuePublicId}</span>}
                          {n.title}
                        </p>
                        <span className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', n.read ? 'bg-neutral-300 dark:bg-neutral-600' : 'bg-brand-500 animate-pulse')} aria-hidden="true" />
                      </div>
                      {n.message && <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">{n.message}</p>}
                      <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1.5 font-mono">{n.timeLabel}</p>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          variants={reduce ? undefined : fadeUp(20, 0.4)}
          initial={reduce ? undefined : 'hidden'}
          animate={reduce ? undefined : 'visible'}
        >
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200/80 dark:border-dark-border/80 h-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle as="h2" className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Recent Civic Updates
              </CardTitle>
              <Link href="/dashboard/issues" className="text-xs text-brand-600 dark:text-brand-400 hover:underline">All issues</Link>
            </CardHeader>
            <CardContent>
              {!all ? (
                <LoadingBlock rows={2} />
              ) : recentUpdates.length === 0 ? (
                <div className="py-8 text-center">
                  <TrendingUp className="w-8 h-8 text-neutral-300 dark:text-neutral-600 mx-auto mb-2" />
                  <p className="text-sm text-neutral-500">No civic issues reported yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentUpdates.map((issue) => (
                    <Link key={issue.id} href={`/dashboard/issues/${issue.id}`}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200/80 dark:border-dark-border/80 hover:border-brand-300 dark:hover:border-brand-700 transition-colors group">
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-bold text-neutral-900 dark:text-white">{issue.publicId}</p>
                        <p className="text-sm text-neutral-700 dark:text-neutral-300 truncate group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors">{issue.title}</p>
                      </div>
                      <Badge variant="status" status={issue.displayStatus} size="sm" className="flex-shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
