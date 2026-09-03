'use client';

import { useEffect, useRef, useState } from 'react';
import { Map, Marker, Popup, NavigationControl, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { RiskHotspot } from '@/lib/risk/types';

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
 * Risk Hotspot Map — MapLibre map with risk-level gradient markers.
 *
 * Reuses the same CARTO raster basemap as the existing Civic Map. Each hotspot
 * is rendered as a colored dot sized/colored by risk level. Clicking opens a
 * popup with the area's key risk metrics.
 */

const RISK_COLORS: Record<string, string> = {
  CRITICAL: '#dc2626',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#22c55e',
};

/** Marker sizes (px) per risk level. */
const RISK_SIZES: Record<string, number> = {
  CRITICAL: 22,
  HIGH: 18,
  MEDIUM: 14,
  LOW: 10,
};

interface RiskHeatmapProps {
  hotspots: RiskHotspot[];
  center?: [number, number];
  zoom?: number;
}

export function RiskHeatmap({ hotspots, center, zoom }: RiskHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [offline, setOffline] = useState(false);

  const mapCenter: [number, number] =
    center ??
    (hotspots.length > 0
      ? [
          hotspots.reduce((s, h) => s + h.longitude, 0) / hotspots.length,
          hotspots.reduce((s, h) => s + h.latitude, 0) / hotspots.length,
        ]
      : [78.0322, 27.4924]);
  const mapZoom = zoom ?? (hotspots.length === 1 ? 15 : hotspots.length > 0 ? 11 : 9);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new Map({
      container: containerRef.current,
      style: CARTO_STYLE as StyleSpecification,
      center: mapCenter,
      zoom: mapZoom,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    map.on('error', () => setOffline(true));
    mapRef.current = map;
    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotspots]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = hotspots.map(hotspot => {
      const color = RISK_COLORS[hotspot.riskLevel] ?? RISK_COLORS.MEDIUM;
      const size = RISK_SIZES[hotspot.riskLevel] ?? RISK_SIZES.MEDIUM;

      const popup = new Popup({ offset: 26, maxWidth: '280px', closeButton: true }).setHTML(`
        <div class="p-1">
          <div class="flex items-center justify-between mb-1">
            <strong class="font-display text-sm">${hotspot.areaName}</strong>
            <span class="text-xs font-bold font-mono px-1.5 py-0.5 rounded"
              style="background:${color}1a;color:${color}">${hotspot.riskLevel}</span>
          </div>
          <div class="text-xs text-neutral-600 space-y-0.5">
            <div>Risk Score: <span class="font-mono font-semibold">${hotspot.riskScore}</span>/100</div>
            <div>Active: <span class="font-mono font-semibold">${hotspot.activeIncidents}</span></div>
            <div>Total: <span class="font-mono font-semibold">${hotspot.totalIncidents}</span></div>
            <div>Repeat: <span class="font-mono font-semibold">${hotspot.repeatIncidentCount}</span></div>
            <div>SLA Breaches: <span class="font-mono font-semibold">${hotspot.slaBreaches}</span></div>
            <div>Top: <span class="font-mono font-semibold">${hotspot.dominantCategory}</span></div>
          </div>
        </div>
      `);

      const el = document.createElement('div');
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.borderRadius = '50%';
      el.style.backgroundColor = color;
      el.style.border = `3px solid ${color}55`;
      el.style.boxShadow = `0 0 ${size / 2}px ${color}99`;
      el.style.cursor = 'pointer';

      const marker = new Marker({ element: el })
        .setLngLat([hotspot.longitude, hotspot.latitude])
        .setPopup(popup)
        .addTo(map);

      return marker;
    });
    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
    };
  }, [hotspots]);

  return (
    <div className="relative w-full h-full min-h-[280px]" role="region" aria-label="Risk hotspots map">
      <div ref={containerRef} className="absolute inset-0" />
      {offline && (
        <div className="absolute inset-x-4 bottom-4 p-3 rounded-lg bg-white/95 dark:bg-dark-bg/95 border border-neutral-200 dark:border-dark-border text-xs text-neutral-700 dark:text-neutral-200 shadow-sm">
          Map tiles could not be loaded (offline?). Risk markers are still laid out by coordinate.
        </div>
      )}
    </div>
  );
}
