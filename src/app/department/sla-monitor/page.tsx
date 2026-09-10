'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  ListChecks,
  ShieldAlert,
  Target,
  Timer,
  Gauge,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingBlock } from '@/components/dashboard/LoadingBlock';
import { EmptyState } from '@/components/dashboard/EmptyState';
import { ErrorState } from '@/components/dashboard/ErrorState';
import { cn } from '@/lib/utils';
import {
  RESOLUTION_SLA_MINUTES,
  ACK_SLA_MINUTES,
  AT_RISK_PCT,
  type SeverityKey,
} from '@/lib/sla/policy';
import { ESCALATION_LEVEL_LABELS, ESCALATION_LEVELS } from '@/lib/escalation/levels';

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
});

const REFRESH_INTERVAL = 10_000;

interface Kpis {
  onTrack: number;
  atRisk: number;
  breached: number;
  noSla: number;
  promisesOnTime: number;
  promisesBroken: number;
  slaPerformancePct: number | null;
  escalationsOpen: number;
}

interface QueueItem {
  id: string;
  publicId: string;
  title: string;
  severity: string | null;
  severityLabel: string | null;
  slaState: string;
  deadline: string | null;
  createdAt: string;
  timeLabel: string;
  queueLevel: string;
  civicImpactScore: number | null;
  civicImpactLevel: string | null;
  ward: string | null;
}

interface Escalation {
  id: string;
  issuePublicId: string;
  issueTitle: string;
  level: number;
  status: string;
  reason: string | null;
  timeLabel: string;
}

interface CommandCenterData {
  kpis: Kpis;
  queue: QueueItem[];
  escalations: Escalation[];
}

const SEVERITY_ORDER: SeverityKey[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

export default function SlaMonitor() {
  const { data, error, isLoading, mutate } = useSWR<CommandCenterData>(
    '/api/department/command-center',
    fetcher,
    { refreshInterval: REFRESH_INTERVAL, revalidateOnFocus: true },
  );

  // Active SLA-tracked items, most urgent first (highest elapsed first).
  const slaQueue = useMemo(() => {
    const items = (data?.queue ?? []).filter((q) => q.deadline);
    return items.sort((a, b) => elapsedPct(b) - elapsedPct(a));
  }, [data]);

  const noSlaCount = useMemo(() => (data?.queue ?? []).filter((q) => !q.deadline).length, [data]);

  // Open escalations per ladder level (real data only).
  const ladder = useMemo(() => {
    return ESCALATION_LEVELS.map((level) => ({
      level,
      label: ESCALATION_LEVEL_LABELS[level],
      count: (data?.escalations ?? []).filter((e) => e.level === level).length,
    }));
  }, [data]);

  const kpis = data?.kpis;
  const atRiskPct = Math.round(AT_RISK_PCT * 100);

  return (
    <div className="space-y-6">
      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="w-1.5 h-4 rounded-full bg-teal-500" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-600 dark:text-teal-400">
              Department Operations · Step 6
            </span>
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white">
            SLA Monitor
          </h1>
          <p className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400 max-w-2xl">
            Every promise has a deadline. This screen shows how each open report is tracking against its SLA,
            and which reports are climbing the automated escalation ladder.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/department/command-center">Command Center</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/department/escalations">Escalations</Link>
          </Button>
        </div>
      </div>

      {error && <ErrorState onRetry={() => mutate()} />}

      {/* ── KPI ROW ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <SlaKpiCard
          label="On Track"
          value={kpis?.onTrack ?? '…'}
          loading={isLoading}
          icon={CheckCircle2}
          tone="emerald"
        />
        <SlaKpiCard
          label="At Risk"
          value={kpis?.atRisk ?? '…'}
          loading={isLoading}
          icon={Clock}
          tone="amber"
          sub={`≥ ${atRiskPct}% window used`}
        />
        <SlaKpiCard
          label="Breached"
          value={kpis?.breached ?? '…'}
          loading={isLoading}
          icon={AlertTriangle}
          tone="red"
          critical={Boolean(kpis?.breached)}
        />
        <SlaKpiCard
          label="No SLA yet"
          value={kpis?.noSla ?? '…'}
          loading={isLoading}
          icon={Timer}
          tone="neutral"
          sub="awaiting promise"
        />
        <SlaKpiCard
          label="SLA Performance"
          value={kpis?.slaPerformancePct != null ? `${kpis.slaPerformancePct}%` : '—'}
          loading={isLoading}
          icon={Target}
          tone="violet"
          sub="promises honoured"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ── LEFT (2 cols): SLA Policy + Progress + Ladder ─────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* SLA Policy — what we commit to, by severity */}
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle as="h2" className="text-sm flex items-center gap-2">
                <Target className="w-4 h-4 text-neutral-400" /> Resolution Policy
              </CardTitle>
              <Badge variant="outline" size="sm">AT-RISK at {atRiskPct}%</Badge>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-dark-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-neutral-50 dark:bg-dark-bg text-left text-[11px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                      <th className="px-3 py-2 font-semibold">Severity</th>
                      <th className="px-3 py-2 font-semibold">Acknowledge by</th>
                      <th className="px-3 py-2 font-semibold">Resolve by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SEVERITY_ORDER.map((sev) => (
                      <tr key={sev} className="border-t border-neutral-200 dark:border-dark-border">
                        <td className="px-3 py-2">
                          <span className={cn(
                            'inline-flex items-center gap-1.5 font-semibold',
                            sev === 'CRITICAL' ? 'text-red-600 dark:text-red-400' :
                            sev === 'HIGH' ? 'text-amber-600 dark:text-amber-400' :
                            sev === 'MEDIUM' ? 'text-brand-600 dark:text-brand-400' : 'text-emerald-600 dark:text-emerald-400',
                          )}>
                            <span className={cn(
                              'w-2 h-2 rounded-full',
                              sev === 'CRITICAL' ? 'bg-red-500' :
                              sev === 'HIGH' ? 'bg-amber-500' :
                              sev === 'MEDIUM' ? 'bg-brand-500' : 'bg-emerald-500',
                            )} />
                            {sev}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-neutral-700 dark:text-neutral-300">
                          {formatMinutes(ACK_SLA_MINUTES[sev])}
                        </td>
                        <td className="px-3 py-2 text-neutral-700 dark:text-neutral-300 font-medium">
                          {formatMinutes(RESOLUTION_SLA_MINUTES[sev])}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-neutral-400 dark:text-neutral-500">
                Deadlines are the policy CivicChain commits to when a promise is formed. Progress is computed from
                real promise deadlines — the moment one enters this window, its clock starts ticking.
              </p>
            </CardContent>
          </Card>

          {/* SLA Progress — per-issue bars with AT-RISK marker */}
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle as="h2" className="text-sm flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-neutral-400" /> Live SLA Progress
              </CardTitle>
              <span className="text-xs text-neutral-500">{slaQueue.length} tracked</span>
            </CardHeader>
            <CardContent>
              {isLoading && !data ? (
                <LoadingBlock rows={4} />
              ) : !data || slaQueue.length === 0 ? (
                <EmptyState
                  icon={ListChecks}
                  title="No SLA-tracked reports"
                  description="Open reports with an active resolution promise appear here, ordered by how much of their window is already gone."
                />
              ) : (
                <div className="space-y-3">
                  {slaQueue.map((item) => (
                    <SlaProgressRow key={item.id} item={item} />
                  ))}
                </div>
              )}
              {noSlaCount > 0 && (
                <p className="mt-3 text-[11px] text-neutral-400 dark:text-neutral-500">
                  {noSlaCount} active report{noSlaCount === 1 ? '' : 's'} with no resolution promise yet — not SLA-tracked.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Auto-escalation explainer */}
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardHeader>
              <CardTitle as="h2" className="text-sm flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-500" /> Auto-Escalation Engine
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                Escalation runs automatically on every status change and promise action — it never waits for a human.
                The ladder climbs one level per fired rule: a report that reaches{' '}
                <span className="font-medium">{atRiskPct}%+</span> of its SLA window without a promise is raised to a
                Department Officer; a breached deadline moves it to the Department Head; continued high-severity breach
                escalates to the Municipal Authority and then Admin. Each step is idempotent — re-evaluation can never
                send the same report up the ladder twice.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline" size="sm">evaluated on each action</Badge>
                <Badge variant="outline" size="sm">idempotent</Badge>
                <Badge variant="outline" size="sm">audit-logged</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── RIGHT (1 col): Escalation ladder mirror ───────────── */}
        <div className="space-y-6">
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle as="h2" className="text-sm flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-neutral-400" /> Escalation Ladder
              </CardTitle>
              <span className="text-xs text-neutral-500">{kpis?.escalationsOpen ?? '…'} open</span>
            </CardHeader>
            <CardContent>
              {isLoading && !data ? (
                <LoadingBlock rows={4} />
              ) : (
                <ol className="space-y-2.5">
                  {ladder.map((step) => (
                    <li
                      key={step.level}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-xl border',
                        step.count > 0
                          ? 'border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10'
                          : 'border-neutral-200 dark:border-dark-border bg-neutral-50 dark:bg-dark-bg',
                      )}
                    >
                      <span
                        className={cn(
                          'w-7 h-7 rounded-lg flex items-center justify-center font-display font-bold text-sm flex-none',
                          step.count > 0
                            ? 'bg-amber-600 text-white'
                            : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300',
                        )}
                      >
                        {step.level}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{step.label}</p>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                          {step.count === 0 ? 'no open escalation' : `${step.count} report${step.count === 1 ? '' : 's'} escalated here`}
                        </p>
                      </div>
                      {step.count > 0 && (
                        <span className="text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums">{step.count}</span>
                      )}
                    </li>
                  ))}
                </ol>
              )}

              {/* Which report is on which rung (real escalations) */}
              <div className="mt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">Currently escalated</p>
                {(data?.escalations ?? []).length === 0 ? (
                  <p className="text-sm text-neutral-500 py-2 text-center">None — every promise is on track or within reach.</p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {data!.escalations.map((esc) => (
                      <div key={esc.id} className="p-2.5 rounded-lg border border-amber-200/70 dark:border-amber-800/50 bg-amber-50/30 dark:bg-amber-900/5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[10px] font-bold text-teal-600 dark:text-teal-400">{esc.issuePublicId}</span>
                          <span className="text-[10px] text-neutral-400">{esc.timeLabel}</span>
                        </div>
                        <p className="text-xs text-neutral-700 dark:text-neutral-300 mt-0.5 truncate">{esc.issueTitle}</p>
                        <p className="text-[11px] text-neutral-500 mt-0.5">
                          Level {esc.level} · {ESCALATION_LEVEL_LABELS[esc.level as keyof typeof ESCALATION_LEVEL_LABELS] ?? `Level ${esc.level}`}
                        </p>
                        {esc.reason && <p className="text-[11px] text-neutral-500 italic truncate">{esc.reason}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Impact tie-in ribbon */}
          <Card variant="outlined" padding="sm" className="bg-teal-50/40 dark:bg-teal-900/10 border border-teal-200 dark:border-teal-800/60">
            <CardContent className="p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-400 mb-1.5 flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5" /> Order matters
              </p>
              <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">
                While SLA tracks <em>when</em>, Civic Impact scores <em>what matters</em>. An officer works the queue
                by impact — high civic impact + fast-declining SLA = act now.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function elapsedPct(item: QueueItem): number {
  const c = new Date(item.createdAt).getTime();
  const d = new Date(item.deadline ?? item.createdAt).getTime();
  if (!Number.isFinite(c) || !Number.isFinite(d) || d <= c) return 100;
  const total = d - c;
  const elapsed = Math.max(0, Math.min(total, Date.now() - c));
  return (elapsed / total) * 100;
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 60 * 24) return `${minutes / 60} hours`;
  return `${Math.round(minutes / (60 * 24))} days`;
}

function formatRemaining(deadline: string): string {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return 'breached';
  const totalMin = Math.floor(ms / 60000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d >= 1) return `${d}d ${h}h ${m}m`;
  if (h >= 1) return `${h}h ${m}m`;
  return `${m}m`;
}

const STATE_TONE: Record<string, { badge: string; bar: string }> = {
  ON_TRACK: {
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    bar: 'bg-emerald-500',
  },
  AT_RISK: {
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    bar: 'bg-amber-500',
  },
  BREACHED: {
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800',
    bar: 'bg-red-500',
  },
};

function SlaProgressRow({ item }: { item: QueueItem }) {
  const pct = Math.min(100, elapsedPct(item));
  const tone = STATE_TONE[item.slaState] ?? STATE_TONE.ON_TRACK;
  const atRiskMark = AT_RISK_PCT * 100;

  return (
    <div className="p-3 rounded-xl border border-neutral-200 dark:border-dark-border bg-neutral-50 dark:bg-dark-bg">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold text-teal-600 dark:text-teal-400">{item.publicId}</span>
            <span className={cn('text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border', tone.badge)}>
              {item.slaState.replace('_', ' ')}
            </span>
            {item.civicImpactScore != null && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-neutral-500 dark:text-neutral-400">
                <Gauge className="w-3 h-3" /> impact {item.civicImpactScore}
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 mt-1 truncate">{item.title}</p>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-neutral-500">
            <span>{item.severityLabel ?? 'No severity'}</span>
            {item.ward && <span>{item.ward}</span>}
            <span className="flex items-center gap-1 text-neutral-400">
              <Clock className="w-3 h-3" />
              {item.deadline ? `${formatRemaining(item.deadline)} left` : '—'}
            </span>
          </div>
        </div>
        <span className="font-mono text-lg font-bold text-neutral-900 dark:text-white tabular-nums flex-shrink-0">
          {Math.round(pct)}%
        </span>
      </div>

      {/* Progress bar with AT-RISK marker */}
      <div className="relative mt-2.5 h-2 rounded-full bg-neutral-200/70 dark:bg-dark-border overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-[width] duration-700', tone.bar)}
          style={{ width: `${pct}%` }}
        />
        {/* AT-RISK marker */}
        <span
          className="absolute top-[-2px] bottom-[-2px] w-[2px] bg-neutral-500/70 dark:bg-neutral-300/70"
          style={{ left: `${atRiskMark}%` }}
          title={`AT-RISK starts at ${atRiskMark}%`}
        />
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-neutral-400">
        <span>submitted</span>
        <span className="font-medium">AT-RISK {Math.round(atRiskMark)}%</span>
        <span>deadline</span>
      </div>
    </div>
  );
}

function SlaKpiCard({
  label,
  value,
  loading,
  icon: Icon,
  tone,
  sub,
  critical,
}: {
  label: string;
  value: string | number;
  loading: boolean;
  icon: typeof CheckCircle2;
  tone: 'emerald' | 'amber' | 'red' | 'violet' | 'neutral';
  sub?: string;
  critical?: boolean;
}) {
  const toneClasses: Record<string, string> = {
    emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
    amber: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    red: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    violet: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800',
    neutral: 'text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-dark-border',
  };
  return (
    <div className={cn(
      'rounded-xl border p-4 bg-white dark:bg-dark-bg-card',
      critical ? 'border-red-300 dark:border-red-800 ring-2 ring-red-200/50 dark:ring-red-900/30' : 'border-neutral-200 dark:border-dark-border',
    )}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">{label}</p>
        <span className={cn('w-7 h-7 rounded-lg border flex items-center justify-center', toneClasses[tone])}>
          <Icon className="w-4 h-4" />
        </span>
      </div>
      <p className="mt-2 font-display text-2xl font-bold text-neutral-900 dark:text-white tabular-nums">
        {loading && value === '…' ? <span className="animate-pulse text-neutral-300">…</span> : value}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-neutral-400">{sub}</p>}
    </div>
  );
}