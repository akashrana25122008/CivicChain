import { cn } from '@/lib/utils';

export function LoadingBlock({
  rows = 3,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn('space-y-4', className)} aria-hidden="true" role="status">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 rounded-xl bg-neutral-100 dark:bg-dark-border animate-pulse" />
      ))}
    </div>
  );
}