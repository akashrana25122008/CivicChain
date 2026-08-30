'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Clock, Calendar, AlertTriangle, CheckCircle2 } from 'lucide-react';

const PROMISES = [
  { id: 'CC-1092', type: 'Road Repair', authority: 'Roads Department', deadline: '28 Aug 2026', status: 'atRisk', created: '24 Aug 2026' },
  { id: 'CC-1087', type: 'Drain Clearing', authority: 'Drainage Dept', deadline: '29 Aug 2026', status: 'onTrack', created: '25 Aug 2026' },
  { id: 'CC-1074', type: 'Streetlight Fix', authority: 'Electrical Services', deadline: '31 Aug 2026', status: 'assigned', created: '26 Aug 2026' },
  { id: 'CC-1068', type: 'Garbage Removal', authority: 'Sanitation Dept', deadline: '25 Aug 2026', status: 'brokenPromise', created: '22 Aug 2026' },
  { id: 'CC-1055', type: 'Infrastructure Repair', authority: 'Roads Department', deadline: '02 Sep 2026', status: 'verificationPending', created: '27 Aug 2026' },
  { id: 'CC-1041', type: 'Drainage Repair', authority: 'Drainage Dept', deadline: '22 Aug 2026', status: 'brokenPromise', created: '18 Aug 2026' },
];

export default function PromisesPage() {
  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-neutral-900 dark:text-white">Promise Engine</h1>
        <p className="text-neutral-600 dark:text-neutral-400 mt-2">
          Track commitments and deadlines across your civic network.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Promises', value: '173', icon: Calendar, color: 'text-brand-500', bg: 'bg-brand-50 dark:bg-brand-900/20' },
          { label: 'On Track', value: '142', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          { label: 'At Risk', value: '18', icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
          { label: 'Broken', value: '13', icon: Clock, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
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

      <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
        <CardContent className="p-0">
          <div className="divide-y divide-neutral-200 dark:divide-dark-border">
            {PROMISES.map((promise) => (
              <div key={promise.id} className="flex items-center justify-between p-6 hover:bg-neutral-50 dark:hover:bg-dark-bg transition-colors">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center',
                    promise.status === 'onTrack' ? 'bg-emerald-50 dark:bg-emerald-900/30' :
                    promise.status === 'atRisk' ? 'bg-amber-50 dark:bg-amber-900/30' :
                    promise.status === 'brokenPromise' ? 'bg-red-50 dark:bg-red-900/30' :
                    'bg-neutral-50 dark:bg-dark-border'
                  )}>
                    {promise.status === 'onTrack' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : promise.status === 'atRisk' ? (
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                    ) : promise.status === 'brokenPromise' ? (
                      <Clock className="w-5 h-5 text-red-500" />
                    ) : (
                      <Calendar className="w-5 h-5 text-neutral-500" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-neutral-900 dark:text-white">{promise.id}</span>
                      <span className="text-sm text-neutral-600 dark:text-neutral-400">{promise.type}</span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">{promise.authority} • Created {promise.created}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right hidden md:block">
                    <p className="text-xs text-neutral-500">Deadline</p>
                    <p className="text-sm font-medium text-neutral-900 dark:text-white">{promise.deadline}</p>
                  </div>
                  <Badge variant="status" status={promise.status} size="sm" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}