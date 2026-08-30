'use client';

import { useEffect, useRef, useState } from 'react';
import { Map, Marker, Popup, NavigationControl, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export interface IssueMapMarker {
  id: string;
  publicId: string;
  title: string;
  latitude: number;
  longitude: number;
  displayStatus: string;
}

const STATUS_COLORS: Record<string, string> = {
  resolved: '#10b981',
  rejected: '#9ca3af',
  brokenPromise: '#ef4444',
  atRisk: '#f59e0b',
  verificationPending: '#8b5cf6',
  promised: '#06b6d4',
  assigned: '#8b5cf6',
  onTrack: '#10b981',
  active: '#2563eb',
  partiallyResolved: '#f59e0b',
};

function markerColor(status: string): string {
  return STATUS_COLORS[status] ?? STATUS_COLORS.active;
}

const CARTO_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    'carto-voyager': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors © CARTO',
    },
  },
  layers: [{ id: 'carto-voyager', type: 'raster', source: 'carto-voyager' }],
};

/**
 * Lazy, purpose-built geospatial panel: real issue coordinates rendered as a
 * static Maplibre map (deliberate Tier-1 3D — geographic context that serves
 * the task, no decorative WebGL). Respects reduced motion by being static.
 */
export function IssuesMapInner({ issues }: { issues: IssueMapMarker[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || issues.length === 0) return;

    const sumLat = issues.reduce((s, i) => s + i.latitude, 0) / issues.length;
    const sumLng = issues.reduce((s, i) => s + i.longitude, 0) / issues.length;

    const map = new Map({
      container: containerRef.current,
      style: CARTO_STYLE,
      center: [sumLng, sumLat],
      zoom: issues.length === 1 ? 15 : 11,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    map.on('error', () => {
      setOffline(true);
    });
    mapRef.current = map;
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [issues]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = issues.map((issue) => {
      const popup = new Popup({ offset: 26 }).setHTML(
        `<strong class="font-mono">${issue.publicId}</strong><br/>${issue.title}`,
      );
      const marker = new Marker({ color: markerColor(issue.displayStatus) })
        .setLngLat([issue.longitude, issue.latitude])
        .setPopup(popup)
        .addTo(map);
      return marker;
    });
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
    };
  }, [issues]);

  return (
    <div className="relative w-full h-full min-h-[280px]" role="region" aria-label="Civic issues map">
      <div ref={containerRef} className="absolute inset-0" />
      {offline && (
        <div className="absolute inset-x-4 bottom-4 p-3 rounded-lg bg-neutral-900/85 dark:bg-dark-bg/85 border border-neutral-200 dark:border-dark-border text-xs text-white dark:text-neutral-200">
          Map tiles could not be loaded (offline?). Markers are still laid out by coordinate.
        </div>
      )}
    </div>
  );
}