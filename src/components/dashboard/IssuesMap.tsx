'use client';

import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import type { IssueMapMarker } from './IssuesMapInner';

const IssuesMapInner = dynamic(() =>
  import('./IssuesMapInner').then((m) => m.IssuesMapInner),
{ ssr: false, loading: () => <div className="h-full min-h-[280px] flex items-center justify-center text-sm text-slate-400">Loading map…</div> });

export type { IssueMapMarker };

/**
 * SSR-safe wrapper around the lazy Maplibre panel. Always renders the real
 * base map (never a blank rectangle): when no located issues exist it still
 * shows the city's geographic context with a graduated empty/awaiting state
 * overlaying it, plus a hint that markers will appear once reports carry
 * coordinates.
 */
export function IssuesMap({
  issues,
  className,
  defaultCenter = [78.0322, 27.4924], // Mathura, Uttar Pradesh (regional default)
  defaultZoom = 10,
}: {
  issues: IssueMapMarker[];
  className?: string;
  defaultCenter?: [number, number];
  defaultZoom?: number;
}) {
  const located = issues.filter((i) => i.latitude != null && i.longitude != null);

  return (
    <div className={cn('relative overflow-hidden rounded-xl border border-neutral-200 dark:border-dark-border aspect-[16/9] bg-neutral-100 dark:bg-dark-bg', className)}>
      {/* The real map is ALWAYS rendered for geographic context, even with no points. */}
      <IssuesMapInner
        issues={located}
        center={located.length ? undefined : defaultCenter}
        zoom={located.length ? undefined : defaultZoom}
      />

      {located.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none bg-white/60 dark:bg-dark-bg/60 backdrop-blur-[1px]">
          <div className="text-center px-6">
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Awaiting civic network data</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-xs">
              Reports that include a location while reporting will appear on this live map.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
