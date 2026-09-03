'use client';

import dynamic from 'next/dynamic';
import type { Severity, PriorityLevel } from '../../../generated/prisma/client';

const CommandMapInner = dynamic(
  () => import('./CommandMapInner').then((m) => m.CommandMapInner),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[420px] flex items-center justify-center text-sm text-slate-400">
        Loading incident map…
      </div>
    ),
  },
);

export interface CommandMapPoint {
  id: string;
  publicId: string;
  title: string;
  latitude: number;
  longitude: number;
  severity: Severity | null;
  priorityLevel: PriorityLevel | null;
  /** Optional rich detail shown in the contextual panel + popup. */
  detail?: {
    categoryLabel: string | null;
    severityLabel: string | null;
    priorityLevelLabel: string | null;
    location: string | null;
    statusLabel: string;
    departmentName: string | null;
    assigned: boolean;
    slaState: string;
    slaRemainingLabel: string | null;
    timeLabel: string;
    attentionLevel: string;
  } | null;
}

/**
 * Live Incident Command Map — a real-time operational Leaflet panel driven by
 * the same live command-center dataset as the Incident Index. Selecting a
 * marker (or an Incident Index row) highlights the marker, flies to it, and
 * opens its information popup.
 */
export function CommandMap({
  points,
  selectedId,
  onSelect,
}: {
  points: CommandMapPoint[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  return (
    <CommandMapInner points={points} selectedId={selectedId} onSelect={onSelect} />
  );
}
