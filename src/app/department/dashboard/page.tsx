'use client';

import { useReducedMotion, motion } from 'framer-motion';
import useSWR from 'swr';
import Link from 'next/link';
import {
  FileText,
  Activity,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  History,
  Scale,
  MapPin,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/dashboard/StatCard';
import { MetricRing } from '@/components/dashboard/MetricRing';
import { IssuesMap } from '@/components/dashboard/IssuesMap';
import { LoadingBlock } from '@/components/dashboard/LoadingBlock';
import { ErrorState } from '@/components/dashboard/ErrorState';
import { EmptyState } from '@/components/dashboard/EmptyState';
import { fadeUp, staggerContainer, listItem } from '@/lib/motion';
import type { IssueListItem } from '@/lib/issues/types';

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
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const EMPTY_ISSUES: IssueListItem[] = [];

export default function DepartmentDashboard() {
  const reduce = useReducedMotion();
  const { data, error, isLoading, mutate } = useSWR<DepartmentSummary>(
    '/api/department/summary',
    fetcher,
    { refreshInterval: 30000 },
  );
  const { data: mapData } = useSWR<{ issues: IssueListItem[] }>('/api/map', fetcher, { refreshInterval: 30000 });

  const stats = data?.stats;
  const a = data?.authority;
  const resolutionRate = stats && stats.assigned > 0 ? Math.round((stats.resolved / stats.assigned) * 100) : 0;
  const slaRate = stats && stats.promisesActive + (stats.promisesBroken ?? 0) > 0
    ? Math.round((stats.promisesActive / (stats.promisesActive + stats.promisesBroken)) * 100)
    : 0;

  return (
    <div className="space-y-8">
      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="w-1.5 h-4 rounded-full bg-teal-500" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-600 dark:text-teal-400">
              Department Operations
            </span>
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white">
            {a ? a.department : 'Department Overview'}
          </h1>
          <p className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400 max-w-2xl">
            {a ? `${a.name} — ${a.jurisdiction}. All metrics sourced from the live audit trail.` : 'Operational view for your department.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/department/verification">
              <ShieldCheck className="w-4 h-4 flex-shrink-0" />
              Verification
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/department/escalations">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              Escalations
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/department/issues">
              <Zap className="w-4 h-4 flex-shrink-0" />
              Workbench
            </Link>
          </Button>
        </div>
      </div>

      {error && <ErrorState onRetry={() => mutate()} />}

      {/* ── PRIMARY METRICS ─────────────────────────────────────── */}
      <motion.div
        variants={reduce ? undefined : staggerContainer(0.05, 0.1)}
        initial={reduce ? undefined : 'hidden'}
        animate={reduce ? undefined : 'visible'}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        {[
          { label: 'Assigned Reports', value: stats?.assigned, icon: FileText, tone: 'brand' as const, sub: stats ? `${stats.open} awaiting` : undefined },
          { label: 'Active', value: stats?.active, icon: Activity, tone: 'amber' as const, sub: stats ? `${stats.inProgress} in progress` : undefined },
          { label: 'Resolved', value: stats?.resolved, icon: CheckCircle2, tone: 'emerald' as const, sub: stats && stats.assigned > 0 ? `${resolutionRate}% rate` : undefined },
          { label: 'Avg Resolution', value: stats ? formatMinutes(stats.avgResolutionMinutes) : '…', icon: Clock, tone: 'violet' as const, sub: stats?.avgResolutionMinutes === null ? 'no data yet' : 'from audit trail' },
        ].map((item) => (
          <motion.div key={item.label} variants={reduce ? undefined : listItem(12)}>
            <StatCard
              label={item.label}
              value={item.value ?? '…'}
              loading={isLoading}
              icon={item.icon}
              tone={item.tone}
              sub={item.sub}
            />
          </motion.div>
        ))}
      </motion.div>

      {/* ── SLA + MAP ───────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-6">
        <motion.div
          variants={reduce ? undefined : fadeUp(20, 0.15)}
          initial={reduce ? undefined : 'hidden'}
          animate={reduce ? undefined : 'visible'}
          className="lg:col-span-1"
        >
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200/80 dark:border-dark-border/80 h-full">
            <CardHeader>
              <CardTitle as="h2" className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Performance Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-6">
                <MetricRing
                  value={resolutionRate}
                  label="Resolution Rate"
                  sublabel="% resolved"
                  color="#16a34a"
                  size={130}
                  strokeWidth={11}
                />
                <div className="grid grid-cols-2 gap-4 w-full">
                  <MetricRing
                    value={stats?.awaitingVerification ?? 0}
                    max={stats ? Math.max(stats.assigned, 1) : 1}
                    label="Pending Verification"
                    sublabel="evidence"
                    color="#8b5cf6"
                    size={80}
                    strokeWidth={8}
                  />
                  <MetricRing
                    value={slaRate}
                    label="SLA Compliance"
                    sublabel="% on track"
                    color="#06b6d4"
                    size={80}
                    strokeWidth={8}
                  />
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-dark-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">Active Promises</span>
                  <span className="text-xs font-semibold font-mono text-neutral-900 dark:text-white">{stats?.promisesActive ?? '…'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">Broken Promises</span>
                  <span className="text-xs font-semibold font-mono text-red-500">{stats?.promisesBroken ?? '…'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">Open Escalations</span>
                  <span className="text-xs font-semibold font-mono text-amber-500">{stats?.escalationsOpen ?? '…'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          variants={reduce ? undefined : fadeUp(20, 0.2)}
          initial={reduce ? undefined : 'hidden'}
          animate={reduce ? undefined : 'visible'}
          className="lg:col-span-2"
        >
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200/80 dark:border-dark-border/80 h-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle as="h2" className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-teal-500" />
                Civic Intelligence Map
              </CardTitle>
              <Link href="/map" className="text-xs text-teal-600 dark:text-teal-400 flex items-center gap-1 hover:underline">
                Full map <ArrowRight className="w-3 h-3" />
              </Link>
            </CardHeader>
            <CardContent className="p-0 relative">
              <IssuesMap issues={mapData?.issues ?? EMPTY_ISSUES} className="w-full h-full" />
              <Link href="/map" className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-teal-700 text-white text-xs font-semibold px-3 py-1.5 shadow-lg opacity-0 hover:opacity-100 transition-opacity duration-200" aria-label="Open full civic map">
                Open full map <ArrowRight className="w-3 h-3" />
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── ACTIVITY + QUICK ACCESS ─────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-6">
        <motion.div
          variants={reduce ? undefined : fadeUp(20, 0.25)}
          initial={reduce ? undefined : 'hidden'}
          animate={reduce ? undefined : 'visible'}
          className="lg:col-span-2"
        >
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200/80 dark:border-dark-border/80">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle as="h2" className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
                <History className="w-4 h-4" />
                Activity Timeline
              </CardTitle>
              <span className="text-[11px] text-neutral-400 dark:text-neutral-500 font-mono">{data?.activity.length ?? 0} entries</span>
            </CardHeader>
            <CardContent>
              {!data ? (
                <LoadingBlock rows={4} />
              ) : data.activity.length === 0 ? (
                <EmptyState icon={History} title="No activity yet" description="Audit records from your department appear here as reports move through the system." />
              ) : (
                <div className="space-y-1">
                  {data.activity.map((log, i) => (
                    <motion.div
                      key={log.id}
                      initial={reduce ? false : { opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.04 }}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-teal-50/30 dark:hover:bg-teal-900/5 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-teal-400 dark:bg-teal-500 flex-shrink-0 group-hover:scale-125 transition-transform" />
                        <div className="min-w-0">
                          <p className="text-sm text-neutral-700 dark:text-neutral-300 truncate">
                            {log.issuePublicId && (
                              <span className="font-mono text-xs text-teal-600 dark:text-teal-400 mr-1.5">{log.issuePublicId}</span>
                            )}
                            <span className="font-medium">{log.action.replace(/_/g, ' ').toLowerCase()}</span>
                          </p>
                          <p className="text-[11px] text-neutral-400 dark:text-neutral-500">by {log.actor ?? 'system'}</p>
                        </div>
                      </div>
                      <span className="text-[11px] text-neutral-400 dark:text-neutral-500 whitespace-nowrap flex-shrink-0 font-mono">
                        {log.timeLabel}
                      </span>
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
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200/80 dark:border-dark-border/80">
            <CardHeader>
              <CardTitle as="h2" className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
                <Scale className="w-4 h-4" />
                Quick Access
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { href: '/department/issues', label: 'Workbench', value: stats?.active, valueLabel: 'active', color: 'bg-teal-500' },
                  { href: '/department/verification', label: 'Verification Queue', value: stats?.awaitingVerification, valueLabel: 'pending', color: 'bg-violet-500' },
                  { href: '/department/escalations', label: 'Escalations', value: stats?.escalationsOpen, valueLabel: 'open', color: 'bg-red-500' },
                  { href: '/department/performance', label: 'Performance', value: null, valueLabel: null, color: 'bg-emerald-500' },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200/80 dark:border-dark-border/80 hover:border-teal-300 dark:hover:border-teal-700 hover:bg-teal-50/50 dark:hover:bg-teal-900/10 transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={cn('w-1.5 h-1.5 rounded-full', item.color)} />
                      <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 group-hover:text-teal-700 dark:group-hover:text-teal-300 transition-colors">{item.label}</span>
                    </div>
                    {item.value !== null ? (
                      <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400">{item.value} {item.valueLabel}</span>
                    ) : (
                      <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-teal-500 transition-colors" />
                    )}
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card variant="outlined" padding="sm" className="bg-teal-50/50 dark:bg-teal-900/10 border-teal-200/80 dark:border-teal-900/40">
            <CardContent className="p-4">
              <div className="flex items-start gap-2.5">
                <Activity className="w-4 h-4 text-teal-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-teal-700 dark:text-teal-300 leading-relaxed">
                  All metrics are computed from the real audit trail — no simulated workload. SLA tracking activates once promises are set.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}
