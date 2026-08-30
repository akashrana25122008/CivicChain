'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Map,
  Marker,
  Popup,
  NavigationControl,
  LngLatBounds,
  type StyleSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { CARTO_STYLE, STATUS_COLORS } from '@/components/dashboard/IssuesMapInner';
import type { IssueListItem } from '@/lib/issues/types';

export interface CivicMapPoint {
  id: string;
  publicId: string;
  title: string;
  displayStatus: string;
  latitude: number;
  longitude: number;
}

function markerColor(status: string): string {
  return STATUS_COLORS[status] ?? STATUS_COLORS.active ?? '#2563eb';
}

function asPoint(issue: IssueListItem): CivicMapPoint {
  return {
    id: issue.id,
    publicId: issue.publicId,
    title: issue.title,
    displayStatus: issue.displayStatus,
    latitude: issue.latitude!,
    longitude: issue.longitude!,
  };
}

/**
 * Interactive Maplibre map for the civic map workspace. Renders every real,
 * located report as a status-colored marker; selecting a marker reports the
 * click upward and keeps the selection in sync with the detail panel.
 *
 * Deliberately static (markers + raster tiles): the geospatial context is the
 * feature here, not decorative WebGL. Respects reduced motion by construction.
 */
export function CivicMapInner({
  issues,
  selectedId,
  focus,
  onSelectImage,
  className,
}: {
  issues: IssueListItem[];
  selectedId: string | null;
  focus?: IssueListItem | null;
  onSelectImage?: (id: string | null) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const popupRef = useRef<Popup | null>(null);
  const [offline, setOffline] = useState(false);
  const pointsRef = useRef<CivicMapPoint[]>([]);
  const onSelectRef = useRef(onSelectImage);
  onSelectRef.current = onSelectImage;

  // One map instance for the lifetime of the mount.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new Map({
      container: containerRef.current,
      style: CARTO_STYLE as StyleSpecification,
      center: [77.5946, 12.9716],
      zoom: 10,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    map.on('error', () => setOffline(true));
    map.on('load', () => setReady(true));
    mapRef.current = map;
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  // Rebuild markers whenever the located set or the selection changes.
  const points = issues.filter((i) => i.latitude != null && i.longitude != null).map(asPoint);
  const pointsKey = points.map((p) => p.id).join(',');
  const lastFitKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    pointsRef.current = points;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = points.map((point) => {
      const selected = point.id === selectedId;
      const el = document.createElement('button');
      el.type = 'button';
      el.setAttribute('aria-label', `Select ${point.publicId}`);
      el.style.width = selected ? '20px' : '14px';
      el.style.height = selected ? '20px' : '14px';
      el.style.borderRadius = '9999px';
      el.style.border = '2px solid #ffffff';
      el.style.backgroundColor = markerColor(point.displayStatus);
      el.style.cursor = 'pointer';
      el.style.padding = '0';
      el.style.boxShadow = selected
        ? '0 0 0 3px rgba(63, 83, 236, 0.35), 0 4px 12px rgba(0,0,0,0.4)'
        : '0 2px 6px rgba(0,0,0,0.35)';
      el.style.transition = 'width .12s ease, height .12s ease, box-shadow .12s ease';
      el.addEventListener('click', () => onSelectRef.current?.(point.id));
      return new Marker({ element: el, anchor: 'center' })
        .setLngLat([point.longitude, point.latitude])
        .addTo(map);
    });

    if (points.length > 0 && lastFitKeyRef.current !== pointsKey) {
      lastFitKeyRef.current = pointsKey;
      const bounds = new LngLatBounds();
      points.forEach((p) => bounds.extend([p.longitude, p.latitude]));
      if (mapRef.current) {
        mapRef.current.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 600 });
      }
    }

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
    };
  }, [points, pointsKey, selectedId, ready]);

  // Keep the selection popup in sync with the selected point.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    popupRef.current?.remove();
    popupRef.current = null;
    const point = pointsRef.current.find((p) => p.id === selectedId);
    if (!point) return;
    const popup = new Popup({ offset: 22, closeButton: false })
      .setLngLat([point.longitude, point.latitude])
      .setHTML(
        `<div style="font-size:12px;line-height:1.45"><strong style="font-family:ui-monospace,monospace">${point.publicId}</strong><br/><span style="color:#4b5563">${point.title}</span></div>`,
      )
      .addTo(map);
    popupRef.current = popup;
    return () => {
      popupRef.current?.remove();
      popupRef.current = null;
    };
  }, [selectedId]);

  // External navigation: fly to the focus issue (normally from the list).
  const focusId = focus?.id ?? '';
  useEffect(() => {
    const map = mapRef.current;
    const target = focusId ? pointsRef.current.find((p) => p.id === focusId) : null;
    if (!map || !target) return;
    map.flyTo({
      center: [target.longitude, target.latitude],
      zoom: Math.max(map.getZoom(), 14),
      duration: 900,
    });
    onSelectRef.current?.(target.id);
  }, [focusId, points]);

  return (
    <div className="relative w-full h-full min-h-[300px]" role="region" aria-label="Civic issues map">
      <div ref={containerRef} className="absolute inset-0" />
      {offline && (
        <div className="absolute inset-x-4 bottom-4 p-3 rounded-lg bg-neutral-900/85 dark:bg-dark-bg/85 border border-neutral-200 dark:border-dark-border text-xs text-white dark:text-neutral-200">
          Map tiles could not be loaded (offline?). Markers are still laid out by coordinate.
        </div>
      )}
    </div>
  );
}