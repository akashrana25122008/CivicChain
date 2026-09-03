'use client';

import { Card, CardContent } from '@/components/ui/Card';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

/**
 * Command Metric Card — enhanced stat card for the Command Center with:
 * - Layered surfaces with depth
 * - Animated data transitions
 * - Severity-responsive color emphasis
 * - Compact, operational aesthetic
 *
 * Not a generic SaaS card. Designed for command center readability.
 */

const TONES: Record<string, {
  text: string;
  bg: string;
  ring: string;
  accent: string;
  border: string;
}> = {
  brand: { text: 'text-brand-600 dark:text-brand-400', bg: 'bg-brand-50 dark:bg-brand-900/20', ring: 'ring-brand-500/20', accent: 'bg-brand-500', border: 'border-l-brand-500' },
  violet: { text: 'text-violet-500 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-900/20', ring: 'ring-violet-500/20', accent: 'bg-violet-500', border: 'border-l-violet-500' },
  emerald: { text: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', ring: 'ring-emerald-500/20', accent: 'bg-emerald-500', border: 'border-l-emerald-500' },
  amber: { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', ring: 'ring-amber-500/20', accent: 'bg-amber-500', border: 'border-l-amber-500' },
  red: { text: 'text-red-500 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', ring: 'ring-red-500/20', accent: 'bg-red-500', border: 'border-l-red-500' },
  cyan: { text: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-900/20', ring: 'ring-cyan-500/20', accent: 'bg-cyan-500', border: 'border-l-cyan-500' },
  teal: { text: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-900/20', ring: 'ring-teal-500/20', accent: 'bg-teal-500', border: 'border-l-teal-500' },
  neutral: { text: 'text-neutral-600 dark:text-neutral-400', bg: 'bg-neutral-100 dark:bg-neutral-800/60', ring: 'ring-neutral-500/20', accent: 'bg-neutral-400', border: 'border-l-neutral-400' },
};

export function CommandStatCard({
  label,
  value,
  sub,
  icon,
  tone = 'brand',
  loading = false,
  critical = false,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon?: LucideIcon;
  tone?: keyof typeof TONES;
  loading?: boolean;
  critical?: boolean;
  onClick?: () => void;
}) {
  const Icon = icon;
  const palette = TONES[tone] ?? TONES.brand;
  const numericValue = typeof value === 'number' ? value : null;

  return (
    <Card
      variant="elevated"
      className={cn(
        'bg-white dark:bg-dark-bg-card border border-neutral-200/80 dark:border-dark-border/80',
        'border-l-[3px]',
        palette.border,
        'transition-all duration-200 group',
        onClick && 'cursor-pointer hover:shadow-md dark:hover:shadow-dark-md hover:border-neutral-300 dark:hover:border-dark-border-hover',
        critical && 'ring-1 ring-red-200 dark:ring-red-900/40',
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center ring-1', palette.bg, palette.ring)}>
            {Icon && <Icon className={cn('w-4 h-4', palette.text)} aria-hidden="true" />}
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
