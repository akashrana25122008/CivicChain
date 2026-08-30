'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function ErrorState({
  message = 'Failed to load data from the server.',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="text-center py-12 px-4">
      <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-900/20 mx-auto mb-3 flex items-center justify-center">
        <AlertTriangle className="w-6 h-6 text-red-400" aria-hidden="true" />
      </div>
      <p className="font-medium text-neutral-700 dark:text-neutral-300">Something went wrong</p>
      <p className="text-sm text-neutral-500 mt-1">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}