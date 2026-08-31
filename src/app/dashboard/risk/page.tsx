'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Activity, AlertTriangle, Radar, ShieldAlert, TrendingDown, TrendingUp, Minus,
  MapPin, Repeat2, Clock, CheckCircle2, ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { RiskHeatmap } from '@/components/dashboard/RiskHeatmap';
import { useRiskSummary, useWardRisks, useRiskHotspots } from '@/components/dashboard/riskHooks';
import type { WardRiskSummary } from '@/lib/risk/types';
import type { RiskLevel } from '@/lib/risk/scoring';

const LEVEL_STYLES: Record<RiskLevel, { text: string; badge: string; bar: string }> = {
  CRITICAL: {
    text: 'text-red-600 dark:text-red-400',
    badge: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
    bar: 'bg-red-500',
  },
  HIGH: {
    text: 'text-orange-600 dark:text-orange-400',
    badge: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800',
    bar: 'bg-orange-500',
  },
  MEDIUM: {
    text: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
    bar: 'bg-amber-500',
  },
  LOW: {
    text: 'text-emerald-600 dark:text-emerald-400',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
    bar: 'bg-emerald-500',
  },
};

function TrendIndicator({ direction, percentage }: { direction: string; percentage: number }) {
  if (direction === 'INCREASING') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
        <TrendingUp className="w-3.5 h-3.5" /> +{Math.abs(percentage)}%
      </span>
    );
  }
  if (direction === 'DECREASING') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        <TrendingDown className="w-3.5 h-3.5" /> {Math.abs(percentage)}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
      <Minus className="w-3.5 h-3.5" /> Stable
    </span>
  );
}

function formatResolutionHours(hours: number | null): string {
  if (hours == null) return '—';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function RiskBar({ score, level }: { score: number; level: RiskLevel }) {
  return (
    <div className="w-16">
      <div className="h-1.5 w-full rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
        <div
          className={cn('h-full rounded-full', LEVEL_STYLES[level].bar)}
          style={{ width: `${Math.min(100, score)}%` }}
        />
      </div>
    </div>
  );
}

function LoadingBlock() {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="h-28 rounded-xl bg-neutral-100 dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border" />
      ))}
    </div>
  );
}

function RiskDistribution({ summary }: { summary: NonNullable<ReturnType<typeof useRiskSummary>['data']> }) {
  const total = summary.totalAreas || 1;
  const segments = [
    { level: 'CRITICAL' as RiskLevel, count: summary.criticalRiskAreas, color: 'bg-red-500' },
    { level: 'HIGH' as RiskLevel, count: summary.highRiskAreas, color: 'bg-orange-500' },
    { level: 'MEDIUM' as RiskLevel, count: summary.mediumRiskAreas, color: 'bg-amber-500' },
    { level: 'LOW' as RiskLevel, count: summary.lowRiskAreas, color: 'bg-emerald-500' },
  ];

  return (
    <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
      <CardHeader>
        <CardTitle as="h3" className="text-lg">Risk Distribution</CardTitle>
        <CardDescription>Areas by classified risk level</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex h-4 w-full rounded-full overflow-hidden mb-4">
          {segments.map(s => (
            <div
              key={s.level}
              className={s.color}
              style={{ width: `${(s.count / total) * 100}%` }}
              title={`${s.level}: ${s.count}`}
            />
          ))}
        </div>
        <div className="space-y-2">
          {segments.map(s => (
            <div key={s.level} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span className={cn('w-2.5 h-2.5 rounded-full', s.color)} />
                <span className={cn('font-medium', LEVEL_STYLES[s.level].text)}>{s.level}</span>
              </span>
              <span className="font-mono text-neutral-900 dark:text-white">
                {s.count} <span className="text-neutral-400">({Math.round((s.count / total) * 100)}%)</span>
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function WardRiskTable({ wards }: { wards: WardRiskSummary[] }) {
  if (wards.length === 0) {
    return (
      <div className="py-10 text-center text-neutral-500 dark:text-neutral-400">
        <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p>No sufficient incident data available to calculate reliable risk for these areas.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-dark-border">
            <th className="py-2 pr-4 font-semibold">Area / Ward</th>
            <th className="py-2 pr-4 font-semibold">Risk Score</th>
            <th className="py-2 pr-4 font-semibold">Level</th>
            <th className="py-2 pr-4 font-semibold">Active</th>
            <th className="py-2 pr-4 font-semibold">Repeat</th>
            <th className="py-2 pr-4 font-semibold">SLA Breaches</th>
            <th className="py-2 pr-4 font-semibold">Res. Time</th>
            <th className="py-2 pr-4 font-semibold">Top Category</th>
            <th className="py-2 font-semibold">Trend</th>
          </tr>
        </thead>
        <tbody>
          {wards.map(w => (
            <tr key={w.wardId} className="border-b border-neutral-100 dark:border-dark-border hover:bg-neutral-50 dark:hover:bg-dark-bg transition-colors">
              <td className="py-3 pr-4 font-medium text-neutral-900 dark:text-white">{w.wardName}</td>
              <td className="py-3 pr-4">
                <div className="flex items-center gap-2">
                  <RiskBar score={w.riskScore} level={w.riskLevel} />
                  <span className="font-mono font-semibold text-neutral-900 dark:text-white">{w.riskScore}</span>
                </div>
              </td>
              <td className="py-3 pr-4">
                <span className={cn('px-2 py-0.5 rounded text-xs font-bold font-mono border', LEVEL_STYLES[w.riskLevel].badge)}>
                  {w.riskLevel}
                </span>
              </td>
              <td className="py-3 pr-4 font-mono">{w.activeIncidents}</td>
              <td className="py-3 pr-4 font-mono">{w.repeatIssues}</td>
              <td className="py-3 pr-4">
                <span className={cn('font-mono font-semibold', w.slaBreaches > 0 ? 'text-red-600 dark:text-red-400' : 'text-neutral-600 dark:text-neutral-400')}>
                  {w.slaBreaches}
                </span>
              </td>
              <td className="py-3 pr-4 font-mono">{formatResolutionHours(w.averageResolutionTime)}</td>
              <td className="py-3 pr-4 text-neutral-700 dark:text-neutral-300">{w.topCategory.replace(/_/g, ' ')}</td>
              <td className="py-3">
                <TrendIndicator direction={w.trend.direction} percentage={w.trend.percentage} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RiskPage() {
  const [days, setDays] = useState<number>(30);
  const [riskLevel, setRiskLevel] = useState<string>('');

  const { data: summary, isLoading: summaryLoading, error: summaryError } = useRiskSummary({ days });
  const { data: wardsData, isLoading: wardsLoading, error: wardsError } = useWardRisks({ days, limit: 50 });
  const { data: hotspotData, isLoading: hotspotLoading, error: hotspotError } = useRiskHotspots({ days, limit: 10 });

  const wards = wardsData?.wards ?? [];
  const hotspots = hotspotData?.hotspots ?? [];
  const hasError = summaryError || wardsError || hotspotError;
  const loading = summaryLoading || wardsLoading || hotspotLoading;

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-neutral-900 dark:text-white">Civic Risk Intelligence</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-2">
            Data-driven risk assessment from real issue activity, SLA breaches, and citizen signals.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 30, 90].map(d => (
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
        </div>
      </div>

      {loading && !summary && <LoadingBlock />}

      {hasError && !summary && (
        <div className="p-6 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-300">
            Risk intelligence data is temporarily unavailable. Please try again.
          </p>
        </div>
      )}

      {summary && (
        <>
          {/* Overview cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
              <CardContent>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">Overall Risk</span>
                  <Radar className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                </div>
                <p className="font-display text-3xl font-bold text-neutral-900 dark:text-white">{summary.averageRiskScore}</p>
                <div className="mt-1">
                  <TrendIndicator direction={summary.overallTrend.direction} percentage={summary.overallTrend.percentage} />
                </div>
              </CardContent>
            </Card>

            <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
              <CardContent>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">Critical Wards</span>
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                </div>
                <p className="font-display text-3xl font-bold text-red-600 dark:text-red-400">{summary.criticalRiskAreas}</p>
                <p className="text-xs text-neutral-500 mt-1">{summary.highRiskAreas} high-risk areas</p>
              </CardContent>
            </Card>

            <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
              <CardContent>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">Active Hotspots</span>
                  <MapPin className="w-4 h-4 text-orange-500" />
                </div>
                <p className="font-display text-3xl font-bold text-neutral-900 dark:text-white">{summary.topHotspots.length}</p>
                <p className="text-xs text-neutral-500 mt-1">{summary.totalActiveIssues} active issues</p>
              </CardContent>
            </Card>

            <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
              <CardContent>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">SLA Breaches</span>
                  <Activity className="w-4 h-4 text-red-500" />
                </div>
                <p className="font-display text-3xl font-bold text-red-600 dark:text-red-400">{summary.totalSlaBreaches}</p>
                <p className="text-xs text-neutral-500 mt-1">{summary.totalAreas} areas analysed</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-3 gap-6 mb-6">
            {/* Risk Distribution */}
            <RiskDistribution summary={summary} />

            {/* Hotspot Map */}
            <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border lg:col-span-2">
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle as="h3" className="text-lg">Risk Hotspot Map</CardTitle>
                  <CardDescription>Areas of concentrated civic risk</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {hotspots.length > 0 ? (
                  <div className="h-[320px] rounded-xl overflow-hidden">
                    <RiskHeatmap hotspots={hotspots} />
                  </div>
                ) : (
                  <div className="h-[320px] rounded-xl border border-dashed border-neutral-300 dark:border-dark-border flex items-center justify-center text-sm text-neutral-400">
                    No hotspot data available for this period.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Risk filter */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Filter by level:</span>
            {[{ value: '', label: 'All' }, ...(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as RiskLevel[]).map(l => ({ value: l, label: l }))].map(f => (
              <button
                key={f.value || 'all'}
                type="button"
                onClick={() => setRiskLevel(f.value)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-semibold border transition-colors',
                  (riskLevel || '') === f.value
                    ? 'bg-brand-700 text-white border-brand-700 dark:bg-brand-600 dark:border-brand-600'
                    : 'bg-white dark:bg-dark-bg-card text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-dark-border',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Ward risk table */}
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardHeader className="flex items-center justify-between">
              <div>
                <CardTitle as="h3" className="text-lg">Ward & Area Risk</CardTitle>
                <CardDescription>Aggregated risk scores from real issue data</CardDescription>
              </div>
              <Link href="/dashboard/risk" className="text-sm text-brand-600 dark:text-brand-400 font-medium inline-flex items-center gap-1">
                View all <ChevronRight className="w-4 h-4" />
              </Link>
            </CardHeader>
            <CardContent>
              <WardRiskTable wards={riskLevel ? wards.filter(w => w.riskLevel === riskLevel) : wards.slice(0, 15)} />
            </CardContent>
          </Card>

          {/* Risk explanation */}
          <div className="mt-6 grid md:grid-cols-2 gap-4">
            {wards.filter(w => ['HIGH', 'CRITICAL'].includes(w.riskLevel)).slice(0, 4).map(w => (
              <Card key={w.wardId} className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
                <CardContent>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Repeat2 className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                      <span className="font-display font-semibold text-neutral-900 dark:text-white">Why is {w.wardName} {w.riskLevel}?</span>
                    </div>
                    <span className={cn('px-2 py-0.5 rounded text-xs font-bold font-mono border', LEVEL_STYLES[w.riskLevel].badge)}>
                      {w.riskScore}
                    </span>
                  </div>
                  <ul className="space-y-1.5 text-sm text-neutral-700 dark:text-neutral-300">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> {w.activeIncidents} active incidents</li>
                    <li className="flex items-center gap-2"><Repeat2 className="w-4 h-4 text-orange-500 shrink-0" /> {w.repeatIssues} repeat incidents</li>
                    <li className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500 shrink-0" /> {w.slaBreaches} SLA breaches</li>
                    <li className="flex items-center gap-2"><Clock className="w-4 h-4 text-neutral-500 shrink-0" /> Avg unresolved: <span className="font-medium">{formatResolutionHours(w.averageResolutionTime)}</span></li>
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {w.factors
                      .filter(f => f.score >= 50)
                      .map(f => (
                        <span key={f.key} className="px-2 py-0.5 rounded-full text-xs font-medium bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300 border border-brand-100 dark:border-brand-800">
                          {f.label} · {f.score}
                        </span>
                      ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
