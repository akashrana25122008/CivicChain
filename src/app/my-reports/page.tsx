'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ClipboardList, ArrowRight, MapPin } from 'lucide-react';
import type { ApiIssueListResponse } from '@/lib/issues/types';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function MyReportsPage() {
  const { data, isLoading, error } = useSWR<ApiIssueListResponse>('/api/my-reports', fetcher);

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-neutral-900 dark:text-white">My Reports</h1>
        <p className="text-neutral-600 dark:text-neutral-400 mt-2">
          {data
            ? `${data.total} report${data.total === 1 ? '' : 's'} submitted by your account in the CivicChain database`
            : 'Loading your reports…'}
        </p>
      </div>

      <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
        <CardContent className="p-0">
          {isLoading && !data ? (
            <div className="divide-y divide-neutral-200 dark:divide-dark-border">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 bg-neutral-100 dark:bg-dark-border animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="p-10 text-center text-sm text-red-600 dark:text-red-400">
              Failed to load your reports.
            </div>
          ) : !data || data.issues.length === 0 ? (
            <div className="p-12 text-center">
              <ClipboardList className="w-10 h-10 text-neutral-300 dark:text-neutral-600 mx-auto mb-3" />
              <p className="text-sm text-neutral-500 mb-1">You have not submitted any reports yet.</p>
              <Link href="/report" className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 font-medium">
                Report your first civic issue →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-neutral-200 dark:divide-dark-border">
              {data.issues.map((issue) => (
                <Link
                  key={issue.id}
                  href={`/my-reports/${issue.id}`}
                  className="flex items-center justify-between p-6 hover:bg-neutral-50 dark:hover:bg-dark-bg transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-neutral-900 dark:text-white">{issue.publicId}</span>
                        <span className="text-sm text-neutral-600 dark:text-neutral-400">{issue.categoryLabel}</span>
                      </div>
                      <p className="text-xs text-neutral-500 mt-1">
                        {issue.location || 'Location not provided'} • {issue.timeLabel}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden md:block">
                      <p className="text-xs text-neutral-500">Department</p>
                      <p className="text-sm text-neutral-900 dark:text-white">{issue.authority ?? 'To be assigned'}</p>
                    </div>
                    <Badge variant="status" status={issue.displayStatus} size="sm" />
                    <ArrowRight className="w-4 h-4 text-neutral-400" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}