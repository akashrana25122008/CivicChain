'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { TrendingUp, Droplets, Trash2, Construction, CloudRain } from 'lucide-react';

const RISKS = [
  { ward: 'WARD 17', type: 'Waterlogging Risk', level: 'HIGH', levelColor: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800', icon: Droplets, historical: 84, signal: 'High', trend: '+32%' },
  { ward: 'WARD 4', type: 'Drain Blockage Risk', level: 'HIGH', levelColor: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800', icon: CloudRain, historical: 67, signal: 'Elevated', trend: '+18%' },
  { ward: 'WARD 12', type: 'Road Damage Risk', level: 'MEDIUM', levelColor: 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/20 dark:border-amber-800', icon: Construction, historical: 45, signal: 'Moderate', trend: '+8%' },
  { ward: 'WARD 8', type: 'Garbage Accumulation Risk', level: 'HIGH', levelColor: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800', icon: Trash2, historical: 92, signal: 'High', trend: '+24%' },
  { ward: 'WARD 21', type: 'Infrastructure Stress', level: 'MEDIUM', levelColor: 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/20 dark:border-amber-800', icon: TrendingUp, historical: 56, signal: 'Moderate', trend: '+12%' },
];

export default function RiskPage() {
  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-neutral-900 dark:text-white">Civic Risk Intelligence</h1>
        <p className="text-neutral-600 dark:text-neutral-400 mt-2">
          Identify emerging areas of concern before they become widespread civic problems.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {RISKS.map((risk) => {
          const Icon = risk.icon;
          return (
            <Card key={risk.ward + risk.type} variant="elevated" className="p-6 bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-mono text-neutral-500 tracking-wider">{risk.ward}</span>
                  <span className={cn('px-2 py-1 rounded text-xs font-bold font-mono border', risk.levelColor)}>
                    {risk.level}
                  </span>
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-dark-border flex items-center justify-center">
                    <Icon className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                  </div>
                  <h3 className="font-display text-lg font-semibold text-neutral-900 dark:text-white">{risk.type}</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">Historical Reports</span>
                    <span className="font-mono font-medium text-neutral-900 dark:text-white">{risk.historical}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">Environmental Signal</span>
                    <span className={cn('font-mono font-medium', risk.signal === 'High' ? 'text-red-500' : 'text-amber-500')}>{risk.signal}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">Complaint Trend</span>
                    <span className={cn('font-mono font-medium', risk.trend.startsWith('+') ? 'text-red-500' : 'text-emerald-500')}>{risk.trend}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-8 p-6 rounded-2xl bg-neutral-50 dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border">
        <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed text-center">
          <strong>Note:</strong> Predictive intelligence uses <em>risk signals</em> and <em>geospatial analysis</em>. This is prototype intelligence — not real-time prediction. Actual accuracy depends on data quality and model validation.
        </p>
      </div>
    </div>
  );
}