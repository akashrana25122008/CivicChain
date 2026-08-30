'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Clock,
  Users,
  ArrowRight,
  MapPin,
  Activity,
} from 'lucide-react';
import Link from 'next/link';

const KPI = [
  { label: 'Active Issues', value: '248', icon: FileText, color: 'text-brand-500', bg: 'bg-brand-50 dark:bg-brand-900/20', change: '+12 today' },
  { label: 'Promises Tracked', value: '173', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', change: '+8 today' },
  { label: 'Broken Promises', value: '21', icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', change: '+2 today' },
  { label: 'Resolved Issues', value: '391', icon: TrendingUp, color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-900/20', change: '+15 today' },
  { label: 'Average Resolution', value: '4.2 days', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20', change: '-0.3 days' },
  { label: 'Citizen Verifications', value: '87.8%', icon: Users, color: 'text-cyan-500', bg: 'bg-cyan-50 dark:bg-cyan-900/20', change: '+1.2%' },
];

const RECENT_ISSUES = [
  { id: 'CC-1092', type: 'Road Pothole', location: 'Sector 12', priority: 92, promise: '28 Aug 2026', status: 'atRisk', reports: 63 },
  { id: 'CC-1087', type: 'Drain Blockage', location: 'Ward 4', priority: 87, promise: '29 Aug 2026', status: 'onTrack', reports: 41 },
  { id: 'CC-1074', type: 'Streetlight Failure', location: 'Main Road', priority: 71, promise: '31 Aug 2026', status: 'assigned', reports: 28 },
  { id: 'CC-1068', type: 'Garbage Accumulation', location: 'Market Area', priority: 95, promise: '25 Aug 2026', status: 'brokenPromise', reports: 87 },
];

export default function DashboardPage() {
  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-neutral-900 dark:text-white">Civic Overview</h1>
        <p className="text-neutral-600 dark:text-neutral-400 mt-2">
          Monitor issues, commitments and resolution activity across your civic network.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {KPI.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} variant="elevated" className="p-4 bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
              <CardContent>
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-3', item.bg)}>
                  <Icon className={cn('w-4 h-4', item.color)} />
                </div>
                <p className="text-2xl font-display font-bold text-neutral-900 dark:text-white">{item.value}</p>
                <p className="text-xs text-neutral-500 mt-1">{item.label}</p>
                <p className="text-[10px] text-neutral-400 mt-1 font-mono">{item.change}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle as="h2" className="text-lg">Recent Civic Issues</CardTitle>
              <Link href="/dashboard/issues" className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 flex items-center gap-1">
                View All <ArrowRight className="w-4 h-4" />
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {RECENT_ISSUES.map((issue) => (
                  <Link
                    key={issue.id}
                    href={`/dashboard/issues/${issue.id}`}
                    className="flex items-center justify-between p-4 rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border hover:border-brand-300 dark:hover:border-brand-700 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-neutral-900 dark:text-white">{issue.id}</span>
                          <span className="text-sm text-neutral-600 dark:text-neutral-400">{issue.type}</span>
                        </div>
                        <p className="text-xs text-neutral-500 mt-1">{issue.location} • {issue.reports} reports</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right hidden md:block">
                        <p className="text-xs text-neutral-500">Priority</p>
                        <p className="font-mono text-sm font-bold text-neutral-900 dark:text-white">{issue.priority}/100</p>
                      </div>
                      <Badge variant="status" status={issue.status} size="sm" />
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardHeader>
              <CardTitle as="h2" className="text-lg">Escalations Requiring Attention</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { id: 'CC-1041', type: 'Drainage Repair', overdue: '5 days', citizens: 142, level: 2 },
                  { id: 'CC-1068', type: 'Garbage Accumulation', overdue: '3 days', citizens: 87, level: 1 },
                ].map((esc) => (
                  <div key={esc.id} className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-sm font-bold text-red-700 dark:text-red-300">{esc.id}</span>
                      <span className="text-xs text-red-600 dark:text-red-400">Level {esc.level}</span>
                    </div>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300">{esc.type}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-neutral-500">
                      <span>Overdue: {esc.overdue}</span>
                      <span>{esc.citizens} affected</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardHeader>
              <CardTitle as="h2" className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Link href="/report" className="flex items-center gap-3 p-3 rounded-xl bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 hover:bg-brand-100 dark:hover:bg-brand-900/30 transition-colors">
                  <FileText className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                  <span className="text-sm font-medium text-brand-700 dark:text-brand-300">Report New Issue</span>
                </Link>
                <Link href="/dashboard/map" className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border hover:bg-neutral-100 dark:hover:bg-dark-bg-card transition-colors">
                  <Activity className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">View Civic Map</span>
                </Link>
                <Link href="/dashboard/promises" className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-dark-bg border border-neutral-200 dark:border-dark-border hover:bg-neutral-100 dark:hover:bg-dark-bg-card transition-colors">
                  <CheckCircle2 className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Track Promises</span>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}