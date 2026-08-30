'use client';

import dynamic from 'next/dynamic';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/dashboard/EmptyState';
import type { IssueMapMarker } from './IssuesMapInner';

const IssuesMapInner = dynamic(() =>
  import('./IssuesMapInner').then((m) => m.IssuesMapInner),
{ ssr: false, loading: () => <div className="h-full min-h-[280px] flex items-center justify-center text-sm text-neutral-400">Loading map…</div> });

export type { IssueMapMarker };

/**
 * SSR-safe wrapper around the lazy Maplibre panel. Renders an honest empty
 * state when none of the issues carry coordinates.
 */
export function IssuesMap({
  issues,
  className,
}: {
  issues: IssueMapMarker[];
  className?: string;
}) {
  const located = issues.filter((i) => i.latitude != null && i.longitude != null);
  if (located.length === 0) {
    return (
      <EmptyState
        icon={MapPin}
        title="No map points yet"
        description="Reports that include a location while reporting appear here."
      />
    );
  }
  return (
    <div className={cn('relative overflow-hidden rounded-xl border border-neutral-200 dark:border-dark-border aspect-[16/9]', className)}>
      <IssuesMapInner issues={located} />
    </div>
  );
}