'use client';

import useSWR from 'swr';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { CommandIntelligencePanel } from '@/components/command/CommandIntelligencePanel';
import { LoadingBlock } from '@/components/dashboard/LoadingBlock';
import { ErrorState } from '@/components/dashboard/ErrorState';
import { Button } from '@/components/ui/Button';
import { RefreshCw } from 'lucide-react';
import { useState, useMemo } from 'react';
import type { CommandMapPoint } from '@/components/command/CommandMap';

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
});

interface MapData {
  points: Array<{
    id: string;
    publicId: string;
    title: string;
    latitude: number;
    longitude: number;
    severity: string | null;
    priorityLevel: string | null;
    detail: {
      categoryLabel: string;
      severityLabel: string | null;
      priorityLevelLabel: string | null;
      location: string | null;
      statusLabel: string;
      departmentName: string | null;
      assigned: boolean;
      slaState: string;
      slaRemainingLabel: string | null;
      timeLabel: string;
      attentionLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    };
  }>;
  center: { lat: number; lng: number } | null;
}

export default function AdminMapPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, error, isLoading, mutate } = useSWR<MapData>(
    '/api/map?admin=1',
    fetcher,
    { refreshInterval: 30_000 },
  );

  const mapPoints = useMemo<CommandMapPoint[]>(
    () =>
      (data?.points ?? []).map((p) => ({
        id: p.id,
        publicId: p.publicId,
        title: p.title,
        latitude: p.latitude,
        longitude: p.longitude,
        severity: p.severity as CommandMapPoint['severity'],
        priorityLevel: p.priorityLevel as CommandMapPoint['priorityLevel'],
        detail: p.detail,
      })),
    [data],
  );

  const scenePoints = useMemo(
    () =>
      (data?.points ?? []).map((p) => ({
        id: p.id,
        lat: p.latitude,
        lng: p.longitude,
        attentionLevel: p.detail.attentionLevel,
        severity: p.severity,
      })),
    [data],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Admin workspace"
        title="Civic Intelligence Map"
        description="Geographic overview of all civic activity with 2D/3D intelligence views."
      >
        <Button variant="outline" size="sm" onClick={() => mutate()}>
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </PageHeader>

      {error && <ErrorState onRetry={() => mutate()} />}
      {isLoading && !data && <LoadingBlock rows={3} />}

      {data && (
        <CommandIntelligencePanel
          mapPoints={mapPoints}
          selectedId={selectedId}
          onSelectIssue={setSelectedId}
          mapContext={{
            points: scenePoints,
            center: data.center,
          }}
        />
      )}
    </div>
  );
}
