'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { LoadingBlock } from '@/components/dashboard/LoadingBlock';
import { ErrorState } from '@/components/dashboard/ErrorState';
import { EmptyState } from '@/components/dashboard/EmptyState';

export interface TableColumn {
  key: string;
  label: string;
  className?: string;
}

export function Pagination({
  page,
  pageCount,
  total,
  onChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  onChange: (next: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs text-neutral-500">
        Page {page} of {pageCount} · {total} result{total === 1 ? '' : 's'}
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Previous
        </Button>
        <Button variant="secondary" size="sm" disabled={page >= pageCount} onClick={() => onChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

interface TableFrameProps {
  columns: TableColumn[];
  children: React.ReactNode;
  isLoading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyContent?: React.ReactNode;
  footer?: React.ReactNode;
}

export function TableFrame({
  columns,
  children,
  isLoading = false,
  error = false,
  onRetry,
  empty = false,
  emptyTitle,
  emptyDescription,
  emptyContent,
  footer,
}: TableFrameProps) {
  const showBody = !isLoading && !error && !empty;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 dark:border-dark-border text-left text-xs uppercase text-neutral-500">
            {columns.map((c) => (
              <th key={c.key} className={cn('px-4 py-3 font-medium whitespace-nowrap', c.className)}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        {showBody && <tbody className="divide-y divide-neutral-200 dark:divide-dark-border">{children}</tbody>}
      </table>

      {isLoading && (
        <div className="p-4">
          <LoadingBlock rows={4} />
        </div>
      )}
      {error && !isLoading && <ErrorState onRetry={onRetry} />}
      {empty && !error && !isLoading && (
        emptyContent ?? (
          <EmptyState
            title={emptyTitle ?? 'Nothing here yet'}
            description={emptyDescription ?? 'No records matched this view.'}
          />
        )
      )}
      {footer && <div className="border-t border-neutral-200 dark:border-dark-border px-4 py-3">{footer}</div>}
    </div>
  );
}