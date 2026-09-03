'use client';

import { useEffect, useMemo, useRef } from 'react';
import type * as LeafletTypes from 'leaflet';
// Loading the UMD builds on the client is required: leaflet.markercluster
// registers itself on the global `L`, so we embed Leaflet's UMD build (which
// assigns `window.L`) and read that same global here. This keeps the plugin
// and the map code on a single Leaflet instance regardless of bundler.
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet/dist/leaflet.js';
import 'leaflet.markercluster/dist/leaflet.markercluster.js';
import type { IssueListItem } from '@/lib/issues/types';
import { REGION_CITY } from '@/lib/city';

/** Global Leaflet instance populated by the UMD build above. */
const L = (globalThis as unknown as { L: typeof import('leaflet') }).L;

interface MarkerClusterLike extends LeafletTypes.Layer {
  clearLayers(): void;
  addLayers(layers: LeafletTypes.Layer[]): void;
}
const ClusterGroupL = L as typeof L & {
  markerClusterGroup: (opts?: Record<string, unknown>) => MarkerClusterLike;
};

const CATEGORY_COLORS: Record<string, string> = {
  POTHOLE: '#f59e0b',
  GARBAGE: '#6b7280',
  WATER: '#3b82f6',
  STREETLIGHT: '#eab308',
  INFRASTRUCTURE: '#ef4444',
  DRAINAGE: '#06b6d4',
  OTHER: '#8b5cf6',
};

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: '#dc2626',
  HIGH: '#ef4444',
  MEDIUM: '#f59e0b',
  LOW: '#22c55e',
};

const CATEGORY_ICONS: Record<string, string> = {
  POTHOLE: '⚠️',
  GARBAGE: '🗑️',
  WATER: '💧',
  STREETLIGHT: '💡',
  INFRASTRUCTURE: '🏗️',
  DRAINAGE: '🌊',
  OTHER: '📌',
};

const STATUS_DOT_COLORS: Record<string, string> = {
  RESOLVED: '#10b981',
  REJECTED: '#9ca3af',
  ACTIVE: '#2563eb',
  ASSIGNED: '#8b5cf6',
  IN_PROGRESS: '#f59e0b',
  OPEN: '#3b82f6',
};

function catColor(cat: string): string {
  return CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.OTHER;
}

function sevColor(sev: string | null): string {
  return SEVERITY_COLORS[sev ?? ''] ?? '#6b7280';
}

function catIcon(cat: string): string {
  return CATEGORY_ICONS[cat] ?? CATEGORY_ICONS.OTHER;
}

function statusDot(status: string): string {
  return STATUS_DOT_COLORS[status] ?? '#2563eb';
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function fitAll(map: LeafletTypes.Map, issues: IssueListItem[]) {
  const located = issues.filter((i) => i.latitude != null && i.longitude != null);
  if (located.length === 0) return;
  if (located.length === 1) {
    map.setView([located[0].latitude!, located[0].longitude!], 14);
    return;
  }
  const bounds = L.latLngBounds(
    located.map((i) => [i.latitude!, i.longitude!] as [number, number]),
  );
  map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
}

function buildPopup(issue: IssueListItem): string {
  const cat = catIcon(issue.category);
  const dot = statusDot(issue.status);
  const sevDot = sevColor(issue.severity);
  const url = `/dashboard/issues/${issue.id}`;
  return `
<div style="font-family:system-ui,-apple-system,sans-serif;min-width:220px;max-width:280px;padding:2px 0">
  <div style="font-family:ui-monospace,monospace;font-size:11px;color:#6b7280;margin-bottom:2px">${issue.publicId}</div>
  <div style="font-size:13px;font-weight:600;color:#111827;line-height:1.35;margin-bottom:6px">${issue.title}</div>
  <div style="display:flex;flex-direction:column;gap:3px;font-size:12px;color:#374151">
    <div style="display:flex;align-items:center;gap:5px"><span>${cat}</span><span>${issue.categoryLabel || issue.category}</span></div>
    <div style="display:flex;align-items:center;gap:5px"><span style="width:7px;height:7px;border-radius:50%;background:${dot};flex-shrink:0"></span><span>${issue.statusLabel || issue.status}</span></div>
    ${issue.severityLabel ? `<div style="display:flex;align-items:center;gap:5px"><span style="width:7px;height:7px;border-radius:50%;background:${sevDot};flex-shrink:0"></span><span>${issue.severityLabel}</span></div>` : ''}
    <div style="display:flex;align-items:center;gap:5px;color:#6b7280"><span>📅</span><span>${formatDate(issue.createdAt)}</span></div>
  </div>
  <a href="${url}" style="display:inline-block;margin-top:8px;padding:5px 12px;background:#2563eb;color:#fff;border-radius:6px;font-size:12px;font-weight:500;text-decoration:none">View Details →</a>
</div>`;
}

export interface IssuesMapInnerProps {
  issues: IssueListItem[];
  center?: [number, number];
  zoom?: number;
  className?: string;
}

export function IssuesMapInner({
  issues,
  center,
  zoom,
  className,
}: IssuesMapInnerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletTypes.Map | null>(null);
  const clusterRef = useRef<MarkerClusterLike | null>(null);

  // Build a stable content key so the marker effect only re-runs when actual
  // marker data changes (not just because the parent re-renders with a new
  // array reference).
  const issuesKey = useMemo(() => {
    return issues
      .map((i) => `${i.id}:${i.latitude}:${i.longitude}:${i.category}:${i.severity}`)
      .join('|');
  }, [issues]);
  // Tracks the last data key that was pushed onto the current cluster, so a
  // fresh map (re)built under React StrictMode re-adds its markers once.
  const lastKeyRef = useRef<string>('');

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialCenter: [number, number] =
      center ??
      (issues.length > 0 && issues[0].latitude && issues[0].longitude
        ? [issues[0].latitude, issues[0].longitude]
        : [REGION_CITY.center[1], REGION_CITY.center[0]]);

    const initialZoom = zoom ?? (issues.length === 1 ? 14 : issues.length > 0 ? 11 : 10);

    const map = L.map(containerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      zoomControl: false,
      attributionControl: true,
      maxZoom: 19,
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      },
    ).addTo(map);

    const cluster = ClusterGroupL.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      disableClusteringAtZoom: 16,
      iconCreateFunction: (clust: { getChildCount: () => number }) => {
        const count = clust.getChildCount();
        let size = 36;
        if (count >= 20) size = 52;
        else if (count >= 5) size = 44;
        return L.divIcon({
          html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:rgba(37,99,235,0.85);border:3px solid rgba(255,255,255,0.9);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:${count >= 10 ? 12 : 13}px;font-family:system-ui;box-shadow:0 2px 8px rgba(0,0,0,0.3)">${count}</div>`,
          className: 'marker-cluster-civic',
          iconSize: L.point(size, size),
        });
      },
    });
    map.addLayer(cluster as LeafletTypes.Layer);

    mapRef.current = map;
    clusterRef.current = cluster as ReturnType<typeof ClusterGroupL.markerClusterGroup>;
    // Force the marker effect to repopulate whenever a fresh map/cluster is
    // created (important under React StrictMode double-mount, where the first
    // map is torn down and a second one built; without this the guard below
    // would skip re-adding markers to the surviving cluster).
    lastKeyRef.current = '';

    return () => {
      cluster.clearLayers?.();
      map.remove();
      mapRef.current = null;
      clusterRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const cluster = clusterRef.current;
    if (!map || !cluster) return;

    if (issuesKey === lastKeyRef.current) return;
    lastKeyRef.current = issuesKey;

    cluster.clearLayers?.();

    const located = issues.filter((i) => i.latitude != null && i.longitude != null);
    if (located.length === 0) return;

    const markers = located.map((issue) => {
      const color = catColor(issue.category);
      const isHigh = issue.severity === 'CRITICAL' || issue.severity === 'HIGH';
      const r = isHigh ? 9 : issue.severity === 'MEDIUM' ? 7 : 6;

      const el = L.divIcon({
        html: `<div style="width:${r * 2}px;height:${r * 2}px;border-radius:50%;background:${color};border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.35);${isHigh ? 'animation:cc-pulse 2s infinite;' : ''}"></div>`,
        className: '',
        iconSize: L.point(r * 2, r * 2),
        iconAnchor: L.point(r, r),
      });

      const m = L.marker([issue.latitude!, issue.longitude!], { icon: el });
      m.bindPopup(buildPopup(issue), {
        maxWidth: 280,
        minWidth: 220,
        closeButton: true,
        autoClose: false,
        closeOnClick: false,
        className: 'civic-popup',
      });
      return m;
    });

    cluster.addLayers(markers);
    // Fit the view to the report bounds whenever the markers are (re)built from
    // a real data change. Because popups use autoClose:false/closeOnClick:false
    // this won't stomp an open popup on unrelated re-renders (those short-circuit
    // above on the key guard).
    fitAll(map, issues);
  }, [issuesKey, issues]);

  return (
    <div className={className}>
      <style>{`
        @keyframes cc-pulse {
          0%,100%{box-shadow:0 1px 4px rgba(0,0,0,0.35)}
          50%{box-shadow:0 0 0 4px rgba(239,68,68,0.3),0 1px 4px rgba(0,0,0,0.35)}
        }
        .marker-cluster-small,.marker-cluster-medium,.marker-cluster-large{background:transparent!important}
        .marker-cluster-civic div{width:100%;height:100%;border-radius:50%}
        .civic-popup .leaflet-popup-content-wrapper{border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.15);padding:0}
        .civic-popup .leaflet-popup-content{margin:12px 14px}
        .civic-popup .leaflet-popup-tip{box-shadow:0 2px 6px rgba(0,0,0,0.1)}
        .civic-popup a:hover{background:#1d4ed8}
      `}</style>
      <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 280 }} />
    </div>
  );
}
