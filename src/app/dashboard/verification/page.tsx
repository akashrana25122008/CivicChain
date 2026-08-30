'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Shield, Eye, CheckCircle2, AlertTriangle } from 'lucide-react';

const VERIFICATIONS = [
  { id: 'CC-1092', type: 'Road Pothole', confidence: 81, result: 'partiallyResolved', locationMatch: 98, visualImprovement: 84 },
  { id: 'CC-1074', type: 'Streetlight Failure', confidence: 96, result: 'resolved', locationMatch: 99, visualImprovement: 92 },
  { id: 'CC-1055', type: 'Infrastructure Damage', confidence: 72, result: 'partiallyResolved', locationMatch: 88, visualImprovement: 71 },
  { id: 'CC-1021', type: 'Streetlight Failure', confidence: 94, result: 'resolved', locationMatch: 97, visualImprovement: 95 },
];

export default function VerificationPage() {
  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-neutral-900 dark:text-white">AI Verification</h1>
        <p className="text-neutral-600 dark:text-neutral-400 mt-2">
          Resolution verification powered by computer vision and community feedback.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Verified', value: '1,294', color: 'text-brand-600' },
          { label: 'Resolved', value: '1,182', color: 'text-emerald-600' },
          { label: 'Partially Resolved', value: '98', color: 'text-amber-600' },
          { label: 'Pending Review', value: '14', color: 'text-violet-600' },
        ].map((stat) => (
          <Card key={stat.label} variant="elevated" className="p-4 bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardContent>
              <p className="text-xs text-neutral-500 mb-1">{stat.label}</p>
              <p className={cn('text-2xl font-display font-bold', stat.color)}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        {VERIFICATIONS.map((ver) => (
          <Card key={ver.id} variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center',
                    ver.result === 'resolved' ? 'bg-emerald-50 dark:bg-emerald-900/30' : 'bg-amber-50 dark:bg-amber-900/30'
                  )}>
                    {ver.result === 'resolved' ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="w-6 h-6 text-amber-500" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-neutral-900 dark:text-white">{ver.id}</span>
                      <span className="text-sm text-neutral-600 dark:text-neutral-400">{ver.type}</span>
                    </div>
                    <Badge variant="status" status={ver.result} size="sm" />
                  </div>
                </div>

                <div className="flex-1 grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-neutral-500 mb-1">Location Match</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-neutral-100 dark:bg-dark-border overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${ver.locationMatch}%` }} />
                      </div>
                      <span className="text-xs font-mono text-neutral-900 dark:text-white">{ver.locationMatch}%</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 mb-1">Visual Improvement</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-neutral-100 dark:bg-dark-border overflow-hidden">
                        <div className={cn('h-full rounded-full', ver.visualImprovement >= 80 ? 'bg-emerald-500' : 'bg-amber-500')} style={{ width: `${ver.visualImprovement}%` }} />
                      </div>
                      <span className="text-xs font-mono text-neutral-900 dark:text-white">{ver.visualImprovement}%</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 mb-1">Overall Confidence</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-neutral-100 dark:bg-dark-border overflow-hidden">
                        <div className={cn('h-full rounded-full', ver.confidence >= 80 ? 'bg-brand-500' : 'bg-amber-500')} style={{ width: `${ver.confidence}%` }} />
                      </div>
                      <span className="text-xs font-mono font-bold text-neutral-900 dark:text-white">{ver.confidence}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}