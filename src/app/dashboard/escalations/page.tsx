'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { AlertTriangle, Clock, Users, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const ESCALATIONS = [
  { id: 'CC-1041', type: 'Drainage Repair', deadline: '22 Aug 2026', overdue: 5, citizens: 142, level: 2, nextAction: 'Senior Department Review' },
  { id: 'CC-1068', type: 'Garbage Accumulation', deadline: '25 Aug 2026', overdue: 3, citizens: 87, level: 1, nextAction: 'Department Follow-up' },
  { id: 'CC-1033', type: 'Road Pothole', deadline: '30 Aug 2026', overdue: 1, citizens: 34, level: 1, nextAction: 'Status Update Required' },
];

export default function EscalationsPage() {
  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-neutral-900 dark:text-white">Escalations</h1>
        <p className="text-neutral-600 dark:text-neutral-400 mt-2">
          Commitments requiring attention and follow-up.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total Escalations', value: '21', color: 'text-red-600' },
          { label: 'Level 2', value: '8', color: 'text-amber-600' },
          { label: 'Level 1', value: '13', color: 'text-brand-600' },
        ].map((stat) => (
          <Card key={stat.label} variant="elevated" className="p-4 bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardContent>
              <p className="text-xs text-neutral-500 mb-1">{stat.label}</p>
              <p className={cn('text-3xl font-display font-bold', stat.color)}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        {ESCALATIONS.map((esc) => (
          <Card key={esc.id} variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-bold text-neutral-900 dark:text-white">{esc.id}</span>
                      <Badge variant="status" status="brokenPromise" size="sm" />
                      <span className="px-2 py-0.5 rounded text-xs font-mono bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
                        Level {esc.level}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">{esc.type}</p>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Deadline: {esc.deadline}
                      </span>
                      <span className="flex items-center gap-1 text-red-500 font-medium">
                        Overdue: {esc.overdue} days
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {esc.citizens} affected citizens
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-neutral-500">Next Action</p>
                    <p className="text-sm font-medium text-neutral-900 dark:text-white">{esc.nextAction}</p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/issues/${esc.id}`}>
                      View
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}