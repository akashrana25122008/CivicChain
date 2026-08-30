'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { IssuesMap, type IssueMapMarker } from '@/components/dashboard/IssuesMap';
import { LoadingBlock } from '@/components/dashboard/LoadingBlock';
import { ErrorState } from '@/components/dashboard/ErrorState';
import type { ApiIssueListResponse } from '@/lib/issues/types';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const STATUS_LEGEND_COLOR: Record<string, string> = {
  brokenPromise: 'bg-red-500',
  atRisk: 'bg-amber-500',
  promised: 'bg-cyan-500',
  assigned: 'bg-violet-500',
  verificationPending: 'bg-purple-500',
  resolved: 'bg-emerald-500',
  active: 'bg-blue-500',
};

export default function MapPage() {
  const { data, error, isLoading, mutate } = useSWR<ApiIssueListResponse>(
    '/api/issues?pageSize=100',
    fetcher,
    { refreshInterval: 60000 },
  );

  const [focusedId, setFocusedId] = useState<string | null>(null);

  const issues = data?.issues ?? [];
  const markers: IssueMapMarker[] = issues
    .filter((i) => i.latitude != null && i.longitude != null)
    .map((i) => ({
      id: i.id,
      publicId: i.publicId,
      title: i.title,
      latitude: i.latitude!,
      longitude: i.longitude!,
      displayStatus: i.displayStatus,
    }));

  const active = issues.filter((i) => i.status !== 'RESOLVED' && i.status !== 'REJECTED').length;
  const resolved = issues.filter((i) => i.status === 'RESOLVED').length;
  const positioned = markers.length;
  const statuses = [...new Set(issues.map((i) => i.displayStatus))];
  const legendRows = statuses.map((s) => ({
    label: s.charAt(0).toUpperCase() + s.slice(1).replace(/([A-Z])/g, ' $1'),
    color: STATUS_LEGEND_COLOR[s] ?? 'bg-brand-500',
  }));

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        kicker="Civic intelligence"
        title="Map"
        description="Every report with a location, placed on the map from the CivicChain database. Reports without coordinates stay in the list only."
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/report">Report an issue</Link>
        </Button>
      </PageHeader>

      {error && <ErrorState onRetry={() => mutate()} />}
      {isLoading && !data && <LoadingBlock rows={4} />}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {data && (
            <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border overflow-hidden" padding="none">
              <IssuesMap issues={markers} className="border-0 rounded-none aspect-[16/10]" />
              <div className="px-4 py-3 border-t border-neutral-200 dark:border-dark-border flex flex-wrap items-center gap-4">
                {legendRows.length === 0 ? (
                  <span className="text-xs text-neutral-500">No reports to map yet.</span>
                ) : (
                  legendRows.map((item) => (
                    <span key={item.label} className="flex items-center gap-2">
                      <span className={item.color} style={{ width: 10, height: 10, borderRadius: 999 }} />
                      <span className="text-xs text-neutral-500">{item.label}</span>
                    </span>
                  ))
                )}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle as="h2" className="text-lg">Explore Reports</CardTitle>
              <span className="text-xs text-neutral-500">{data?.total ?? '…'} total</span>
            </CardHeader>
            <CardContent>
              {!data && !error ? (
                <LoadingBlock rows={4} />
              ) : issues.length === 0 ? (
                <p className="text-sm text-neutral-500 py-6 text-center">No civic issues have been reported yet.</p>
              ) : (
                <div className="space-y-3">
                  {issues.slice(0, 6).map((issue) => (
                    <Link
                      key={issue.id}
                      href={`/dashboard/issues/${issue.id}`}
                      onMouseEnter={() => setFocusedId(issue.id)}
                      onFocus={() => setFocusedId(issue.id)}
                      onMouseLeave={() => setFocusedId(null)}
                      onBlur={() => setFocusedId(null)}
                      className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border hover:border-brand-300 dark:hover:border-brand-700 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${focusedId === issue.id ? 'bg-brand-100 dark:bg-brand-900/40' : 'bg-brand-50 dark:bg-brand-900/30'}`}>
                          <MapPin className={`w-4 h-4 ${focusedId === issue.id ? 'text-brand-700 dark:text-brand-300' : 'text-brand-600 dark:text-brand-400'}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-mono text-sm font-bold text-neutral-900 dark:text-white">{issue.publicId}</p>
                          <p className="text-xs text-neutral-500 truncate">{issue.title}</p>
                        </div>
                      </div>
                      <Badge variant="status" status={issue.displayStatus} size="sm" className="flex-shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardHeader>
              <CardTitle as="h2" className="text-lg">Map Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { label: 'Reports loaded', value: data ? String(issues.length) : '…' },
                  { label: 'Located on map', value: data ? String(positioned) : '…' },
                  { label: 'Active', value: data ? String(active) : '…' },
                  { label: 'Resolved', value: data ? String(resolved) : '…' },
                ].map((stat) => (
                  <div key={stat.label} className="flex justify-between items-center">
                    <span className="text-sm text-neutral-600 dark:text-neutral-400">{stat.label}</span>
                    <span className="font-mono font-bold text-neutral-900 dark:text-white">{stat.value}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-neutral-400 mt-4">
                Totals come from the live report list. Only reports reported with a location appear on the map.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}