'use client';

import { Card, CardContent } from '@/components/ui/Card';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

const TONES: Record<string, { text: string; bg: string; ring: string }> = {
  brand: { text: 'text-brand-600 dark:text-brand-400', bg: 'bg-brand-50 dark:bg-brand-900/20', ring: 'ring-brand-500/20' },
  violet: { text: 'text-violet-500 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-900/20', ring: 'ring-violet-500/20' },
  emerald: { text: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', ring: 'ring-emerald-500/20' },
  amber: { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', ring: 'ring-amber-500/20' },
  red: { text: 'text-red-500 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', ring: 'ring-red-500/20' },
  cyan: { text: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-900/20', ring: 'ring-cyan-500/20' },
  neutral: { text: 'text-neutral-600 dark:text-neutral-400', bg: 'bg-neutral-100 dark:bg-neutral-800/60', ring: 'ring-neutral-500/20' },
};

export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = 'brand',
  loading = false,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon?: LucideIcon;
  tone?: keyof typeof TONES;
  loading?: boolean;
}) {
  const Icon = icon;
  const palette = TONES[tone] ?? TONES.brand;

  const numericValue = typeof value === 'number' ? value : null;

  return (
    <Card
      variant="elevated"
      className="p-4 bg-white dark:bg-dark-bg-card border border-neutral-200/80 dark:border-dark-border/80 hover:border-neutral-300 dark:hover:border-dark-border-hover transition-colors duration-200 group"
    >
      <CardContent>
        <div className="flex items-start justify-between mb-3">
          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center ring-1', palette.bg, palette.ring)}>
            {Icon && <Icon className={cn('w-4.5 h-4.5', palette.text)} aria-hidden="true" />}
          </div>
          {sub && (
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono mt-1 max-w-[60%] truncate text-right">
              {sub}
            </span>
          )}
        </div>
        {loading ? (
          <div className="h-7 w-14 rounded-lg bg-neutral-100 dark:bg-dark-border animate-pulse" aria-hidden="true" />
        ) : numericValue !== null ? (
          <p className="text-2xl font-display font-bold text-neutral-900 dark:text-white tracking-tight">
            <AnimatedNumber value={numericValue} />
          </p>
        ) : (
          <p className="text-2xl font-display font-bold text-neutral-900 dark:text-white tracking-tight">{value}</p>
        )}
        <p className="text-[13px] text-neutral-500 dark:text-neutral-400 mt-1 font-medium">{label}</p>
      </CardContent>
    </Card>
  );
}