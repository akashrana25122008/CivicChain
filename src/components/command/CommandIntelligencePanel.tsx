'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Map as MapIcon, Box } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { CommandMap, type CommandMapPoint } from '@/components/command/CommandMap';
import { CommandCenterScene } from '@/components/three/CommandCenterScene';
import { cn } from '@/lib/utils';

/**
 * Command Intelligence Panel — hybrid 2D/3D geographic intelligence for the
 * Command Center. Users toggle between practical 2D mapping (Leaflet) and
 * spatial 3D visualization (Three.js).
 *
 * The 3D view provides spatial understanding of issue concentration and severity
 * that 2D maps cannot convey. The 2D view provides geographic precision.
 */

interface IntelligencePanelProps {
  mapPoints: CommandMapPoint[];
  selectedId: string | null;
  onSelectIssue: (id: string | null) => void;
  mapContext: {
    points: Array<{
      id: string;
      lat: number;
      lng: number;
      attentionLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
      severity: string | null;
    }>;
    center: { lat: number; lng: number } | null;
  };
}

type ViewMode = '2d' | '3d';

export function CommandIntelligencePanel({
  mapPoints,
  selectedId,
  onSelectIssue,
  mapContext,
}: IntelligencePanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('2d');

  const scenePoints = useMemo(() =>
    mapContext.points.map((p) => ({
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      severity: p.severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null,
      attentionLevel: p.attentionLevel,
    })),
    [mapContext.points],
  );

  return (
    <Card variant="elevated" className="bg-white dark:bg-dark-bg-card border border-neutral-200/80 dark:border-dark-border/80 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <div>
          <CardTitle as="h2" className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
            {viewMode === '3d' ? (
              <Box className="w-4 h-4 text-violet-500" />
            ) : (
              <MapIcon className="w-4 h-4 text-brand-500" />
            )}
            {viewMode === '3d' ? 'Spatial Intelligence' : 'Live Incident Command Map'}
          </CardTitle>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
            {viewMode === '3d'
              ? '3D visualization of geographic issue concentration and severity'
              : 'Real-time civic activity and incident intelligence'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-0.5 rounded-lg border border-neutral-200 dark:border-dark-border p-0.5 bg-neutral-50 dark:bg-dark-bg">
            <button
              type="button"
              onClick={() => setViewMode('2d')}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                viewMode === '2d'
                  ? 'bg-white dark:bg-dark-bg-card text-neutral-900 dark:text-white shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300',
              )}
            >
              <MapIcon className="w-3.5 h-3.5 inline mr-1" />
              Map
            </button>
            <button
              type="button"
              onClick={() => setViewMode('3d')}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                viewMode === '3d'
                  ? 'bg-white dark:bg-dark-bg-card text-neutral-900 dark:text-white shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300',
              )}
            >
              <Box className="w-3.5 h-3.5 inline mr-1" />
              3D
            </button>
          </div>
          <Link href="/admin/map" className="text-xs text-brand-600 dark:text-brand-400 flex items-center gap-1 hover:underline">
            Full map <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative h-[350px] md:h-[450px]">
          {viewMode === '2d' ? (
            <CommandMap
              points={mapPoints}
              selectedId={selectedId}
              onSelect={(id) => onSelectIssue(id || null)}
            />
          ) : (
            <CommandCenterScene
              points={scenePoints}
              center={mapContext.center}
              className="w-full h-full"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
