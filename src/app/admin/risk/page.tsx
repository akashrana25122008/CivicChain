'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { RiskLadder } from '@/components/dashboard/RiskLadder';
import { Button } from '@/components/ui/Button';
import { RefreshCw, BarChart3, AlertTriangle, TrendingUp, ShieldAlert } from 'lucide-react';
import useSWR from 'swr';
import { cn } from '@/lib/utils';
import type { RiskLevel } from '@/lib/risk/scoring';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface WardRisk {
  wardId: string;
  wardName: string;
  latitude: number;
  longitude: number;
  riskScore: number;
  riskLevel: RiskLevel;
  activeIncidents: number;
  criticalIssues: number;
  slaBreaches: number;
  topCategory: string;
}

interface RiskSummary {
  totalAreas: number;
  averageRiskScore: number;
  criticalRiskAreas: number;
  highRiskAreas: number;
  mediumRiskAreas: number;
  lowRiskAreas: number;
  totalActiveIssues: number;
  totalSlaBreaches: number;
}

const LEVEL_COLORS: Record<RiskLevel, string> = {
  CRITICAL: 'text-red-600 dark:text-red-400',
  HIGH: 'text-orange-600 dark:text-orange-400',
  MEDIUM: 'text-amber-600 dark:text-amber-400',
  LOW: 'text-emerald-600 dark:text-emerald-400',
};

export default function AdminRiskPage() {
  const [days, setDays] = useState(30);

  const { data: summary, isLoading: summaryLoading, error: summaryError, mutate: mutateSummary } = useSWR<RiskSummary>(
    `/api/risk/summary?days=${days}`,
    fetcher,
    { refreshInterval: 60_000 },
  );

  const { data: wardsData, isLoading: wardsLoading, error: wardsError, mutate: mutateWards } = useSWR<{ wards: WardRisk[] }>(
    `/api/risk/wards?days=${days}&limit=50`,
    fetcher,
    { refreshInterval: 60_000 },
  );

  const wards = wardsData?.wards ?? [];
  const loading = summaryLoading || wardsLoading;
  const error = summaryError || wardsError;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Admin workspace"
        title="Risk Intelligence"
        description="2D risk visualization of geographic risk distribution across all areas."
      >
        <div className="flex items-center gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                days === d
                  ? 'bg-brand-700 text-white border-brand-700 dark:bg-brand-600 dark:border-brand-600'
                  : 'bg-white dark:bg-dark-bg-card text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-dark-border hover:border-brand-300',
              )}
            >
              {d}d
            </button>
          ))}
          <Button variant="outline" size="sm" onClick={() => { mutateSummary(); mutateWards(); }}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        </div>
      </PageHeader>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-300">Risk data temporarily unavailable. Please try again.</p>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">Avg Risk</span>
                <ShieldAlert className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              </div>
              <p className="text-2xl font-display font-bold text-neutral-900 dark:text-white">{summary.averageRiskScore}</p>
            </CardContent>
          </Card>
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">Critical</span>
                <AlertTriangle className="w-4 h-4 text-red-500" />
              </div>
              <p className="text-2xl font-display font-bold text-red-600 dark:text-red-400">{summary.criticalRiskAreas}</p>
            </CardContent>
          </Card>
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">Active Issues</span>
                <TrendingUp className="w-4 h-4 text-orange-500" />
              </div>
              <p className="text-2xl font-display font-bold text-neutral-900 dark:text-white">{summary.totalActiveIssues}</p>
            </CardContent>
          </Card>
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">SLA Breaches</span>
                <AlertTriangle className="w-4 h-4 text-red-500" />
              </div>
              <p className="text-2xl font-display font-bold text-red-600 dark:text-red-400">{summary.totalSlaBreaches}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 2D Risk Ladder */}
      <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
        <CardHeader>
          <CardTitle as="h2" className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-violet-500" />
            Risk Ranking
          </CardTitle>
          <CardDescription>Bar length = risk score, color = severity level. Ranked highest first.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[400px] md:h-[500px]">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="h-6 w-32 rounded bg-neutral-100 dark:bg-dark-border animate-pulse" />
              </div>
            ) : wards.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-neutral-400 dark:text-neutral-500">No risk areas to visualize</p>
              </div>
            ) : (
              <RiskLadder
                areas={wards.map((w) => ({
                  id: w.wardId,
                  name: w.wardName,
                  riskScore: w.riskScore,
                  riskLevel: w.riskLevel,
                  activeIncidents: w.activeIncidents,
                  slaBreaches: w.slaBreaches,
                }))}
                className="w-full h-full"
                maxRows={12}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Risk Distribution Table */}
      {wards.length > 0 && (
        <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
          <CardHeader>
            <CardTitle as="h2" className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Area Risk Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-dark-border">
                    <th className="py-2 pr-4 font-semibold">Area</th>
                    <th className="py-2 pr-4 font-semibold">Score</th>
                    <th className="py-2 pr-4 font-semibold">Level</th>
                    <th className="py-2 pr-4 font-semibold">Active</th>
                    <th className="py-2 pr-4 font-semibold">SLA</th>
                    <th className="py-2 font-semibold">Top Category</th>
                  </tr>
                </thead>
                <tbody>
                  {wards.slice(0, 20).map((w) => (
                    <tr key={w.wardId} className="border-b border-neutral-100 dark:border-dark-border">
                      <td className="py-2.5 pr-4 font-medium text-neutral-900 dark:text-white">{w.wardName}</td>
                      <td className="py-2.5 pr-4 font-mono font-semibold text-neutral-900 dark:text-white">{w.riskScore}</td>
                      <td className="py-2.5 pr-4">
                        <span className={cn('text-xs font-bold font-mono', LEVEL_COLORS[w.riskLevel])}>{w.riskLevel}</span>
                      </td>
                      <td className="py-2.5 pr-4 font-mono">{w.activeIncidents}</td>
                      <td className="py-2.5 pr-4 font-mono">{w.slaBreaches}</td>
                      <td className="py-2.5 text-neutral-700 dark:text-neutral-300">{w.topCategory.replace(/_/g, ' ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
