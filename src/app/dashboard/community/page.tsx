'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Users, ThumbsUp, MessageSquare, AlertTriangle } from 'lucide-react';

const FEEDBACK = [
  { id: 'CC-1092', type: 'Road Pothole', fixed: 71, partially: 19, notFixed: 10, totalVotes: 63 },
  { id: 'CC-1087', type: 'Drain Blockage', fixed: 82, partially: 12, notFixed: 6, totalVotes: 41 },
  { id: 'CC-1068', type: 'Garbage Accumulation', fixed: 45, partially: 28, notFixed: 27, totalVotes: 87 },
  { id: 'CC-1041', type: 'Drainage Repair', fixed: 32, partially: 24, notFixed: 44, totalVotes: 142 },
];

export default function CommunityPage() {
  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-neutral-900 dark:text-white">Community</h1>
        <p className="text-neutral-600 dark:text-neutral-400 mt-2">
          Community feedback and verification activity.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Verifications', value: '333', icon: Users, color: 'text-brand-500', bg: 'bg-brand-50 dark:bg-brand-900/20' },
          { label: 'Fixed', value: '57%', icon: ThumbsUp, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          { label: 'Partially Fixed', value: '21%', icon: MessageSquare, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
          { label: 'Not Fixed', value: '22%', icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
        ].map((stat) => {
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

      <div className="space-y-4">
        {FEEDBACK.map((item) => (
          <Card key={item.id} variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center">
                    <Users className="w-6 h-6 text-brand-600 dark:text-brand-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-neutral-900 dark:text-white">{item.id}</span>
                      <span className="text-sm text-neutral-600 dark:text-neutral-400">{item.type}</span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">{item.totalVotes} community votes</p>
                  </div>
                </div>

                <div className="flex-1 grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-neutral-500 mb-1">Fixed</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-neutral-100 dark:bg-dark-border overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${item.fixed}%` }} />
                      </div>
                      <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">{item.fixed}%</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 mb-1">Partially Fixed</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-neutral-100 dark:bg-dark-border overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: `${item.partially}%` }} />
                      </div>
                      <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">{item.partially}%</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 mb-1">Not Fixed</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-neutral-100 dark:bg-dark-border overflow-hidden">
                        <div className="h-full bg-red-500 rounded-full" style={{ width: `${item.notFixed}%` }} />
                      </div>
                      <span className="text-xs font-mono font-bold text-red-600 dark:text-red-400">{item.notFixed}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 p-6 rounded-2xl bg-neutral-50 dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
        <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed text-center">
          Community feedback is an additional evidence layer and does not replace formal administrative verification.
        </p>
      </div>
    </div>
  );
}