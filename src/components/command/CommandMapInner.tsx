'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { REGION_CITY } from '@/lib/city';
import type { CommandMapPoint } from './CommandMap';

/** Global Leaflet instance populated by the UMD build above. */
const L = (globalThis as unknown as { L: typeof import('leaflet') }).L;

interface MarkerClusterLike extends LeafletTypes.Layer {
  clearLayers(): void;
  addLayers(layers: LeafletTypes.Layer[]): void;
  zoomToShowLayer(layer: LeafletTypes.Layer, cb?: () => void): void;
}
const ClusterGroupL = L as typeof L & {
  markerClusterGroup: (opts?: Record<string, unknown>) => MarkerClusterLike;
};

const SEVERITY_GLYPH: Record<string, string> = {
  CRITICAL: '#dc2626',
  HIGH: '#f59e0b',
  MEDIUM: '#3f53ec',
  LOW: '#16a34a',
};

const PRIORITY_GLYPH: Record<string, string> = {
  CRITICAL: '#dc2626',
  HIGH: '#f59e0b',
  MEDIUM: '#3f53ec',
  LOW: '#16a34a',
};

function pointColor(p: CommandMapPoint): string {
  if (p.severity) return SEVERITY_GLYPH[p.severity] ?? SEVERITY_GLYPH.LOW;
  if (p.priorityLevel) return PRIORITY_GLYPH[p.priorityLevel] ?? PRIORITY_GLYPH.LOW;
  return '#3f53ec';
}

function attentionTone(level: string): 'red' | 'amber' | 'brand' | 'emerald' {
  if (level === 'CRITICAL') return 'red';
  if (level === 'HIGH') return 'amber';
  if (level === 'MEDIUM') return 'brand';
  return 'emerald';
}

/**
 * Live Incident Command Map — Leaflet + OpenStreetMap operational panel with
 * severity-aware markers and full marker popups. Selecting a marker (or a row
 * in the Incident Index) highlights the matching marker, flies to it, and opens
 * its information popup. Data is entirely real, driven by the admin
 * command-center API.
 */
export function CommandMapInner({
  points,
  selectedId,
  onSelect,
}: {
  points: CommandMapPoint[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const reduce = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletTypes.Map | null>(null);
  const clusterRef = useRef<MarkerClusterLike | null>(null);
  const markersRef = useRef<Map<string, LeafletTypes.Marker>>(new Map());
  const [offline, setOffline] = useState(false);

  const located = useMemo(
    () =>
      points.filter(
        (p) =>
          p.latitude != null &&
          p.longitude != null &&
          Number.isFinite(p.latitude) &&
          Number.isFinite(p.longitude) &&
          Math.abs(p.latitude) <= 90 &&
          Math.abs(p.longitude) <= 180,
      ),
    [points],
  );

  const selected = located.find((p) => p.id === selectedId) ?? null;

  const center: [number, number] =
    located.length > 0
      ? [
          located.reduce((s, p) => s + p.longitude, 0) / located.length,
          located.reduce((s, p) => s + p.latitude, 0) / located.length,
        ]
      : REGION_CITY.center;

  // Build the base map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [center[1], center[0]],
      zoom: located.length === 1 ? 14 : located.length > 0 ? 10 : 8,
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
          html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:rgba(37,99,235,0.9);border:3px solid rgba(255,255,255,0.9);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:${count >= 10 ? 12 : 13}px;font-family:system-ui;box-shadow:0 2px 8px rgba(0,0,0,0.3)">${count}</div>`,
          className: 'marker-cluster-civic',
          iconSize: L.point(size, size),
        });
      },
    });
    map.addLayer(cluster as LeafletTypes.Layer);

    mapRef.current = map;
    clusterRef.current = cluster;
    // StrictMode (dev) double-mounts: a fresh map here must not be short-
    // circuited by the marker-build key guard from the previous mount.
    lastKeyRef.current = '';

    return () => {
      markersRef.current.clear();
      cluster.clearLayers?.();
      map.remove();
      mapRef.current = null;
      clusterRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Data key so the marker effect only rebuilds on real data changes.
  const pointsKey = useMemo(
    () =>
      located
        .map((p) => `${p.id}:${p.latitude}:${p.longitude}:${p.severity ?? ''}:${p.priorityLevel ?? ''}`)
        .join('|'),
    [located],
  );
  const lastKeyRef = useRef<string>('');
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  // (Re)build markers whenever data changes.
  useEffect(() => {
    const map = mapRef.current;
    const cluster = clusterRef.current;
    if (!map || !cluster) return;
    if (pointsKey === lastKeyRef.current) return;
    // Ref-guard write is the standard StrictMode-safe "reset on new key" idiom
    // (see IssuesMapInner) for the shared markers/cluster refs below.
    // eslint-disable-next-line react-hooks/immutability
    lastKeyRef.current = pointsKey;

    cluster.clearLayers?.();
    markersRef.current.clear();

    if (located.length === 0) return;

    const markers = located.map((p) => {
      const color = pointColor(p);
      const isCritical = p.severity === 'CRITICAL' || p.priorityLevel === 'CRITICAL';
      const r = 8;

      const el = L.divIcon({
        html: `<div style="width:${r * 2}px;height:${r * 2}px;border-radius:50%;background:${color};border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.35);${isCritical ? 'animation:cmd-pulse 2s infinite;' : ''}"></div>`,
        className: '',
        iconSize: L.point(r * 2, r * 2),
        iconAnchor: L.point(r, r),
      });

      const m = L.marker([p.latitude!, p.longitude!], { icon: el });
      m.bindPopup(buildPopup(p), {
        maxWidth: 300,
        minWidth: 240,
        closeButton: true,
        autoClose: false,
        closeOnClick: false,
        className: 'cmd-popup',
      });
      m.on('click', () => onSelectRef.current?.(p.id));
      return m;
    });

    cluster.addLayers(markers);
    markersRef.current = new Map(markers.map((m, i) => [located[i].id, m]));

    // Fit to bounds when markers are (re)built from a data change.
    if (located.length === 1) {
      map.setView([located[0].latitude!, located[0].longitude!], 14);
    } else {
      const bounds = L.latLngBounds(located.map((p) => [p.latitude!, p.longitude!] as [number, number]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsKey]);

  // Fly to + open popup + highlight whenever the selected id changes.
  useEffect(() => {
    const map = mapRef.current;
    const cluster = clusterRef.current;
    if (!map || !selected) return;
    const mk = markersRef.current.get(selected.id);
    if (mk && selected.latitude != null && selected.longitude != null) {
      map.flyTo([selected.latitude, selected.longitude], Math.max(map.getZoom(), 13), {
        duration: reduce ? 0 : 0.8,
      });
      // Reveal clustered markers so the selected incident's popup is visible.
      const reveal = () => {
        try {
          mk.openPopup();
        } catch {
          /* popup may not be attached yet */
        }
      };
      if (cluster) {
        cluster.zoomToShowLayer(mk, reveal);
      } else {
        reveal();
      }
    }
  }, [selectedId, selected, reduce]);

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-4">
      <style>{`
        @keyframes cmd-pulse {
          0%,100%{box-shadow:0 1px 4px rgba(0,0,0,0.35)}
          50%{box-shadow:0 0 0 5px rgba(220,38,38,0.3),0 1px 4px rgba(0,0,0,0.35)}
        }
        .marker-cluster-small,.marker-cluster-medium,.marker-cluster-large{background:transparent!important}
        .marker-cluster-civic div{width:100%;height:100%;border-radius:50%}
        .cmd-popup .leaflet-popup-content-wrapper{border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.15);padding:0}
        .cmd-popup .leaflet-popup-content{margin:12px 14px}
        .cmd-popup .leaflet-popup-tip{box-shadow:0 2px 6px rgba(0,0,0,0.1)}
        .cmd-popup a:hover{background:#1d4ed8}
      `}</style>
      {/* Map canvas */}
      <div className="relative overflow-hidden rounded-xl border border-neutral-200 dark:border-dark-border bg-neutral-100 dark:bg-dark-bg min-h-[420px]">
        <div ref={containerRef} className="absolute inset-0" role="region" aria-label="Live incident command map" data-testid="cmd-map-canvas" />

        {located.length === 0 && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none bg-white/60 dark:bg-dark-bg/60 backdrop-blur-[1px]">
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">No incidents with location data</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-xs text-center px-6">
              Incident markers appear here as reports carry valid coordinates.
            </p>
          </div>
        )}

        {/* Legend */}
        {located.length > 0 && (
          <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-2 pointer-events-none">
            {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((s) => (
              <div key={s} className="inline-flex items-center gap-1.5 rounded-full bg-white/95 dark:bg-dark-bg/95 border border-neutral-200 dark:border-dark-border px-2 py-1 text-[11px] text-neutral-600 dark:text-neutral-300 shadow-sm">
                <span className="w-2 h-2 rounded-full" style={{ background: SEVERITY_GLYPH[s] }} />
                {s}
              </div>
            ))}
          </div>
        )}

        {offline && (
          <div className="absolute inset-x-4 bottom-3 z-10 p-3 rounded-lg bg-white/95 dark:bg-dark-bg/95 border border-neutral-200 dark:border-dark-border text-xs text-neutral-700 dark:text-neutral-200 shadow-sm">
            Map tiles could not be loaded (offline?). Incident coordinates are still listed below.
          </div>
        )}
      </div>

      {/* Contextual panel / Incident Index */}
      <div className="grid content-start gap-3">
        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div
              key={selected.id}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="rounded-xl border border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg-card overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-dark-border">
                <span className="font-mono text-sm font-bold text-neutral-900 dark:text-white">{selected.publicId}</span>
                <button
                  onClick={() => onSelect?.('')}
                  className="rounded-lg p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 dark:hover:bg-dark-border transition-colors"
                  aria-label="Close incident panel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {selected.detail ? (
                <div className="p-4 space-y-3">
                  <div>
                    <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 leading-snug">{selected.title}</p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">{selected.detail.categoryLabel}</p>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {selected.detail.severityLabel && (
                      <Badge variant="outline" size="sm">{selected.detail.severityLabel}</Badge>
                    )}
                    <Badge variant="outline" size="sm">{selected.detail.statusLabel}</Badge>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full',
                        attentionTone(selected.detail.attentionLevel) === 'red'
                          ? 'text-red-600 bg-red-50 border border-red-200 dark:text-red-400 dark:bg-red-900/30 dark:border-red-800'
                          : attentionTone(selected.detail.attentionLevel) === 'amber'
                            ? 'text-amber-600 bg-amber-50 border border-amber-200 dark:text-amber-400 dark:bg-amber-900/30 dark:border-amber-800'
                            : 'text-brand-600 bg-brand-50 border border-brand-200 dark:text-brand-400 dark:bg-brand-900/30 dark:border-brand-800'
                      )}
                    >
                      {selected.detail.attentionLevel}
                    </span>
                  </div>

                  <dl className="space-y-1.5 text-xs">
                    <Row k="Location" v={selected.detail.location ?? 'Not provided'} />
                    <Row k="Department" v={selected.detail.departmentName ?? 'Unassigned'} />
                    <Row k="Reported" v={selected.detail.timeLabel ?? '—'} />
                    {selected.detail.slaRemainingLabel && <Row k="SLA remaining" v={selected.detail.slaRemainingLabel} />}
                  </dl>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" asChild>
                      <Link href="/admin/issues">View Incident</Link>
                    </Button>
                    {!selected.detail.assigned && (
                      <Button size="sm" variant="outline" asChild>
                        <Link href="/admin/issues">Assign Department</Link>
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4">
                  <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-snug">{selected.title}</p>
                  <p className="text-xs text-neutral-400 mt-1">Select to inspect assignment and actions.</p>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="index"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden rounded-xl border border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg-card"
            >
              <div className="px-4 py-3 border-b border-neutral-100 dark:border-dark-border">
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Incident Index</p>
                {located.length > 0 && <p className="text-[11px] text-neutral-400 mt-0.5">{located.length} located</p>}
              </div>
              {located.length === 0 ? (
                <p className="p-4 text-sm text-neutral-400">No located incidents.</p>
              ) : (
                <div className="max-h-[360px] overflow-y-auto divide-y divide-neutral-100 dark:divide-dark-border" data-testid="incident-index">
                  {located.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => onSelect?.(p.id)}
                      className={cn(
                        'w-full text-left px-4 py-2.5 hover:bg-neutral-50 dark:hover:bg-dark-bg transition-colors flex items-center gap-2.5',
                        p.id === selectedId && 'bg-brand-50/60 dark:bg-dark-bg',
                      )}
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: pointColor(p) }} />
                      <span className="min-w-0">
                        <span className="block font-mono text-xs font-bold text-brand-600 dark:text-brand-400">{p.publicId}</span>
                        <span className="block text-xs text-neutral-600 dark:text-neutral-300 truncate">{p.title}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function buildPopup(p: CommandMapPoint): string {
  const color = pointColor(p);
  const sevLabel = p.detail?.severityLabel ?? p.severity ?? '—';
  const statusLabel = p.detail?.statusLabel ?? '—';
  const loc = p.detail?.location ?? 'Location unavailable';
  const dept = p.detail?.departmentName ?? 'Unassigned';
  const time = p.detail?.timeLabel ?? '—';
  const cat = p.detail?.categoryLabel ?? '—';
  return `
<div style="font-family:system-ui,-apple-system,sans-serif;min-width:230px;max-width:280px;padding:2px 0">
  <div style="font-family:ui-monospace,monospace;font-size:11px;color:#2563eb;margin-bottom:2px">${p.publicId}</div>
  <div style="font-size:13px;font-weight:600;color:#111827;line-height:1.35;margin-bottom:6px">${p.title}</div>
  <div style="display:flex;flex-direction:column;gap:3px;font-size:12px;color:#374151">
    <div style="display:flex;align-items:center;gap:5px"><span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></span><span>${sevLabel}</span></div>
    <div style="display:flex;align-items:center;gap:5px"><span>Category:</span><span>${cat}</span></div>
    <div style="display:flex;align-items:center;gap:5px"><span>Status:</span><span>${statusLabel}</span></div>
    <div style="display:flex;align-items:center;gap:5px"><span>Reported:</span><span>${time}</span></div>
    <div style="display:flex;align-items:center;gap:5px"><span>Location:</span><span>${loc}</span></div>
    <div style="display:flex;align-items:center;gap:5px"><span>Department:</span><span>${dept}</span></div>
  </div>
  <a href="/admin/issues" style="display:inline-block;margin-top:8px;padding:5px 12px;background:#2563eb;color:#fff;border-radius:6px;font-size:12px;font-weight:500;text-decoration:none">View Incident →</a>
</div>`;
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-neutral-400 dark:text-neutral-500">{k}</dt>
      <dd className="text-neutral-700 dark:text-neutral-200 font-medium text-right">{v}</dd>
    </div>
  );
}
