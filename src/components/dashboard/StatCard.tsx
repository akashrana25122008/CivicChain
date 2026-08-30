import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

const TONES: Record<string, { text: string; bg: string }> = {
  brand: { text: 'text-brand-600 dark:text-brand-400', bg: 'bg-brand-50 dark:bg-brand-900/20' },
  violet: { text: 'text-violet-500 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-900/20' },
  emerald: { text: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  amber: { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  red: { text: 'text-red-500 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
  cyan: { text: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-900/20' },
  neutral: { text: 'text-neutral-600 dark:text-neutral-400', bg: 'bg-neutral-100 dark:bg-neutral-800/60' },
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
  return (
    <Card
      variant="elevated"
      className="p-4 bg-white dark:bg-dark-bg-card border border-neutral-200 dark:border-dark-border"
    >
      <CardContent>
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-3', palette.bg)}>
          {Icon && <Icon className={cn('w-4 h-4', palette.text)} aria-hidden="true" />}
        </div>
        {loading ? (
          <div className="h-7 w-14 rounded bg-neutral-200 dark:bg-dark-border animate-pulse" aria-hidden="true" />
        ) : (
          <p className="text-2xl font-display font-bold text-neutral-900 dark:text-white">{value}</p>
        )}
        <p className="text-xs text-neutral-500 mt-1">{label}</p>
        {sub && <p className="text-[10px] text-neutral-400 mt-1 font-mono">{sub}</p>}
      </CardContent>
    </Card>
  );
}