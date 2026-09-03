'use client';

import { useReducedMotion, motion } from 'framer-motion';
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
  MapPin,
  TrendingUp,
  Clock,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { CommandStatCard } from '@/components/dashboard/CommandStatCard';
import { MetricRing } from '@/components/dashboard/MetricRing';
import { IssuesMap } from '@/components/dashboard/IssuesMap';
import { LoadingBlock } from '@/components/dashboard/LoadingBlock';
import { ErrorState } from '@/components/dashboard/ErrorState';
import { fadeUp, staggerContainer, listItem } from '@/lib/motion';
import type { AuditEventItem, IssueListItem } from '@/lib/issues/types';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface PlatformStats {
  users: number;
  authorities: number;
  departments: number;
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

const EMPTY_ISSUES: IssueListItem[] = [];

export default function AdminDashboard() {
  const reduce = useReducedMotion();
  const { data: statsData, error: statsError, mutate: mutateStats } = useSWR<{ stats: PlatformStats }>('/api/admin/stats', fetcher, { refreshInterval: 30000 });
  const { data: health } = useSWR<HealthData>('/api/admin/health', fetcher, { refreshInterval: 60000 });
  const { data: depts } = useSWR<{ authorities: Array<{ id: string; name: string; department: string; jurisdiction: string; assigned: number; active: number; escalationsOpen: number }> }>('/api/admin/departments', fetcher, { refreshInterval: 30000 });
  const { data: audit, error: auditError } = useSWR<{ logs: AuditEventItem[] }>('/api/admin/audit', fetcher, { refreshInterval: 30000 });
  const { data: mapData } = useSWR<{ issues: IssueListItem[] }>('/api/map', fetcher, { refreshInterval: 30000 });

  const s = statsData?.stats;
  const healthOk = health ? Object.values(health.checks).every((c) => c.ok) : null;
  const resolutionRate = s && s.issues > 0 ? Math.round((s.resolved / s.issues) * 100) : 0;
  const evidenceRate = s && (s.verifiedEvidence + s.pendingEvidence) > 0
    ? Math.round((s.verifiedEvidence / (s.verifiedEvidence + s.pendingEvidence)) * 100)
    : 0;

  return (
    <div className="space-y-8">
      <PageHeader
        kicker="Admin workspace"
        title="Platform Overview"
        description="Live operational intelligence across the entire CivicChain deployment."
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/health">
            <Activity className="w-4 h-4 flex-shrink-0" />
            Health check
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/analytics">
            <TrendingUp className="w-4 h-4 flex-shrink-0" />
            Analytics
          </Link>
        </Button>
        <Button size="sm" asChild>
          <Link href="/admin/issues">
            <Zap className="w-4 h-4 flex-shrink-0" />
            Manage issues
          </Link>
        </Button>
      </PageHeader>

      {statsError && <ErrorState onRetry={() => mutateStats()} />}

      {/* Primary metrics */}
      <motion.div
        variants={reduce ? undefined : staggerContainer(0.05, 0.1)}
        initial={reduce ? undefined : 'hidden'}
        animate={reduce ? undefined : 'visible'}
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4"
      >
        {[
          { label: 'Users', value: s?.users, icon: Users, tone: 'brand' as const },
          { label: 'Departments', value: s?.departments, icon: Building2, tone: 'violet' as const },
          { label: 'Total Issues', value: s?.issues, icon: FileText, tone: 'cyan' as const, sub: s ? `${s.activeIssues} active` : undefined },
          { label: 'Resolved', value: s?.resolved, icon: CheckCircle2, tone: 'emerald' as const, sub: s && s.issues > 0 ? `${resolutionRate}% rate` : undefined },
          { label: 'Escalations', value: s?.escalations, icon: AlertTriangle, tone: 'red' as const, critical: (s?.escalations ?? 0) > 0 },
        ].map((item) => (
          <motion.div key={item.label} variants={reduce ? undefined : listItem(12)}>
            <CommandStatCard
              label={item.label}
              value={item.value ?? '…'}
              loading={!s}
              icon={item.icon}
              tone={item.tone}
              sub={item.sub}
              critical={item.critical}
            />
          </motion.div>
        ))}
      </motion.div>

      {/* Platform health rings + Department performance */}
      <div className="grid lg:grid-cols-3 gap-6">
        <motion.div
          variants={reduce ? undefined : fadeUp(20, 0.15)}
          initial={reduce ? undefined : 'hidden'}
          animate={reduce ? undefined : 'visible'}
          className="lg:col-span-1"
        >
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200/80 dark:border-dark-border/80 h-full">
            <CardHeader>
              <CardTitle as="h2" className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                Platform Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-6">
                <MetricRing
                  value={resolutionRate}
                  label="Resolution Rate"
                  sublabel="% resolved"
                  color="#16a34a"
                  size={140}
                  strokeWidth={12}
                />
                <div className="grid grid-cols-2 gap-4 w-full">
                  <MetricRing
                    value={evidenceRate}
                    label="Evidence Verified"
                    sublabel="% verified"
                    color="#3f53ec"
                    size={80}
                    strokeWidth={8}
                  />
                  <MetricRing
                    value={s ? s.users : 0}
                    max={s ? Math.max(s.users * 1.5, 100) : 100}
                    label="User Base"
                    sublabel="registered"
                    color="#8b5cf6"
                    size={80}
                    strokeWidth={8}
                  />
                </div>
              </div>

              {health && (
                <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-dark-border">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-3">System Checks</p>
                  <div className="space-y-2">
                    {Object.entries(health.checks).map(([key, check]) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-xs text-neutral-600 dark:text-neutral-400 capitalize">{key}</span>
                        <span className={cn('text-xs font-semibold', check.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                          {check.ok ? 'OK' : 'FAIL'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
              <CardTitle as="h2" className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Department Performance
              </CardTitle>
              <Link href="/admin/departments" className="text-xs text-brand-600 dark:text-brand-400 flex items-center gap-1 hover:underline">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </CardHeader>
            <CardContent>
              {!depts ? (
                <LoadingBlock rows={3} />
              ) : depts.authorities.length === 0 ? (
                <p className="text-sm text-neutral-500 py-8 text-center">No departments configured yet.</p>
              ) : (
                <div className="space-y-3">
                  {depts.authorities.slice(0, 5).map((dept) => {
                    const maxAssigned = Math.max(...depts.authorities.map((d) => d.assigned), 1);
                    const barWidth = Math.round((dept.assigned / maxAssigned) * 100);
                    return (
                      <div key={dept.id} className="group">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">{dept.department}</p>
                            <p className="text-[11px] text-neutral-400 dark:text-neutral-500">{dept.jurisdiction}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                            <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400">{dept.assigned}</span>
                            {dept.escalationsOpen > 0 && (
                              <Badge variant="status" status="brokenPromise" size="sm">{dept.escalationsOpen}</Badge>
                            )}
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-neutral-100 dark:bg-dark-border overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-brand-500 dark:bg-brand-400"
                            initial={{ width: 0 }}
                            animate={{ width: `${barWidth}%` }}
                            transition={{ duration: reduce ? 0 : 0.8, ease: 'easeOut', delay: 0.3 }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Citywide Map */}
      <motion.div
        variants={reduce ? undefined : fadeUp(20, 0.25)}
        initial={reduce ? undefined : 'hidden'}
        animate={reduce ? undefined : 'visible'}
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
            <IssuesMap issues={mapData?.issues ?? EMPTY_ISSUES} className="w-full h-full" />
            <Link href="/map" className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-brand-700 text-white text-xs font-semibold px-3 py-1.5 shadow-lg opacity-0 hover:opacity-100 transition-opacity duration-200" aria-label="Open full civic map">
              Open full map <ArrowRight className="w-3 h-3" />
            </Link>
          </CardContent>
        </Card>
      </motion.div>

      {/* Audit Trail + Departments + Notifications */}
      <div className="grid lg:grid-cols-3 gap-6">
        <motion.div
          variants={reduce ? undefined : fadeUp(20, 0.3)}
          initial={reduce ? undefined : 'hidden'}
          animate={reduce ? undefined : 'visible'}
          className="lg:col-span-2"
        >
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200/80 dark:border-dark-border/80">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle as="h2" className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
                <History className="w-4 h-4" />
                Audit Trail
              </CardTitle>
              <Link href="/admin/audit" className="text-xs text-brand-600 dark:text-brand-400 flex items-center gap-1 hover:underline">
                Full trail <ArrowRight className="w-3 h-3" />
              </Link>
            </CardHeader>
            <CardContent>
              {!audit && !auditError ? (
                <LoadingBlock rows={4} />
              ) : auditError || (audit?.logs.length ?? 0) === 0 ? (
                <div className="py-10 text-center">
                  <History className="w-8 h-8 text-neutral-300 dark:text-neutral-600 mx-auto mb-2" />
                  <p className="text-sm text-neutral-500">No audit records yet.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {audit?.logs.slice(0, 8).map((log, i) => (
                    <motion.div
                      key={log.id}
                      initial={reduce ? false : { opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.04 }}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-neutral-50 dark:hover:bg-dark-bg transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-brand-400 dark:bg-brand-500 flex-shrink-0 group-hover:scale-125 transition-transform" />
                        <div className="min-w-0">
                          <p className="text-sm text-neutral-700 dark:text-neutral-300 truncate">
                            {log.issuePublicId && (
                              <span className="font-mono text-xs text-brand-600 dark:text-brand-400 mr-1.5">{log.issuePublicId}</span>
                            )}
                            <span className="font-medium">{log.action.replace(/_/g, ' ').toLowerCase()}</span>
                            {log.entityType && log.entityType !== 'Issue' && (
                              <span className="text-neutral-400 dark:text-neutral-500 ml-1">on {log.entityType}</span>
                            )}
                          </p>
                          <p className="text-[11px] text-neutral-400 dark:text-neutral-500">by {log.actor ?? 'system'}</p>
                        </div>
                      </div>
                      <span className="text-[11px] text-neutral-400 dark:text-neutral-500 whitespace-nowrap flex-shrink-0 font-mono">
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          variants={reduce ? undefined : fadeUp(20, 0.35)}
          initial={reduce ? undefined : 'hidden'}
          animate={reduce ? undefined : 'visible'}
          className="space-y-6"
        >
          {/* Quick Stats */}
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200/80 dark:border-dark-border/80">
            <CardHeader>
              <CardTitle as="h2" className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Quick Stats
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { label: 'Notifications', value: s?.notifications, icon: Bell, color: 'text-cyan-500' },
                  { label: 'Audit Logs', value: s?.auditLogs, icon: History, color: 'text-neutral-500' },
                  { label: 'Verified Evidence', value: s?.verifiedEvidence, icon: ShieldCheck, color: 'text-emerald-500' },
                  { label: 'Pending Evidence', value: s?.pendingEvidence, icon: Clock, color: 'text-amber-500' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <item.icon className={cn('w-4 h-4', item.color)} />
                      <span className="text-sm text-neutral-600 dark:text-neutral-400">{item.label}</span>
                    </div>
                    <span className="text-sm font-semibold font-mono text-neutral-900 dark:text-white">
                      {s ? <AnimatedNumber value={item.value ?? 0} /> : '…'}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* System Status */}
          <Card variant="elevated" className={cn(
            'border',
            healthOk === true
              ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200/80 dark:border-emerald-900/40'
              : healthOk === false
                ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200/80 dark:border-amber-900/40'
                : 'bg-white dark:bg-dark-bg-card border-neutral-200/80 dark:border-dark-border/80'
          )}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className={cn('w-2 h-2 rounded-full', healthOk === true ? 'bg-emerald-500' : healthOk === false ? 'bg-amber-500 animate-pulse' : 'bg-neutral-300')} />
                <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                  System {healthOk === true ? 'Operational' : healthOk === false ? 'Needs Attention' : 'Checking…'}
                </span>
              </div>
              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link href="/admin/health">
                  Inspect health
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Link>
              </Button>
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
