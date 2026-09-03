'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type * as LeafletTypes from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet/dist/leaflet.js';
import 'leaflet.markercluster/dist/leaflet.markercluster.js';
import 'leaflet.heat/dist/leaflet-heat.js';
import type { RiskHotspot } from '@/lib/risk/types';
import { REGION_CITY } from '@/lib/city';

// CivicMapInner compile-clean patterns — verified tsc-clean
const L = (globalThis as unknown as { L: typeof import('leaflet') }).L;

interface MarkerClusterLike extends LeafletTypes.Layer {
  clearLayers(): void;
  addLayers(layers: LeafletTypes.Layer[]): void;
}

interface HeatLayerLike extends LeafletTypes.Layer {
  setLatLngs(latLngs: Array<[number, number] | [number, number, number]>): this;
  setOptions(o: Record<string, unknown>): this;
}

const ClusterGroupL = L as unknown as {
  markerClusterGroup: (opts?: Record<string, unknown>) => MarkerClusterLike;
  heatLayer: (latlngs: Array<[number, number] | [number, number, number]>, opts?: Record<string, unknown>) => HeatLayerLike;
};

// Risk colors (same palette as RiskHeatmap)
const RISK_COLORS: Record<string, string> = {
  CRITICAL: '#dc2626',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#22c55e',
};

function pointWeight(score: number): number {
  return Math.min(1.0, Math.max(0.0, score / 100));
}

function formatHours(hours: number | null): string {
  if (hours == null) return '—';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function buildRiskPopup(hotspot: RiskHotspot): string {
  const { areaName, riskScore, riskLevel, activeIncidents, totalIncidents, repeatIncidentCount, slaBreaches, dominantCategory, trend, explanation, avgUnresolvedHours } = hotspot;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const riskBarPct = Math.min(100, riskScore);
  return `
<div style="font-family:system-ui,-apple-system,sans-serif;min-width:200px;max-width:260px">
  <div style="font-family:ui-monospace,monospace;font-size:11px;color:#2563eb;margin-bottom:2px">${areaName}</div>
  <div style="font-size:13px;font-weight:600;color:#111827;line-height:1.35">Risk Score: <span style="color:${RISK_COLORS[riskLevel]}">${riskScore}</span>/100</div>
  <div class="mt-1" style="width:${riskBarPct}%;height:4px;border-radius:2px;background:${RISK_COLORS[riskLevel]};overflow:hidden;margin-top:4px"></div>
  <div style="display:flex;align-items:center;gap:6px;margin-top:5px;font-size:12px;color:#4b5563">
    <span style="width:8px;height:8px;border-radius:50%;background:${RISK_COLORS[riskLevel]};flex-shrink:0"></span>
    <span class="text-xs">${riskLevel}</span>
  </div>
  <div class="text-xs text-neutral-600 space-y-1 mt-1">
    <div class="flex items-center gap-1.5">
      <span class="w-2 h-2 rounded${activeIncidents > 0 ? ' bg-green-500' : ' bg-neutral-300'}"></span>
      <span>Active: <span class="font-mono">${activeIncidents}</span></span>
    </div>
    <div class="flex items-center gap-1.5">
      <span class="w-2 h-2 rounded${repeatIncidentCount > 0 ? ' bg-orange-500' : ' bg-neutral-300'}"></span>
      <span>Repeat: <span class="font-mono">${repeatIncidentCount}</span></span>
    </div>
    <div class="flex items-center gap-1.5">
      <span class="w-2 h-2 rounded${slaBreaches > 0 ? ' bg-red-500' : ' bg-neutral-300'}"></span>
      <span>SLA Breaches: <span class="font-mono">${slaBreaches}</span></span>
    </div>
    ${avgUnresolvedHours !== undefined && avgUnresolvedHours > 0 ? (
      `<div class="flex items-center gap-1.5">
        <span class="w-2 h-2 rounded${avgUnresolvedHours > 48 ? ' bg-red-500' : avgUnresolvedHours > 24 ? ' bg-orange-500' : ' bg-emerald-500'}"></span>
        <span>Avg unresolved: <span class="font-mono">${formatHours(avgUnresolvedHours)}</span></span>
      </div>`
    ) : ''}
    <div class="flex items-center gap-1.5">
      <span class="w-2 h-2 rounded${!dominantCategory ? ' bg-neutral-300' : ' bg-emerald-500'}"></span>
      <span>Top: <span class="font-mono truncate">${dominantCategory || '—'}</span></span>
    </div>
  </div>
  <div class="text-xs text-neutral-500 mt-2">
    ${trend.direction !== 'STABLE' && trend.direction ? (
      `<div class="flex items-center gap-1">
        <span class="${trend.direction === 'INCREASING' ? 'text-red-600' : 'text-emerald-600'} text-xs font-medium">
          ${trend.direction === 'INCREASING' ? '▲' : '▼'} ${Math.abs(trend.percentage)}%
        </span>
      </div>`
    ) : ''}
  </div>
</div>`;
}

export function RiskHotspotMapInner({
  hotspots,
  view = 'hotspots' as const,
  onSelect,
}: {
  hotspots: RiskHotspot[];
  view?: 'heatmap' | 'hotspots';
  onSelect?: ((hotspot: RiskHotspot | null) => void) | undefined;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletTypes.Map | null>(null);
  const clusterRef = useRef<MarkerClusterLike | null>(null);
  const heatRef = useRef<HeatLayerLike | null>(null);
  const markersRef = useRef<(LeafletTypes.Marker | null)[]>([]);
  const lastKeyRef = useRef<string>('');
  const onSelectRef = useRef(onSelect);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const located = useMemo(() =>
    hotspots.map(h => ({
      areaName: h.areaName,
      latitude: h.latitude,
      longitude: h.longitude,
      riskScore: h.riskScore,
      riskLevel: h.riskLevel,
    })),
    [hotspots],
  );

  const pointsKey = useMemo(
    () => located.map((p) => `${p.areaName}:${p.latitude}:${p.riskScore}:${p.riskLevel}`).join('|'),
    [located],
  );

  const center: [number, number] =
    located.length > 0
      ? [located.reduce((s, p) => s + p.latitude, 0) / located.length, located.reduce((s, p) => s + p.longitude, 0) / located.length]
      : [REGION_CITY.center[1], REGION_CITY.center[0]];

  // Heat data shared between the data-sync and enable effects.
  const heatData = useMemo<Array<[number, number, number]>>(() => {
    return located.map((p) => [p.latitude, p.longitude, pointWeight(p.riskScore)]);
  }, [located]);

  // Build + own the base map once for the lifetime of the mount.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center,
      zoom: located.length === 1 ? 14 : located.length > 0 ? 11 : 9,
      zoomControl: false,
      attributionControl: true,
      maxZoom: 19,
    });
    L.control.zoom({ position: 'topright' }).addTo(map);

    const tileLayer = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      },
    ).addTo(map);

    tileLayer.on('tileerror', () => setOffline(true));
    map.on('error', () => setOffline(true));

    const cluster = ClusterGroupL.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 55,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      disableClusteringAtZoom: 16,
      iconCreateFunction: (clust: { getChildCount: () => number }) => {
        const count = clust.getChildCount();
        let size = 38;
        if (count >= 20) size = 54;
        else if (count >= 5) size = 46;
        return L.divIcon({
          html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:rgba(63,83,236,0.9);border:3px solid rgba(255,255,255,0.9);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:${count >= 10 ? 12 : 13}px;font-family:system-ui;box-shadow:0 2px 8px rgba(0,0,0,0.3)">${count}</div>`,
          className: 'marker-cluster-civic',
          iconSize: L.point(size, size),
        });
      },
    });

    const heat = ClusterGroupL.heatLayer([], {
      radius: 28,
      blur: 20,
      maxZoom: 16,
      max: 1.0,
      minOpacity: 0.4,
      gradient: {
        0.2: 'rgba(59,130,246,0.55)',
        0.4: 'rgba(16,185,129,0.65)',
        0.6: 'rgba(250,204,21,0.8)',
        0.8: 'rgba(245,158,11,0.9)',
        1.0: 'rgba(220,38,38,0.95)',
      },
    });

    map.addLayer(cluster as LeafletTypes.Layer);
    map.addLayer(heat as LeafletTypes.Layer);

    mapRef.current = map;
    clusterRef.current = cluster as MarkerClusterLike;
    heatRef.current = heat as HeatLayerLike;
    lastKeyRef.current = '';

    return () => {
      markersRef.current.forEach(m => (m as LeafletTypes.Marker)?.remove());
      cluster?.clearLayers?.();
      map.remove();
      mapRef.current = null;
      clusterRef.current = null;
      heatRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // (Re)build hotspot markers whenever the located set changes.
  useEffect(() => {
    const map = mapRef.current;
    const cluster = clusterRef.current;
    if (!map || !cluster) return;
    if (pointsKey === lastKeyRef.current) return;
    lastKeyRef.current = pointsKey;

    cluster.clearLayers?.();
    markersRef.current = [];

    const newMarkers = located.map((p) => {
      const hot = hotspots.find(h => h.areaName === p.areaName && h.riskScore === p.riskScore);
      const color = RISK_COLORS[hot?.riskLevel ?? 'LOW'];
      const incidentCount = hot?.totalIncidents ?? 0;
      const size = Math.max(9, Math.min(30, 9 + Math.log10(incidentCount + 1) * 8));
      const el = document.createElement('div');
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.borderRadius = '50%';
      el.style.backgroundColor = color;
      el.style.border = '3px solid #fff';
      el.style.boxShadow = `0 0 ${Math.max(1, size / 3)}px ${color}99`;
      el.style.cursor = 'pointer';

      const marker = L.marker([p.latitude, p.longitude], { icon: L.divIcon({ html: '', iconSize: L.point(size, size), iconAnchor: L.point(size / 2, size / 2) }) });
      marker.bindPopup(buildRiskPopup(hot! ?? hotspots.find(h => h.areaName === p.areaName)! as RiskHotspot), {
        maxWidth: 300,
        minWidth: 220,
        closeButton: true,
        autoClose: false,
        closeOnClick: false,
        className: 'risk-popup',
      });

      marker.on('click', () => {
        onSelectRef.current?.(hot ?? null);
        map.flyTo([hot!.latitude, hot!.longitude] as [number, number], Math.max(map.getZoom(), 14), { duration: 0.9 });
        try { marker.openPopup(); } catch { /* popup may not be attached yet under clustering */ }
      });

      return marker;
    });

    cluster.addLayers(newMarkers);
    markersRef.current = newMarkers;

    if (located.length === 1) {
      map.setView([located[0].latitude, located[0].longitude] as [number, number], 14);
    } else {
      const bounds = L.latLngBounds(located.map((p) => [p.latitude, p.longitude] as [number, number]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsKey]);

  // Keep the heat layer's weighted data in sync with the located set (only
  // while it is attached, otherwise setLatLngs redraws against a detached map).
  useEffect(() => {
    const heat = heatRef.current;
    if (!heat || view !== 'heatmap') return;
    heat.setLatLngs(heatData);
  }, [view, heatData]);

  // Toggle markers vs. heatmap layers with the active view.
  useEffect(() => {
    const map = mapRef.current;
    const cluster = clusterRef.current;
    const heat = heatRef.current;
    if (!map || !cluster || !heat) return;
    if (view === 'heatmap') {
      map.removeLayer(cluster as LeafletTypes.Layer);
      if (!map.hasLayer(heat as LeafletTypes.Layer)) map.addLayer(heat as LeafletTypes.Layer);
    } else {
      map.removeLayer(heat as LeafletTypes.Layer);
      if (!map.hasLayer(cluster as LeafletTypes.Layer)) map.addLayer(cluster as LeafletTypes.Layer);
    }
  }, [view]);

  return (
    <div className="relative w-full h-full min-h-[300px]" role="region" aria-label="Risk hotspot map">
      <style>{`
        .risk-popup .leaflet-popup-content-wrapper{border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.15);padding:0}
        .risk-popup .leaflet-popup-content{margin:12px 14px}
        .marker-cluster-small,.marker-cluster-medium,.marker-cluster-large{background:transparent!important}
        .marker-cluster-civic div{width:100%;height:100%;border-radius:50%}
      `}</style>
      <div ref={containerRef} className="absolute inset-0" />
      {offline && (
        <div className="absolute inset-x-4 bottom-4 p-3 rounded-lg bg-neutral-900/85 dark:bg-dark-bg/85 border border-neutral-200 dark:border-dark-border text-xs text-white dark:text-neutral-200">
          Map tiles could not be loaded (offline?). Report positions are still laid out by coordinate.
        </div>
      )}
      {hotspots.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-center text-neutral-500 dark:text-neutral-400 text-sm">
          No geographic risk data available.
        </div>
      )}
    </div>
  );
}