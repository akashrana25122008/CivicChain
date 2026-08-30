'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  MapPin,
  Clock,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  Brain,
  ArrowLeft,
  FileText,
  Eye,
  Loader2,
  File,
  GitMerge,
} from 'lucide-react';
import type { ApiIssueResponse } from '@/lib/issues/types';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function IssueDetailView({ id, endpoint }: { id: string; endpoint: string }) {
  const { data, isLoading, error, mutate } = useSWR<ApiIssueResponse>(
    `${endpoint}/${id}`,
    fetcher,
    { refreshInterval: 30000 },
  );

  if (isLoading && !data) {
    return (
      <div className="p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500 mx-auto mb-4" />
        <p className="text-sm text-neutral-500">Loading report…</p>
      </div>
    );
  }

  if (error || !data?.issue) {
    return (
      <div className="p-12 text-center text-sm text-red-600 dark:text-red-400">
        Could not load this report.
      </div>
    );
  }

  const issue = data.issue;

  const ai = issue.aiAnalysis;
  const aiStatus = ai?.status ?? issue.analysisStatus ?? null;

  const statCards = [
    {
      label: issue.categoryLabel,
      value: issue.severityLabel ?? 'Pending AI',
      sub:
        aiStatus === 'COMPLETED'
          ? 'AI severity classification'
          : aiStatus === 'FAILED'
            ? 'AI unavailable — manual review'
            : aiStatus === 'PROCESSING' || aiStatus === 'PENDING'
              ? 'AI severity in progress'
              : 'AI severity pending',
      icon: AlertTriangle,
      color: 'text-amber-500',
    },
    {
      label: 'Priority',
      value: issue.priorityLevel ?? 'Pending',
      sub:
        issue.priority != null
          ? `priority score ${Math.round(issue.priority)}/100`
          : 'computed after analysis',
      icon: Gauge,
      color: 'text-brand-500',
    },
    {
      label: 'Reports',
      value: String(issue.incident?.memberCount ?? issue.reportCount),
      sub: (issue.incident?.memberCount ?? issue.reportCount) === 1 ? 'this report' : 'reports in incident',
      icon: FileText,
      color: 'text-violet-500',
    },
    {
      label: 'Promise',
      value: issue.promiseLabel ?? 'No promise',
      sub: issue.promiseLabel ? `by ${issue.authority ?? 'authority'}` : 'not yet promised',
      icon: Clock,
      color: 'text-emerald-500',
    },
  ];

  const timeline = issue.timeline.map((item, index) => ({
    ...item,
    state: index === issue.timeline.length - 1 ? 'current' : 'completed',
  })) as Array<{ date: string; label: string; state: 'completed' | 'current' | 'pending' }>;

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <Link href={endpoint === '/api/my-reports' ? '/my-reports' : '/dashboard/issues'} className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to {endpoint === '/api/my-reports' ? 'My Reports' : 'Issues'}
        </Link>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="font-display text-3xl font-bold text-neutral-900 dark:text-white">
                CIVIC ISSUE #{issue.publicId}
              </h1>
              <Badge variant="status" status={issue.displayStatus} />
            </div>
            <p className="text-neutral-600 dark:text-neutral-400">
              {issue.categoryLabel} • {issue.location || 'Location not provided'}{' '}
              <span className="text-neutral-400">• reported {issue.timeLabel}</span>
            </p>
            {issue.hasLocation && (
              <p className="mt-1 text-xs text-neutral-500 font-mono">
                {Number(issue.latitude).toFixed(6)}, {Number(issue.longitude).toFixed(6)}
                {issue.accuracy != null && <> • GPS ±{Math.round(issue.accuracy)} m</>}
              </p>
            )}
            {issue.byCurrentUser && (
              <span className="mt-2 inline-block text-[10px] font-medium px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                Submitted by you
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" asChild>
              <a
                href={issue.hasLocation ? `https://maps.google.com/?q=${issue.latitude},${issue.longitude}` : undefined}
                aria-disabled={!issue.hasLocation}
                className={cn(!issue.hasLocation && 'opacity-50 pointer-events-none')}
              >
                <Eye className="w-4 h-4 mr-2" />
                View on Map
              </a>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {statCards.map((stat) => (
              <Card key={stat.label} variant="elevated" className="p-4 bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
                <CardContent>
                  <div className="flex items-center gap-2 mb-2">
                    <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                    <span className="text-xs text-neutral-500">{stat.label}</span>
                  </div>
                  <p className="text-lg font-display font-bold text-neutral-900 dark:text-white leading-tight">{stat.value}</p>
                  <p className="text-xs text-neutral-500 mt-1">{stat.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {issue.description && (
            <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
              <CardHeader>
                <CardTitle as="h2" className="text-lg">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap text-sm">{issue.description}</p>
              </CardContent>
            </Card>
          )}

          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardHeader>
              <CardTitle as="h2" className="text-lg">Issue Evidence</CardTitle>
            </CardHeader>
            <CardContent>
              {issue.evidence.length === 0 ? (
                <p className="text-sm text-neutral-500">No evidence was attached to this report.</p>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {issue.evidence.map((ev) =>
                    ev.type === 'IMAGE' ? (
                      <div key={ev.id} className="aspect-video rounded-xl overflow-hidden bg-neutral-100 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border">
                        <img
                          src={ev.url}
                          alt={ev.fileName || 'Report evidence'}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    ) : ev.type === 'VIDEO' ? (
                      <div key={ev.id} className="aspect-video rounded-xl overflow-hidden bg-neutral-100 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border">
                        <video src={ev.url} controls className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div key={ev.id} className="aspect-video rounded-xl flex flex-col items-center justify-center bg-neutral-100 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border p-4">
                        <File className="w-8 h-8 text-neutral-400 mb-2" />
                        <a href={ev.url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 dark:text-brand-400 underline break-all text-center">
                          {ev.fileName || ev.url}
                        </a>
                      </div>
                    ),
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardHeader>
              <CardTitle as="h2" className="text-lg flex items-center gap-2">
                <Brain className="w-5 h-5 text-brand-500" />
                Classification
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-3 rounded-lg bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border">
                  <p className="text-xs text-neutral-500 mb-1">Category</p>
                  <p className="font-medium text-neutral-900 dark:text-white">{issue.categoryLabel}</p>
                </div>
                <div className="p-3 rounded-lg bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border">
                  <p className="text-xs text-neutral-500 mb-1">Status</p>
                  <p className="font-medium text-neutral-900 dark:text-white">{issue.statusLabel}</p>
                </div>
                <div className="p-3 rounded-lg bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border">
                  <p className="text-xs text-neutral-500 mb-1">Department</p>
                  <p className="font-medium text-neutral-900 dark:text-white">{issue.authority ?? 'To be assigned'}</p>
                </div>
                <div className={cn(
                  'p-3 rounded-lg border',
                  aiStatus === 'COMPLETED'
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                    : aiStatus === 'FAILED'
                      ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                      : 'bg-neutral-50 dark:bg-dark-bg border-neutral-200 dark:border-dark-border'
                )}>
                  <p className="text-xs text-neutral-500 mb-1 flex items-center gap-1.5">
                    AI classification
                    {aiStatus === 'PROCESSING' || aiStatus === 'PENDING' ? (
                      <Loader2 className="w-3 h-3 animate-spin text-brand-500" />
                    ) : null}
                  </p>
                  <p className="font-mono font-medium text-brand-600 dark:text-brand-400">
                    {aiStatus === 'COMPLETED'
                      ? `${Math.round((ai?.confidence ?? 0) * 100)}% confidence`
                      : aiStatus === 'FAILED'
                        ? 'Unavailable'
                        : aiStatus === 'PROCESSING'
                          ? 'Analyzing…'
                          : 'Pending'}
                  </p>
                </div>
              </div>

              {aiStatus === 'COMPLETED' && ai && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="p-3 rounded-lg bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border">
                      <p className="text-xs text-neutral-500 mb-1">AI severity</p>
                      <p className="font-medium text-neutral-900 dark:text-white">{ai.severityLabel ?? '—'}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border">
                      <p className="text-xs text-neutral-500 mb-1">Safety risk</p>
                      <p className="font-medium text-neutral-900 dark:text-white">{ai.safetyRiskLabel ?? '—'}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border">
                      <p className="text-xs text-neutral-500 mb-1">Infrastructure</p>
                      <p className="font-medium text-neutral-900 dark:text-white">{ai.infrastructureTypeLabel ?? '—'}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border">
                      <p className="text-xs text-neutral-500 mb-1">Model</p>
                      <p className="font-medium text-neutral-900 dark:text-white">{ai.modelName ?? '—'}</p>
                    </div>
                  </div>
                  {ai.reasoningSummary && (
                    <div className="p-3 rounded-lg bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border">
                      <p className="text-xs text-neutral-500 mb-1">AI reasoning</p>
                      <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">{ai.reasoningSummary}</p>
                    </div>
                  )}
                </>
              )}

              {aiStatus === 'FAILED' && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    {ai?.errorMessage || 'The AI analysis service did not respond.'} This report remains visible and is handled through the standard accountability workflow — no simulated scores are shown.
                  </p>
                </div>
              )}

              {issue.priorityBreakdown && (
                <div className="mt-2 p-3 rounded-lg bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border">
                  <p className="text-xs text-neutral-500 mb-2">
                    Priority breakdown — {Math.round(issue.priorityBreakdown.score)}/100 (
                    {issue.priorityBreakdown.level})
                  </p>
                  <div className="space-y-1.5">
                    {issue.priorityBreakdown.components.map((c) => (
                      <div key={c.key} className="flex items-center gap-3 text-xs">
                        <span className="w-40 flex-none text-neutral-500">{c.label}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-neutral-200 dark:bg-dark-border overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              c.origin === 'unavailable' ? 'bg-neutral-400' : 'bg-brand-500'
                            )}
                            style={{ width: `${c.score}%` }}
                          />
                        </div>
                        <span className="w-8 text-right font-mono text-neutral-600 dark:text-neutral-400">
                          {c.origin === 'unavailable' ? 'n/a' : Math.round(c.score)}
                        </span>
                      </div>
                    ))}
                  </div>
                  {issue.priorityBreakdown.unavailable.length > 0 && (
                    <p className="mt-2 text-[11px] text-neutral-500">
                      Not available: {issue.priorityBreakdown.unavailable.join(', ')} — shown as neutral, not invented.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardHeader>
              <CardTitle as="h2" className="text-lg flex items-center gap-2">
                <GitMerge className="w-5 h-5 text-brand-500" />
                Duplicate Detection & Incident
              </CardTitle>
            </CardHeader>
            <CardContent>
              {issue.incident ? (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                  <p className="text-sm text-neutral-700 dark:text-neutral-300">
                    This report is part of incident{' '}
                    <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                      {issue.incident.publicId}
                    </span>{' '}
                    — {issue.incident.memberCount} report(s) covering the same issue were automatically grouped.
                  </p>
                  {issue.incident.memberCount > 1 && (
                    <p className="mt-2 text-xs text-neutral-500">
                      Incident members: {issue.incident.memberPublicIds.join(', ')}
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    No duplicate incident was detected for this report. It stands on its own until other reports pointing to the same issue are found.
                  </p>
                </div>
              )}
              <p className="text-xs text-neutral-500 mt-4 italic">
                Fragments use real signals — location, description, image similarity, report timing and category. Thresholds are configurable and never replace formal human review.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardHeader>
              <CardTitle as="h2" className="text-lg">Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <p className="text-sm text-neutral-500">No activity recorded yet.</p>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-neutral-200 dark:bg-dark-border" />
                  <div className="space-y-4">
                    {timeline.map((item, index) => (
                      <div key={index} className="relative flex items-start gap-4">
                        <div className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center z-10 border-4 border-white dark:border-dark-bg-card',
                          item.state === 'completed' ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                          item.state === 'current' ? 'bg-amber-100 dark:bg-amber-900/30' :
                          'bg-neutral-100 dark:bg-dark-border'
                        )}>
                          {item.state === 'completed' ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          ) : item.state === 'current' ? (
                            <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-neutral-400" />
                          )}
                        </div>
                        <div className="flex-1 pt-1">
                          <p className="text-xs text-neutral-500 mb-0.5">{item.date}</p>
                          <p className={cn(
                            'text-sm',
                            item.state === 'current' ? 'font-medium text-amber-700 dark:text-amber-300' :
                            item.state === 'completed' ? 'text-neutral-700 dark:text-neutral-300' :
                            'text-neutral-500'
                          )}>
                            {item.label}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardHeader>
              <CardTitle as="h2" className="text-lg">Community Verification</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border flex items-start gap-3">
                <MapPin className="w-5 h-5 text-neutral-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Community verification is a <strong>future phase</strong>. The baseline&apos;s placeholder percentages were removed and are not simulated.
                </p>
              </div>
              <p className="text-xs text-neutral-500 mt-4 italic">
                Community feedback is an additional evidence layer and does not replace formal administrative verification.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}