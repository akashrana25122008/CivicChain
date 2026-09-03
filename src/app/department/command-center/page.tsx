'use client';

import { useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  MapPin,
  Search,
  TrendingUp,
  Zap,
  XCircle,
  ArrowUpRight,
  Target,
  Bell,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingBlock } from '@/components/dashboard/LoadingBlock';
import { EmptyState } from '@/components/dashboard/EmptyState';
import { ErrorState } from '@/components/dashboard/ErrorState';
import { CommandStatCard } from '@/components/dashboard/CommandStatCard';
import { IssueDrawer } from '@/components/dashboard/IssueDrawer';
import { CommandCenterMap, type CommandCenterMapMarker } from '@/components/department/CommandCenterMap';
import { cn } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
});

const REFRESH_INTERVAL = 15_000;

interface Kpis {
  total: number;
  active: number;
  resolved: number;
  breached: number;
  atRisk: number;
  onTrack: number;
  noSla: number;
  escalationsOpen: number;
  promisesActive: number;
  promisesOnTime: number;
  promisesBroken: number;
  slaPerformancePct: number | null;
}

interface QueueItem {
  id: string;
  publicId: string;
  title: string;
  categoryLabel: string;
  status: string;
  severity: string | null;
  severityLabel: string | null;
  priorityLevel: string | null;
  ward: string | null;
  location: string | null;
  riskLevel: string | null;
  slaState: string;
  deadline: string | null;
  createdAt: string;
  timeLabel: string;
  queueScore: number;
  queueLevel: string;
  queueComponents: Array<{ key: string; label: string; contribution: number }>;
}

interface Escalation {
  id: string;
  issueId: string;
  issuePublicId: string;
  issueTitle: string;
  level: number;
  status: string;
  reason: string | null;
  timeLabel: string;
}

interface Filters {
  categories: Array<{ value: string; label: string }>;
  statuses: Array<{ value: string; label: string }>;
  severity: Array<{ value: string; label: string }>;
  wards: Array<{ value: string; label: string }>;
  priorityLevels: Array<{ value: string; label: string }>;
}

interface CommandCenterData {
  authority: { name: string; department: string; jurisdiction: string | null };
  kpis: Kpis;
  queue: QueueItem[];
  queueTotal: number;
  map: CommandCenterMapMarker[];
  mappedCount: number;
  escalations: Escalation[];
  filters: Filters;
}

const QUEUE_LEVEL_TONE: Record<string, 'red' | 'amber' | 'emerald' | 'brand' | 'violet' | 'neutral'> = {
  CRITICAL: 'red',
  HIGH: 'amber',
  MEDIUM: 'brand',
  LOW: 'emerald',
};

function slaBadgeFor(sla: string): string {
  if (sla === 'ON_TRACK') return 'onTrack';
  if (sla === 'AT_RISK') return 'atRisk';
  if (sla === 'BREACHED') return 'brokenPromise';
  return 'resolved';
}

function formatPct(value: number | null): string {
  return value != null ? `${value}%` : '—';
}

export default function DepartmentCommandCenter() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);

  const qs = useMemo(() => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v) sp.set(k, v);
    }
    return sp.toString();
  }, [filters]);

  const url = `/api/department/command-center${qs ? `?${qs}` : ''}`;
  const { data, error, isLoading, mutate } = useSWR<CommandCenterData>(url, fetcher, {
    refreshInterval: REFRESH_INTERVAL,
    revalidateOnFocus: true,
  });

  const setFilter = useCallback((key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const openDrawer = useCallback((id: string) => {
    setDrawerId(id);
    setSelectedId(id);
  }, []);

  const kpis = data?.kpis;

  return (
    <div className="space-y-6">
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
            {data ? `${data.authority.department}` : 'Command Center'}
          </h1>
          <p className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400 max-w-2xl">
            {data
              ? `${data.authority.name} — ${data.authority.jurisdiction ?? 'All jurisdiction'}`
              : 'Real-time operational view scoped to your department.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/department/dashboard">Dashboard</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/department/issues">Workbench</Link>
          </Button>
        </div>
      </div>

      {error && <ErrorState onRetry={() => mutate()} />}

      {/* ── KPIs — intelligent metric hierarchy ───────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <CommandStatCard
          label="Active Issues"
          value={kpis?.active ?? '…'}
          loading={isLoading}
          icon={Activity}
          tone="teal"
          sub={kpis ? `${kpis.total} total` : undefined}
        />
        <CommandStatCard
          label="SLA Breached"
          value={kpis?.breached ?? '…'}
          loading={isLoading}
          icon={AlertTriangle}
          tone="red"
          critical={Boolean(kpis?.breached)}
          sub="missed deadline"
        />
        <CommandStatCard
          label="At Risk"
          value={kpis?.atRisk ?? '…'}
          loading={isLoading}
          icon={Clock}
          tone="amber"
          sub="approaching deadline"
        />
        <CommandStatCard
          label="On Track"
          value={kpis?.onTrack ?? '…'}
          loading={isLoading}
          icon={CheckCircle2}
          tone="emerald"
          sub="within window"
        />
        <CommandStatCard
          label="SLA Performance"
          value={formatPct(kpis?.slaPerformancePct ?? null)}
          loading={isLoading}
          icon={Target}
          tone="violet"
          sub="promises honoured"
        />
        <CommandStatCard
          label="Escalations"
          value={kpis?.escalationsOpen ?? '…'}
          loading={isLoading}
          icon={ArrowUpRight}
          tone="red"
          critical={Boolean(kpis?.escalationsOpen)}
          sub="open"
        />
      </div>

      {/* ── MAIN CONTENT — 2-column layout ───────────────────── */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Priority Queue + Escalations */}
        <div className="lg:col-span-2 space-y-6">
          {/* Filters */}
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle as="h2" className="text-sm flex items-center gap-2">
                <Filter className="w-4 h-4 text-neutral-400" /> Filters
              </CardTitle>
              {Object.values(filters).some(Boolean) && (
                <Button variant="ghost" size="sm" onClick={() => setFilters({})}>
                  <XCircle className="w-3 h-3 mr-1" /> Clear
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search title / ID / location…"
                    value={filters.q ?? ''}
                    onChange={(e) => setFilter('q', e.target.value)}
                    className="w-full pl-8 pr-2 py-1.5 text-sm rounded-lg border border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg focus:border-teal-500 focus:ring-1 focus:ring-teal-200 outline-none"
                  />
                </div>
                <select
                  value={filters.severity ?? ''}
                  onChange={(e) => setFilter('severity', e.target.value)}
                  className="text-sm rounded-lg border border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg px-2 py-1.5"
                >
                  <option value="">All severities</option>
                  {data?.filters.severity.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <select
                  value={filters.status ?? ''}
                  onChange={(e) => setFilter('status', e.target.value)}
                  className="text-sm rounded-lg border border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg px-2 py-1.5"
                >
                  <option value="">All statuses</option>
                  {data?.filters.statuses.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <select
                  value={filters.slaState ?? ''}
                  onChange={(e) => setFilter('slaState', e.target.value)}
                  className="text-sm rounded-lg border border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg px-2 py-1.5"
                >
                  <option value="">All SLA states</option>
                  <option value="BREACHED">BREACHED</option>
                  <option value="AT_RISK">AT RISK</option>
                  <option value="ON_TRACK">ON TRACK</option>
                </select>
                <select
                  value={filters.riskLevel ?? ''}
                  onChange={(e) => setFilter('riskLevel', e.target.value)}
                  className="text-sm rounded-lg border border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg px-2 py-1.5"
                >
                  <option value="">All risk levels</option>
                  {data?.filters.priorityLevels.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <select
                  value={filters.priorityLevel ?? ''}
                  onChange={(e) => setFilter('priorityLevel', e.target.value)}
                  className="text-sm rounded-lg border border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg px-2 py-1.5"
                >
                  <option value="">All priority levels</option>
                  {data?.filters.priorityLevels.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                {data?.filters.wards && data.filters.wards.length > 0 && (
                  <select
                    value={filters.ward ?? ''}
                    onChange={(e) => setFilter('ward', e.target.value)}
                    className="text-sm rounded-lg border border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg px-2 py-1.5"
                  >
                    <option value="">All wards</option>
                    {data.filters.wards.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                )}
                <select
                  value={filters.category ?? ''}
                  onChange={(e) => setFilter('category', e.target.value)}
                  className="text-sm rounded-lg border border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg px-2 py-1.5"
                >
                  <option value="">All categories</option>
                  {data?.filters.categories.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Priority Queue */}
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle as="h2" className="text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" /> Priority Queue
              </CardTitle>
              <span className="text-xs text-neutral-500">{data?.queueTotal ?? 0} active</span>
            </CardHeader>
            <CardContent>
              {isLoading && !data ? (
                <LoadingBlock rows={5} />
              ) : !data || data.queue.length === 0 ? (
                <EmptyState icon={Zap} title="No active reports" description="Reports assigned to your department will appear here, ordered by urgency." />
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {data.queue.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => openDrawer(item.id)}
                      className={cn(
                        'w-full text-left p-3 rounded-xl border transition-colors',
                        item.id === selectedId
                          ? 'border-teal-400 dark:border-teal-600 bg-teal-50/50 dark:bg-teal-900/10'
                          : 'border-neutral-200 dark:border-dark-border bg-neutral-50 dark:bg-dark-bg hover:border-neutral-300 dark:hover:border-dark-border-hover',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-teal-600 dark:text-teal-400">{item.publicId}</span>
                            <Badge variant="status" status={slaBadgeFor(item.slaState)} size="sm">
                              {item.slaState.replace('_', ' ')}
                            </Badge>
                            {item.riskLevel && (
                              <Badge variant="outline" size="sm">{item.riskLevel} risk</Badge>
                            )}
                            {item.severityLabel && (
                              <Badge variant="outline" size="sm">{item.severityLabel}</Badge>
                            )}
                          </div>
                          <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 mt-1 truncate">{item.title}</p>
                          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-neutral-500">
                            <span>{item.categoryLabel}</span>
                            {item.ward && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{item.ward}</span>}
                            <span>{item.timeLabel}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <div className={cn(
                            'text-sm font-bold px-2 py-0.5 rounded',
                            QUEUE_LEVEL_TONE[item.queueLevel] === 'red' ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
                            QUEUE_LEVEL_TONE[item.queueLevel] === 'amber' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' :
                            QUEUE_LEVEL_TONE[item.queueLevel] === 'emerald' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' :
                            'bg-teal-100 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400',
                          )}>
                            {item.queueScore}
                          </div>
                          {item.deadline && (
                            <span className="text-[10px] text-neutral-400">
                              {new Date(item.deadline) < new Date() ? '⚠ deadline passed' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Escalation Monitor */}
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle as="h2" className="text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> Escalation Monitor
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/department/escalations">View all</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading && !data ? (
                <LoadingBlock rows={3} />
              ) : !data || data.escalations.length === 0 ? (
                <EmptyState icon={AlertTriangle} title="No open escalations" description="Escalated reports will appear here when they need your attention." />
              ) : (
                <div className="space-y-2">
                  {data.escalations.map((esc) => (
                    <div
                      key={esc.id}
                      className="flex items-start justify-between gap-3 p-3 rounded-xl bg-amber-50/40 dark:bg-amber-900/10 border border-amber-200/60 dark:border-amber-800/40"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-teal-600 dark:text-teal-400">{esc.issuePublicId}</span>
                          <Badge variant="outline" size="sm">Level {esc.level}</Badge>
                          {esc.status === 'IN_PROGRESS' && <Badge variant="status" status="verificationPending" size="sm">In progress</Badge>}
                        </div>
                        <p className="text-sm text-neutral-800 dark:text-neutral-200 mt-1 truncate">{esc.issueTitle}</p>
                        {esc.reason && <p className="text-xs text-neutral-500 mt-0.5 truncate">&ldquo;{esc.reason}&rdquo;</p>}
                      </div>
                      <span className="text-[11px] text-neutral-400 flex-shrink-0">{esc.timeLabel}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Map + SLA + Notifications */}
        <div className="space-y-6">
          {/* Map */}
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle as="h2" className="text-sm flex items-center gap-2">
                <MapPin className="w-4 h-4 text-teal-600 dark:text-teal-400" /> Live Map
              </CardTitle>
              <span className="text-xs text-neutral-500">{data?.mappedCount ?? 0} located</span>
            </CardHeader>
            <CardContent className="p-0">
              <div className="aspect-[4/3]">
                <CommandCenterMap
                  markers={data?.map ?? []}
                  onSelect={openDrawer}
                  selectedId={selectedId}
                />
              </div>
            </CardContent>
          </Card>

          {/* SLA Legend */}
          <Card variant="outlined" padding="sm" className="bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border">
            <CardContent className="p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">SLA Status (map legend)</p>
              <div className="flex flex-wrap gap-2">
                <span className="flex items-center gap-1.5 text-xs text-neutral-700 dark:text-neutral-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> BREACHED
                </span>
                <span className="flex items-center gap-1.5 text-xs text-neutral-700 dark:text-neutral-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> AT RISK
                </span>
                <span className="flex items-center gap-1.5 text-xs text-neutral-700 dark:text-neutral-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> ON TRACK
                </span>
              </div>
            </CardContent>
          </Card>

          {/* SLA Performance */}
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardHeader>
              <CardTitle as="h2" className="text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-neutral-400" /> SLA Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">Promises honoured</span>
                  <span className="font-mono text-sm text-neutral-900 dark:text-white">{kpis?.promisesOnTime ?? '…'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">Promises broken</span>
                  <span className="font-mono text-sm text-red-600 dark:text-red-400">{kpis?.promisesBroken ?? '…'}</span>
                </div>
                <div className="h-px bg-neutral-200 dark:bg-dark-border" />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Performance</span>
                  <span className="font-mono text-lg font-bold text-teal-600 dark:text-teal-400">{formatPct(kpis?.slaPerformancePct ?? null)}</span>
                </div>
                <div className="h-2 rounded-full bg-neutral-100 dark:bg-dark-border overflow-hidden">
                  <div
                    className="h-full rounded-full bg-teal-500 transition-all duration-500"
                    style={{ width: `${kpis?.slaPerformancePct ?? 0}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <DepartmentNotifications />
        </div>
      </div>

      {/* Issue Drawer */}
      <IssueDrawer
        issueId={drawerId}
        endpoint={drawerId ? `/api/department/issues/${drawerId}` : null}
        onClose={() => {
          setDrawerId(null);
          setSelectedId(null);
        }}
        onChanged={() => {
          void mutate();
        }}
        canUpdateStatus
        canVerify
        canEscalate
      />
    </div>
  );
}

interface NotificationRow {
  id: string;
  title: string;
  message: string | null;
  read: boolean;
  issuePublicId: string | null;
  timeLabel: string;
}

function DepartmentNotifications() {
  const { data } = useSWR<{ notifications: NotificationRow[]; unreadCount: number }>(
    '/api/notifications',
    fetcher,
    { refreshInterval: REFRESH_INTERVAL },
  );
  const notifications = data?.notifications ?? [];
  const unread = data?.unreadCount ?? 0;

  return (
    <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle as="h2" className="text-sm flex items-center gap-2">
          <Bell className="w-4 h-4 text-neutral-400" /> Alerts
        </CardTitle>
        {unread > 0 && (
          <span className="min-w-5 h-5 px-1.5 rounded-full bg-teal-600 text-white text-xs font-semibold flex items-center justify-center">
            {unread}
          </span>
        )}
      </CardHeader>
      <CardContent>
        {notifications.length === 0 ? (
          <p className="text-sm text-neutral-500 py-4 text-center">No notifications yet.</p>
        ) : (
          <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
            {notifications.slice(0, 6).map((n) => (
              <div
                key={n.id}
                className={cn(
                  'p-2.5 rounded-lg border text-left',
                  n.read
                    ? 'border-neutral-200 dark:border-dark-border bg-neutral-50 dark:bg-dark-bg'
                    : 'border-teal-200 dark:border-teal-800/50 bg-teal-50/50 dark:bg-teal-900/10',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  {n.issuePublicId && (
                    <span className="font-mono text-[10px] font-bold text-teal-600 dark:text-teal-400">{n.issuePublicId}</span>
                  )}
                  <span className="text-[10px] text-neutral-400 flex-shrink-0">{n.timeLabel}</span>
                </div>
                <p className="text-xs font-medium text-neutral-800 dark:text-neutral-200 mt-0.5">{n.title}</p>
                {n.message && <p className="text-[11px] text-neutral-500 mt-0.5 line-clamp-2">{n.message}</p>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
