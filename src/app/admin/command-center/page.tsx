'use client';

import useSWR from 'swr';
import Link from 'next/link';
import {
  Users,
  Building2,
  FileText,
  ShieldAlert,
  Clock,
  CheckCircle2,
  Zap,
  Activity,
  Target,
  AlertTriangle,
  ArrowUpRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { StatCard } from '@/components/dashboard/StatCard';
import { LoadingBlock } from '@/components/dashboard/LoadingBlock';
import { EmptyState } from '@/components/dashboard/EmptyState';
import { ErrorState } from '@/components/dashboard/ErrorState';

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return res.json();
  });

const REFRESH_INTERVAL = 30_000;

interface AdminKpis {
  citizens: number;
  authorities: number;
  departments: number;
  issues: { total: number; active: number; resolved: number; critical: number };
  incidents: number;
  escalations: { total: number; open: number };
  verifications: { total: number; pending: number };
  evidence: { total: number; pending: number };
}

interface AdminSlaControl {
  onTrack: number;
  atRisk: number;
  breached: number;
  total: number;
  onTimePct: number | null;
}

interface AdminEscalationItem {
  id: string;
  issuePublicId: string | null;
  level: number;
  levelLabel: string;
  status: string;
  issuer: string | null;
  authority: string | null;
  ageHours: number;
  createdAt: string;
}

interface AdminRiskOverview {
  totalWards: number;
  low: number;
  medium: number;
  high: number;
  critical: number;
  topWards: Array<{
    wardId: string;
    wardName: string;
    riskScore: number;
    riskLevel: string;
    activeIncidents: number;
    slaBreaches: number;
  }>;
}

interface AdminAiHealth {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  avgConfidence: number | null;
  models: Array<{ modelName: string; count: number }>;
}

interface AdminActionCenter {
  criticalSlaBreaches: number;
  openEscalations: number;
  highRiskWards: number;
  criticalRiskWards: number;
  pendingVerifications: number;
  failedAi: number;
}

interface AdminCommandCenterData {
  kpis: AdminKpis;
  sla: AdminSlaControl;
  escalations: {
    open: AdminEscalationItem[];
    counts: { open: number; critical: number; unresolved: number };
  };
  risk: AdminRiskOverview;
  ai: AdminAiHealth;
  actions: AdminActionCenter;
  generatedAt: string;
}

const RISK_TONE: Record<string, 'red' | 'amber' | 'emerald' | 'brand' | 'violet' | 'neutral'> = {
  CRITICAL: 'red',
  HIGH: 'amber',
  MEDIUM: 'brand',
  LOW: 'emerald',
};

function formatPct(value: number | null): string {
  return value != null ? `${value}%` : '—';
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.round(diffMs / (1000 * 60 * 60));
  if (hours < 1) return '<1h';
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function miniBar(label: string, count: number, total: number, tone: string) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const color = tone === 'red' ? 'bg-red-500' : tone === 'amber' ? 'bg-amber-500' : tone === 'emerald' ? 'bg-emerald-500' : 'bg-brand-500';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-neutral-500">{label}</span>
        <span className="font-mono text-neutral-800 dark:text-neutral-200">{count}</span>
      </div>
      <div className="h-1.5 rounded-full bg-neutral-100 dark:bg-dark-border overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function AdminCommandCenter() {
  const { data, error, isLoading, mutate } = useSWR<AdminCommandCenterData>(
    '/api/admin/command-center',
    fetcher,
    { refreshInterval: REFRESH_INTERVAL },
  );

  const k = data?.kpis;

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        kicker="Admin workspace"
        title="Command Center"
        description="System-wide operational console — every figure is computed live from real platform data."
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/health">System Health</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => mutate()}>Refresh</Button>
        </div>
      </PageHeader>

      {/* ── Global KPIs ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4 mb-8">
        <StatCard label="Citizens" value={k?.citizens ?? '…'} loading={isLoading} icon={Users} tone="brand" />
        <StatCard label="Authorities" value={k?.authorities ?? '…'} loading={isLoading} icon={Building2} tone="violet" />
        <StatCard label="Departments" value={k?.departments ?? '…'} loading={isLoading} icon={Building2} tone="cyan" />
        <StatCard label="Active Issues" value={k?.issues.active ?? '…'} loading={isLoading} icon={FileText} tone="brand"
          sub={k ? `${k.issues.total} total` : undefined} />
        <StatCard label="Critical Issues" value={k?.issues.critical ?? '…'} loading={isLoading} icon={AlertTriangle} tone="red" />
        <StatCard label="Incidents" value={k?.incidents ?? '…'} loading={isLoading} icon={Zap} tone="amber" />
        <StatCard label="Open Escalations" value={k?.escalations.open ?? '…'} loading={isLoading} icon={ArrowUpRight} tone="red" />
        <StatCard label="Verifications" value={k?.verifications.pending ?? '…'} loading={isLoading} icon={ShieldAlert} tone="emerald"
          sub={k ? `${k.verifications.total} total` : undefined} />
      </div>

      {error && <ErrorState onRetry={() => mutate()} />}
      {isLoading && !data && <LoadingBlock rows={6} />}

      {data && (
        <>
          <div className="flex items-center justify-end mb-6 text-xs text-neutral-400 font-mono">
            updated {timeAgo(data.generatedAt)} ago
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* ── Left: SLA + Escalation control ──────────────── */}
            <div className="lg:col-span-2 space-y-6">
              {/* SLA control center */}
              <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle as="h2" className="text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4 text-neutral-400" /> SLA Control Center
                  </CardTitle>
                  <Badge variant="status" status={data.sla.breached > 0 ? 'brokenPromise' : 'resolved'} size="sm">
                    {formatPct(data.sla.onTimePct)}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 mb-5">
                    <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-900/10 border border-emerald-200/60 dark:border-emerald-800/40 text-center">
                      <p className="text-2xl font-display font-bold text-emerald-600 dark:text-emerald-400">{data.sla.onTrack}</p>
                      <p className="text-[11px] text-neutral-500 mt-0.5">On track</p>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200/60 dark:border-amber-800/40 text-center">
                      <p className="text-2xl font-display font-bold text-amber-600 dark:text-amber-400">{data.sla.atRisk}</p>
                      <p className="text-[11px] text-neutral-500 mt-0.5">At risk</p>
                    </div>
                    <div className="p-3 rounded-xl bg-red-50/60 dark:bg-red-900/10 border border-red-200/60 dark:border-red-800/40 text-center">
                      <p className="text-2xl font-display font-bold text-red-600 dark:text-red-400">{data.sla.breached}</p>
                      <p className="text-[11px] text-neutral-500 mt-0.5">Breached</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {miniBar('On time', data.sla.onTrack, data.sla.total, 'emerald')}
                    {miniBar('At risk', data.sla.atRisk, data.sla.total, 'amber')}
                    {miniBar('Breached', data.sla.breached, data.sla.total, 'red')}
                  </div>
                  <p className="text-xs text-neutral-400 mt-4">
                    Evaluated against active promises across all departments using the shared SLA engine.
                  </p>
                </CardContent>
              </Card>

              {/* Escalation control center */}
              <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle as="h2" className="text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" /> Escalation Control Center
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {data.escalations.counts.critical > 0 && (
                      <Badge variant="status" status="brokenPromise" size="sm">{data.escalations.counts.critical} critical</Badge>
                    )}
                    <Button variant="ghost" size="sm" asChild>
                      <Link href="/department/escalations">View all</Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {data.escalations.open.length === 0 ? (
                    <EmptyState icon={AlertTriangle} title="No open escalations" description="Escalated reports will appear here across the whole platform." />
                  ) : (
                    <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                      {data.escalations.open.map((e) => (
                        <div
                          key={e.id}
                          className="flex items-start justify-between gap-3 p-3 rounded-xl border bg-neutral-50 dark:bg-dark-bg border-neutral-200 dark:border-dark-border"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              {e.issuePublicId && (
                                <span className="font-mono text-xs font-bold text-brand-600 dark:text-brand-400">{e.issuePublicId}</span>
                              )}
                              <Badge variant="outline" size="sm">{e.levelLabel}</Badge>
                              {e.status === 'IN_PROGRESS' && <Badge variant="status" status="active" size="sm">In progress</Badge>}
                            </div>
                            <p className="text-[11px] text-neutral-500 mt-1">
                              {e.issuer ?? 'System'} → {e.authority ?? 'unassigned'}
                            </p>
                          </div>
                          <span className="text-[11px] text-neutral-400 flex-shrink-0">{e.ageHours}h</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ── Right: Risk + AI + Actions ───────────────────── */}
            <div className="space-y-6">
              {/* Risk overview */}
              <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle as="h2" className="text-sm flex items-center gap-2">
                    <Target className="w-4 h-4 text-neutral-400" /> Risk Overview
                  </CardTitle>
                  <Badge variant="status" status={data.risk.critical > 0 ? 'brokenPromise' : 'resolved'} size="sm">
                    {data.risk.totalWards} wards
                  </Badge>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {([
                      ['LOW', data.risk.low, 'emerald'],
                      ['MEDIUM', data.risk.medium, 'amber'],
                      ['HIGH', data.risk.high, 'red'],
                      ['CRITICAL', data.risk.critical, 'red'],
                    ] as const).map(([level, count, tone]) => (
                      <div key={level} className="p-2.5 rounded-lg bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border">
                        <p className={`text-lg font-display font-bold ${tone === 'red' ? 'text-red-600 dark:text-red-400' : tone === 'amber' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{count}</p>
                        <p className="text-[10px] text-neutral-500">{level}</p>
                      </div>
                    ))}
                  </div>
                  {data.risk.topWards.length > 0 ? (
                    <div className="space-y-2">
                      {data.risk.topWards.map((w) => (
                        <div key={w.wardId} className="flex items-center justify-between gap-2">
                          <span className="text-xs text-neutral-600 dark:text-neutral-300 truncate">{w.wardName}</span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge variant="outline" size="sm">{w.riskScore}</Badge>
                            <Badge variant="status" status={RISK_TONE[w.riskLevel] === 'red' ? 'brokenPromise' : 'resolved'} size="sm">{w.riskLevel}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-500 py-4 text-center">No risk data.</p>
                  )}
                </CardContent>
              </Card>

              {/* AI health */}
              <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
                <CardHeader>
                  <CardTitle as="h2" className="text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4 text-neutral-400" /> AI Classification
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border text-center">
                      <p className="text-lg font-display font-bold text-neutral-900 dark:text-white">{data.ai.total}</p>
                      <p className="text-[10px] text-neutral-500">Total</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border text-center">
                      <p className="text-lg font-display font-bold text-emerald-600 dark:text-emerald-400">{data.ai.completed}</p>
                      <p className="text-[10px] text-neutral-500">Completed</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border text-center">
                      <p className="text-lg font-display font-bold text-red-600 dark:text-red-400">{data.ai.failed}</p>
                      <p className="text-[10px] text-neutral-500">Failed</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm mb-4">
                    <span className="text-neutral-500">Avg confidence</span>
                    <span className="font-mono font-bold text-brand-600 dark:text-brand-400">{formatPct(data.ai.avgConfidence)}</span>
                  </div>
                  {data.ai.models.length > 0 && (
                    <div className="space-y-1">
                      {data.ai.models.slice(0, 4).map((m) => (
                        <div key={m.modelName} className="flex items-center justify-between text-xs">
                          <span className="text-neutral-500 font-mono truncate">{m.modelName}</span>
                          <span className="font-mono text-neutral-800 dark:text-neutral-200 ml-2">{m.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Action center */}
              <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
                <CardHeader>
                  <CardTitle as="h2" className="text-sm flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" /> Action Center
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <ActionRow label="Critical SLA breaches" value={data.actions.criticalSlaBreaches} tone={data.actions.criticalSlaBreaches > 0 ? 'red' : 'ok'} />
                    <ActionRow label="Open escalations" value={data.actions.openEscalations} tone={data.actions.openEscalations > 0 ? 'amber' : 'ok'} />
                    <ActionRow label="Critical risk wards" value={data.actions.criticalRiskWards} tone={data.actions.criticalRiskWards > 0 ? 'red' : 'ok'} />
                    <ActionRow label="Pending verifications" value={data.actions.pendingVerifications} tone={data.actions.pendingVerifications > 0 ? 'amber' : 'ok'} />
                    <ActionRow label="Failed AI runs" value={data.actions.failedAi} tone={data.actions.failedAi > 0 ? 'amber' : 'ok'} />
                  </div>
                  <div className="flex items-center gap-2 mt-4 text-xs text-neutral-400">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Auto-refreshes every 30s
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ActionRow({ label, value, tone }: { label: string; value: number; tone: 'red' | 'amber' | 'ok' }) {
  const color = tone === 'red' ? 'text-red-600 dark:text-red-400' : tone === 'amber' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-neutral-600 dark:text-neutral-300">{label}</span>
      <span className={`font-mono font-bold ${color}`}>{value}</span>
    </div>
  );
}
