'use client';

import type { RiskHotspot } from '@/lib/risk/types';
import dynamic from 'next/dynamic';

const RiskHotspotMapInner = dynamic(
  () => import('./RiskHotspotMapInner').then((m) => m.RiskHotspotMapInner),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[420px] flex items-center justify-center text-sm text-slate-400">
        Loading risk map…
      </div>
    ),
  },
);

export interface RiskHotspotMapProps {
  hotspots: RiskHotspot[];
  days: number;
  onDaysChange: (days: number) => void;
  view: 'heatmap' | 'hotspots';
  onSelect?: ((hotspot: RiskHotspot | null) => void) | undefined;
}

export function RiskHotspotMap(props: RiskHotspotMapProps) {
  return <RiskHotspotMapInner {...props} />;
}