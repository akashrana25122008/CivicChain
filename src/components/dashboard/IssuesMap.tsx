'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { REGION_CITY } from '@/lib/city';
import type { IssueListItem } from '@/lib/issues/types';

const IssuesMapInner = dynamic(
  () => import('./IssuesMapInner').then((m) => m.IssuesMapInner),
  {
    ssr: false,
    loading: () => (
      <div className="h-full min-h-[280px] flex items-center justify-center text-sm text-slate-400">
        Loading map…
      </div>
    ),
  },
);


export function IssuesMap({
  issues,
  className,
  defaultCenter = REGION_CITY.center,
  defaultZoom = 10,
}: {
  issues: IssueListItem[];
  className?: string;
  defaultCenter?: [number, number];
  defaultZoom?: number;
}) {
  const located = useMemo(
    () => issues.filter((i) => i.latitude != null && i.longitude != null),
    [issues],
  );

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-neutral-200 dark:border-dark-bg-card',
        'bg-neutral-100 dark:bg-dark-bg',
        className,
      )}
    >
      <IssuesMapInner
        issues={located}
        center={located.length ? undefined : defaultCenter}
        zoom={located.length ? undefined : defaultZoom}
        className="w-full h-full"
      />
    </div>
  );
}
