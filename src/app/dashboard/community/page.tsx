'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/Card';
import { EmptyState } from '@/components/dashboard/EmptyState';
import { LoadingBlock } from '@/components/dashboard/LoadingBlock';
import { Users, ThumbsUp, MessageSquare, AlertTriangle, Vote } from 'lucide-react';
import type { CommunityFeedbackItem } from '@/lib/issues/types';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function CommunityPage() {
  const { data, isLoading, error } = useSWR<{
    items: CommunityFeedbackItem[];
    stats: { totalIssues: number; totalVotes: number; confirmPct: number | null; supportPct: number | null; disputePct: number | null };
  }>('/api/community/feedback', fetcher, { refreshInterval: 30000 });

  const items = data?.items ?? [];
  const stats = data?.stats;

  const statCards = [
    { label: 'Issues With Community Votes', value: stats?.totalIssues ?? 0, icon: Users, color: 'text-brand-500', bg: 'bg-brand-50 dark:bg-brand-900/20' },
    { label: 'Total Votes Cast', value: stats?.totalVotes ?? 0, icon: Vote, color: 'text-brand-500', bg: 'bg-brand-50 dark:bg-brand-900/20' },
    { label: 'Confirmed Fixed', value: stats?.confirmPct != null ? `${stats.confirmPct}%` : 0, icon: ThumbsUp, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { label: 'Disputed', value: stats?.disputePct != null ? `${stats.disputePct}%` : 0, icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
  ];

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-neutral-900 dark:text-white">Community</h1>
        <p className="text-neutral-600 dark:text-neutral-400 mt-2">
          Community feedback and verification activity, tallied from real votes on real reports.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} variant="elevated" className="p-4 bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
              <CardContent>
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-3', stat.bg)}>
                  <Icon className={cn('w-4 h-4', stat.color)} />
                </div>
                <p className="text-2xl font-display font-bold text-neutral-900 dark:text-white">{stat.value}</p>
                <p className="text-xs text-neutral-500 mt-1">{stat.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {isLoading && !data ? (
        <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
          <CardContent className="p-6"><LoadingBlock rows={4} /></CardContent>
        </Card>
      ) : error ? (
        <p className="text-sm text-red-600 dark:text-red-400 p-8 text-center">Could not load community feedback.</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No community votes yet"
          description="When neighbours cast votes on civic reports, the tallies appear here — computed from real data only."
        />
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <Card key={item.id} variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center">
                      <Users className="w-6 h-6 text-brand-600 dark:text-brand-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-neutral-900 dark:text-white">{item.publicId}</span>
                        <span className="text-sm text-neutral-600 dark:text-neutral-400">{item.title}</span>
                      </div>
                      <p className="text-xs text-neutral-500 mt-1">{item.totalVotes} community vote(s)</p>
                    </div>
                  </div>

                  <div className="flex-1 grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-neutral-500 mb-1">Confirmed Fixed</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-neutral-100 dark:bg-dark-border overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${item.confirmPct ?? 0}%` }} />
                        </div>
                        <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">{item.confirmVotes} · {item.confirmPct ?? 0}%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500 mb-1">Supported</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-neutral-100 dark:bg-dark-border overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full" style={{ width: `${item.supportPct ?? 0}%` }} />
                        </div>
                        <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">{item.supportVotes} · {item.supportPct ?? 0}%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500 mb-1">Disputed</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-neutral-100 dark:bg-dark-border overflow-hidden">
                          <div className="h-full bg-red-500 rounded-full" style={{ width: `${item.disputePct ?? 0}%` }} />
                        </div>
                        <span className="text-xs font-mono font-bold text-red-600 dark:text-red-400">{item.disputeVotes} · {item.disputePct ?? 0}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    <Link href={`/dashboard/issues/${item.id}`} className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium">
                      <MessageSquare className="w-3.5 h-3.5 inline mr-1" />Open report
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-8 p-6 rounded-2xl bg-neutral-50 dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
        <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed text-center">
          Community votes are an additional evidence layer and never replace formal administrative verification.
        </p>
      </div>
    </div>
  );
}