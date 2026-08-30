'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import Link from 'next/link';
import { MapPin, ArrowRight } from 'lucide-react';

const ISSUES = [
  { id: 'CC-1092', type: 'Road Pothole', location: 'Sector 12', priority: 92, promise: '28 Aug 2026', status: 'atRisk', reports: 63 },
  { id: 'CC-1087', type: 'Drain Blockage', location: 'Ward 4', priority: 87, promise: '29 Aug 2026', status: 'onTrack', reports: 41 },
  { id: 'CC-1074', type: 'Streetlight Failure', location: 'Main Road', priority: 71, promise: '31 Aug 2026', status: 'assigned', reports: 28 },
  { id: 'CC-1068', type: 'Garbage Accumulation', location: 'Market Area', priority: 95, promise: '25 Aug 2026', status: 'brokenPromise', reports: 87 },
  { id: 'CC-1055', type: 'Infrastructure Damage', location: 'Industrial Area', priority: 65, promise: '02 Sep 2026', status: 'verificationPending', reports: 19 },
  { id: 'CC-1041', type: 'Drainage Repair', location: 'Ward 8', priority: 89, promise: '22 Aug 2026', status: 'brokenPromise', reports: 142 },
  { id: 'CC-1033', type: 'Road Pothole', location: 'Ward 12', priority: 78, promise: '30 Aug 2026', status: 'onTrack', reports: 34 },
  { id: 'CC-1021', type: 'Streetlight Failure', location: 'College Road', priority: 55, promise: '26 Aug 2026', status: 'resolved', reports: 12 },
];

export default function IssuesPage() {
  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-neutral-900 dark:text-white">Civic Issues</h1>
        <p className="text-neutral-600 dark:text-neutral-400 mt-2">
          Track and manage civic issues across your network.
        </p>
      </div>

      <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
        <CardContent className="p-0">
          <div className="divide-y divide-neutral-200 dark:divide-dark-border">
            {ISSUES.map((issue) => (
              <Link
                key={issue.id}
                href={`/dashboard/issues/${issue.id}`}
                className="flex items-center justify-between p-6 hover:bg-neutral-50 dark:hover:bg-dark-bg transition-colors"
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
                  <div className="text-right hidden md:block">
                    <p className="text-xs text-neutral-500">Promise</p>
                    <p className="text-sm text-neutral-900 dark:text-white">{issue.promise}</p>
                  </div>
                  <Badge variant="status" status={issue.status} size="sm" />
                  <ArrowRight className="w-4 h-4 text-neutral-400" />
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}