'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { StatCard } from '@/components/dashboard/StatCard';
import { LoadingBlock } from '@/components/dashboard/LoadingBlock';
import { ErrorState } from '@/components/dashboard/ErrorState';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  Copy,
  Gauge,
  Layers,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react';
import type { AnalyticsPayload } from '@/lib/server/analytics/types';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface AnalyticsData {
  issuesByCategory: Array<{ category: string; label: string; count: number }>;
  issuesByStatus: Array<{ status: string; label: string; count: number }>;
  issuesByDepartment: Array<{ authorityId: string | null; label: string; count: number }>;
  usersByRole: Array<{ role: string; count: number }>;
  overTime: Array<{ day: string; created: number }>;
  totals: {
    issues: number;
    activeIssues: number;
    resolved: number;
    resolutionRate: number | null;
    avgResolutionMinutes: number | null;
    reportsToday: number;
    reportsThisWeek: number;
  };
}

const PALETTE = ['#2563eb', '#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const ROLE_COLORS: Record<string, string> = { CITIZEN: '#2563eb', AUTHORITY: '#f59e0b', ADMIN: '#ef4444' };
const RANGES = ['7d', '30d', '90d', 'all'] as const;
type Range = (typeof RANGES)[number];

const ANOMALY_COLOR: Record<string, string> = {
  LOW: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
  MEDIUM: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
  HIGH: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300',
};
const TONE_COLOR: Record<string, string> = {
  positive: 'text-emerald-600 dark:text-emerald-400',
  negative: 'text-red-600 dark:text-red-400',
  neutral: 'text-neutral-600 dark:text-neutral-400',
};

function shortDay(day: string): string {
  const [, m, d] = day.split('-');
  return `${Number(m)}/${Number(d)}`;
}

function formatMinutes(minutes: number | null): string {
  if (minutes === null) return '—';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function AdminAnalytics() {
  const [range, setRange] = useState<Range>('30d');
  const { data, error, isLoading, mutate } = useSWR<AnalyticsData>(
    '/api/admin/analytics',
    fetcher,
    { refreshInterval: 60000 },
  );
  const engine = useSWR<AnalyticsPayload>(
    `/api/admin/analytics/engine?range=${range}`,
    fetcher,
    { refreshInterval: 60000 },
  );

  const t = data?.totals;
  const e = engine.data;

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        kicker="Admin workspace"
        title="Analytics"
        description="Cross-platform aggregate reporting computed from live database data."
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard label="Total Issues" value={t?.issues ?? '…'} loading={!t} tone="brand" />
        <StatCard label="Active" value={t?.activeIssues ?? '…'} loading={!t} tone="amber" />
        <StatCard label="Resolved" value={t?.resolved ?? '…'} loading={!t} tone="emerald" />
        <StatCard label="Resolution Rate" value={t?.resolutionRate != null ? `${t.resolutionRate}%` : '—'} loading={!t} tone="violet"
          sub={t?.resolutionRate == null ? 'nothing resolved yet' : undefined} />
        <StatCard label="Avg Resolution" value={t ? formatMinutes(t.avgResolutionMinutes) : '…'} loading={!t} tone="cyan"
          sub={t?.avgResolutionMinutes === null ? 'no resolved reports yet' : undefined} />
        <StatCard label="Reports Today" value={t?.reportsToday ?? '…'} loading={!t} tone="red"
          sub={t ? `${t.reportsThisWeek} this week` : undefined} />
      </div>

      {error && <ErrorState onRetry={() => mutate()} />}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
          <CardHeader>
            <CardTitle as="h2" className="text-lg">Issues by Status</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && !data ? <LoadingBlock rows={4} /> : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data?.issuesByStatus ?? []} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: 'currentColor', opacity: 0.05 }} />
                  <Bar dataKey="count" name="Issues" radius={[6, 6, 0, 0]}>
                    {data?.issuesByStatus.map((row, i) => (
                      <Cell key={row.status} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
          <CardHeader>
            <CardTitle as="h2" className="text-lg">Issues by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && !data ? <LoadingBlock rows={4} /> : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data?.issuesByCategory ?? []} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: 'currentColor', opacity: 0.05 }} />
                  <Bar dataKey="count" name="Issues" fill="#2563eb" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
          <CardHeader>
            <CardTitle as="h2" className="text-lg">Reports · Last 30 Days</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && !data ? <LoadingBlock rows={4} /> : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data?.overTime.map((p) => ({ ...p, label: shortDay(p.day) })) ?? []} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={4} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: 'currentColor', opacity: 0.05 }} labelFormatter={(v) => `Day ${v}`} />
                  <Bar dataKey="created" name="Created" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
          <CardHeader>
            <CardTitle as="h2" className="text-lg">Users by Role</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && !data ? <LoadingBlock rows={4} /> : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={data?.usersByRole.map((r) => ({ name: r.role, value: r.count })) ?? []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                  >
                    {(data?.usersByRole ?? []).map((r) => (
                      <Cell key={r.role} fill={ROLE_COLORS[r.role] ?? '#6b7280'} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend formatter={(value) => <span className="text-xs text-neutral-600 dark:text-neutral-400">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border mt-6">
        <CardHeader>
          <CardTitle as="h2" className="text-lg">Issues by Department</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && !data ? <LoadingBlock rows={4} /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data?.issuesByDepartment ?? []} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="label" width={160} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: 'currentColor', opacity: 0.05 }} />
                <Bar dataKey="count" name="Issues" fill="#06b6d4" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Phase 19 — Analytics Engine                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center justify-between mt-10 mb-4">
        <h2 className="text-xl font-display font-bold text-neutral-900 dark:text-white flex items-center gap-2">
          <Gauge className="w-5 h-5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
          Analytics Engine
        </h2>
        <div className="flex items-center gap-1 rounded-lg border border-neutral-200 dark:border-dark-border p-1 bg-white dark:bg-dark-bg-card">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                range === r
                  ? 'bg-brand-600 text-white'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-white'
              }`}
            >
              {r === 'all' ? 'All' : r}
            </button>
          ))}
        </div>
      </div>

      {e && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            <StatCard label="Duplicate Coverage" value={e?.duplicate.duplicateCoveragePct != null ? `${e.duplicate.duplicateCoveragePct}%` : '—'} loading={!e} tone="brand" icon={Copy}
              sub={e?.duplicate.duplicateMarkedReports != null ? `${e.duplicate.duplicateMarkedReports} linked reports` : undefined} />
            <StatCard label="Verification Rate" value={e?.verification.verificationRatePct != null ? `${e.verification.verificationRatePct}%` : '—'} loading={!e} tone="emerald" icon={ShieldCheck}
              sub={e ? `${e.verification.verified} verified / ${e.verification.pending} pending` : undefined} />
            <StatCard label="SLA Breach Rate" value={e?.sla.breachRatePct != null ? `${e.sla.breachRatePct}%` : '—'} loading={!e} tone="red" icon={AlertTriangle}
              sub={e ? `${e.sla.breached} breached of ${e.sla.activePromises} promises` : undefined} />
            <StatCard label="Avg Resolution" value={e?.resolution.avgResolutionMinutes != null ? formatMinutes(e.resolution.avgResolutionMinutes) : '—'} loading={!e} tone="cyan" icon={Activity}
              sub={e ? `${e.resolution.resolvedCount} resolved` : undefined} />
            <StatCard label="Ward Risk (avg)" value={e?.wardRisk.avgScore ?? '—'} loading={!e} tone="violet" icon={Layers}
              sub={e ? `${e.wardRisk.highRiskAreas + e.wardRisk.criticalRiskAreas} high/critical areas` : undefined} />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
              <CardHeader>
                <CardTitle as="h2" className="text-lg flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                  Insights
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {e.insights.length === 0 ? (
                  <p className="text-sm text-neutral-500">No insights available for this window.</p>
                ) : (
                  e.insights.map((ins) => (
                    <div key={ins.id} className="rounded-lg border border-neutral-200 dark:border-dark-border p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-neutral-900 dark:text-white">{ins.title}</p>
                        <span className={`text-xs font-medium ${TONE_COLOR[ins.tone]}`}>{ins.category}</span>
                      </div>
                      <p className="text-xs text-neutral-500 mt-1">{ins.detail}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
              <CardHeader>
                <CardTitle as="h2" className="text-lg flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 dark:text-red-400" aria-hidden="true" />
                  Anomalies
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {e.anomalies.length === 0 ? (
                  <p className="text-sm text-neutral-500">No anomalies detected in this window.</p>
                ) : (
                  e.anomalies.map((a) => (
                    <div key={a.key} className="rounded-lg border border-neutral-200 dark:border-dark-border p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-neutral-900 dark:text-white">{a.label}</p>
                        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${ANOMALY_COLOR[a.severity]}`}>{a.severity}</span>
                      </div>
                      <p className="text-xs text-neutral-500 mt-1">{a.detail}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-6 mt-6">
            <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
              <CardHeader>
                <CardTitle as="h2" className="text-lg">Department Performance</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200 dark:border-dark-border">
                      <th className="py-2 pr-3 font-medium">Department</th>
                      <th className="py-2 pr-3 font-medium">Issues</th>
                      <th className="py-2 pr-3 font-medium">Resolved</th>
                      <th className="py-2 pr-3 font-medium">Rate</th>
                      <th className="py-2 pr-3 font-medium">Avg Time</th>
                      <th className="py-2 font-medium">Breached</th>
                    </tr>
                  </thead>
                  <tbody>
                    {e.department.rank.length === 0 && (
                      <tr><td colSpan={6} className="py-3 text-xs text-neutral-500">No department activity in this window.</td></tr>
                    )}
                    {e.department.rank.map((d) => (
                      <tr key={d.authorityId ?? 'unassigned'} className="border-b border-neutral-100 dark:border-dark-border/50">
                        <td className="py-2 pr-3 font-medium text-neutral-900 dark:text-white">{d.label}</td>
                        <td className="py-2 pr-3 text-neutral-500">{d.issueCount}</td>
                        <td className="py-2 pr-3 text-neutral-500">{d.resolvedCount}</td>
                        <td className="py-2 pr-3 text-neutral-600 dark:text-neutral-300">{d.resolutionRatePct != null ? `${d.resolutionRatePct}%` : '—'}</td>
                        <td className="py-2 pr-3 text-neutral-500">{formatMinutes(d.avgResolutionMinutes)}</td>
                        <td className="py-2 text-red-600 dark:text-red-400 font-medium">{d.breached}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
              <CardHeader>
                <CardTitle as="h2" className="text-lg">Ward Risk — Top Areas</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200 dark:border-dark-border">
                      <th className="py-2 pr-3 font-medium">Area</th>
                      <th className="py-2 pr-3 font-medium">Risk Level</th>
                      <th className="py-2 pr-3 font-medium">Score</th>
                      <th className="py-2 font-medium">Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {e.wardRisk.topAreas.length === 0 && (
                      <tr><td colSpan={4} className="py-3 text-xs text-neutral-500">No high-risk areas in this window.</td></tr>
                    )}
                    {e.wardRisk.topAreas.map((a) => (
                      <tr key={a.areaName} className="border-b border-neutral-100 dark:border-dark-border/50">
                        <td className="py-2 pr-3 font-medium text-neutral-900 dark:text-white">{a.areaName}</td>
                        <td className="py-2 pr-3">
                          <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                            a.riskLevel === 'CRITICAL' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                            a.riskLevel === 'HIGH' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
                            'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                          }`}>{a.riskLevel}</span>
                        </td>
                        <td className="py-2 pr-3 text-neutral-600 dark:text-neutral-300">{a.riskScore}</td>
                        <td className="py-2 text-neutral-500">{a.activeIncidents}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-6">
            <StatCard label="AI Accuracy" value={e?.ai.categoryAccuracyPct != null ? `${e.ai.categoryAccuracyPct}%` : '—'} loading={!e} tone="violet" icon={Bot}
              sub={e ? `${e.ai.completed} completed analyses` : undefined} />
            <StatCard label="SLA On Track" value={e?.sla.onTrack ?? '…'} loading={!e} tone="emerald" icon={Gauge}
              sub={e ? `${e.sla.atRisk} at risk` : undefined} />
            <StatCard label="Community Votes" value={e?.satisfaction.totalVotes ?? '…'} loading={!e} tone="brand" icon={Users}
              sub={e?.satisfaction.netSatisfactionPct != null ? `${e.satisfaction.netSatisfactionPct}% positive` : undefined} />
            <StatCard label="Escalations" value={e?.escalation.total ?? '…'} loading={!e} tone="amber" icon={ArrowUpRight}
              sub={e ? `${e.escalation.active} active` : undefined} />
            <StatCard label="Reopen Rate" value={e?.resolution.reopenRatePct != null ? `${e.resolution.reopenRatePct}%` : '—'} loading={!e} tone="red" icon={ArrowDownRight}
              sub={e ? `${e.resolution.reopenCount} reopened` : undefined} />
          </div>
        </>
      )}

      {engine.error && <ErrorState onRetry={() => engine.mutate()} />}
    </div>
  );
}
