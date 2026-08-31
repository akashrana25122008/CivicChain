'use client';

import { useEffect, useRef, useState } from 'react';
import { Map, Marker, Popup, NavigationControl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { CARTO_STYLE } from '@/components/dashboard/IssuesMapInner';

const SLA_COLORS: Record<string, string> = {
  BREACHED: '#ef4444',
  AT_RISK: '#f59e0b',
  ON_TRACK: '#10b981',
  RESOLVED: '#9ca3af',
};

function slaColor(sla: string): string {
  return SLA_COLORS[sla] ?? '#2563eb';
}

export interface CommandCenterMapMarker {
  id: string;
  publicId: string;
  title: string;
  latitude: number;
  longitude: number;
  displayStatus: string;
  severityLabel: string | null;
  categoryLabel: string;
  slaState: string;
  riskLevel: string | null;
}

export function CommandCenterMap({
  markers,
  onSelect,
  selectedId,
  className,
}: {
  markers: CommandCenterMapMarker[];
  onSelect?: (id: string) => void;
  selectedId?: string | null;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [offline, setOffline] = useState(false);

  const center: [number, number] =
    markers.length > 0
      ? [
          markers.reduce((s, m) => s + m.longitude, 0) / markers.length,
          markers.reduce((s, m) => s + m.latitude, 0) / markers.length,
        ]
      : [78.0322, 27.4924];

  const zoom = markers.length === 1 ? 15 : markers.length > 0 ? 11 : 9;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new Map({
      container: containerRef.current,
      style: CARTO_STYLE,
      center,
      zoom,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    map.on('error', () => setOffline(true));
    mapRef.current = map;
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = markers.map((marker) => {
      const popup = new Popup({ offset: 26 }).setHTML(
        `<div style="font-family:system-ui;min-width:140px">
          <strong style="font-family:monospace;font-size:11px;color:#2563eb">${marker.publicId}</strong><br/>
          <span style="font-size:13px">${marker.title}</span><br/>
          <span style="font-size:11px;color:#666">${marker.categoryLabel}</span>
          <div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap">
            <span style="font-size:10px;padding:2px 6px;border-radius:9999px;background:${slaColor(marker.slaState)}22;color:${slaColor(marker.slaState)};border:1px solid ${slaColor(marker.slaState)}44">${marker.slaState.replace('_', ' ')}</span>
            ${marker.severityLabel ? `<span style="font-size:10px;padding:2px 6px;border-radius:9999px;background:#f3f4f6;color:#374151">${marker.severityLabel}</span>` : ''}
          </div>
        </div>`,
      );
      const el = document.createElement('div');
      el.style.cssText = `width:14px;height:14px;border-radius:50%;background:${slaColor(marker.slaState)};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.3);cursor:pointer;${marker.id === selectedId ? 'outline:3px solid #2563eb;outline-offset:2px;' : ''}`;
      el.addEventListener('click', () => onSelect?.(marker.id));
      return new Marker({ element: el })
        .setLngLat([marker.longitude, marker.latitude])
        .setPopup(popup)
        .addTo(map);
    });
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
    };
  }, [markers, onSelect, selectedId]);

  return (
    <div className={`relative overflow-hidden rounded-xl border border-neutral-200 dark:border-dark-border bg-neutral-100 dark:bg-dark-bg ${className ?? ''}`}>
      <div ref={containerRef} className="absolute inset-0" />
      {offline && (
        <div className="absolute inset-x-4 bottom-4 p-3 rounded-lg bg-white/95 dark:bg-dark-bg/95 border border-neutral-200 dark:border-dark-border text-xs text-neutral-700 dark:text-neutral-200 shadow-sm">
          Map tiles could not be loaded (offline?). Markers are still laid out by coordinate.
        </div>
      )}
    </div>
  );
}
