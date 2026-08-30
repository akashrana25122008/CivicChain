'use client';

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
  const { data, error, isLoading, mutate } = useSWR<AnalyticsData>(
    '/api/admin/analytics',
    fetcher,
    { refreshInterval: 60000 },
  );

  const t = data?.totals;

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
    </div>
  );
}