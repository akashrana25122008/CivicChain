'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Map, Marker, NavigationControl, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapPin, Loader2, Search, Crosshair } from 'lucide-react';
import { CARTO_STYLE } from '@/components/dashboard/IssuesMapInner';
import { cn } from '@/lib/utils';

interface GeoResult {
  label: string;
  latitude: number;
  longitude: number;
  ward: string | null;
  located: boolean;
}

interface ReverseResult {
  label: string;
  latitude: number;
  longitude: number;
  ward: string | null;
}

export interface PickedLocation {
  /** Human-readable label (address / landmark), nullable when nothing picked. */
  location: string;
  latitude: number | null;
  longitude: number | null;
  /** Detected ward/zone, when known. */
  ward: string | null;
  /** Whether an actual coordinate pin was dropped (vs. text-only). */
  hasPin: boolean;
  /** Reverse-geocoding provider responded (false → local fallback). */
  geocoderAvailable: boolean;
}

export function LocationPicker({
  value,
  onChange,
}: {
  value: PickedLocation;
  onChange: (next: PickedLocation) => void;
}) {
  const [query, setQuery] = useState(value.location);
  const [results, setResults] = useState<GeoResult[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reverseState, setReverseState] = useState<'idle' | 'reverse' | 'done'>('idle');

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markerRef = useRef<Marker | null>(null);

  const applyPin = useCallback(
    (lat: number, lng: number, label?: string) => {
      const map = mapRef.current;
      if (map) {
        if (markerRef.current) markerRef.current.remove();
        const el = document.createElement('div');
        el.style.width = '22px';
        el.style.height = '22px';
        el.style.borderRadius = '9999px 9999px 9999px 0';
        el.style.background = '#e11d48';
        el.style.border = '3px solid #ffffff';
        el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.4)';
        el.style.transform = 'rotate(-45deg)';
        const dot = document.createElement('div');
        dot.style.position = 'absolute';
        dot.style.inset = '0';
        dot.style.margin = 'auto';
        dot.style.width = '8px';
        dot.style.height = '8px';
        dot.style.borderRadius = '9999px';
        dot.style.background = '#ffffff';
        dot.style.transform = 'rotate(45deg)';
        el.appendChild(dot);
        markerRef.current = new Marker({ element: el, anchor: 'center' })
          .setLngLat([lng, lat])
          .addTo(map);
        map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 15), duration: 600 });
      }
      setReverseState('reverse');
      // Always keep the user's explicit address when they typed one.
      onChange({
        location: query.trim() || label || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        latitude: lat,
        longitude: lng,
        ward: value.ward,
        hasPin: true,
        geocoderAvailable: value.geocoderAvailable,
      });
      fetch(`/api/geocode/reverse?lat=${lat}&lon=${lng}${label ? `&fallback=${encodeURIComponent(label)}` : ''}`)
        .then((r) => r.json())
        .then((data: { available?: boolean; result?: ReverseResult | null }) => {
          const result = data.result;
          setReverseState('done');
          onChange({
            location:
              query.trim() ||
              result?.label ||
              label ||
              `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
            latitude: lat,
            longitude: lng,
            ward: result?.ward ?? value.ward,
            hasPin: true,
            geocoderAvailable: data.available ?? false,
          });
        })
        .catch(() => {
          setReverseState('done');
        });
    },
    [query, value, onChange],
  );

  // Debounced forward geocoding for the autocomplete dropdown. All state
  // mutations happen inside the debounce callback (asynchronous), so results
  // never cascade from the effect body itself.
  useEffect(() => {
    const trimmed = query.trim();
    const delay = trimmed && trimmed.length >= 3 ? 350 : 0;
    const t = setTimeout(() => {
      if (!trimmed || trimmed.length < 3) {
        setResults([]);
        setOpen(false);
        setBusy(false);
        return;
      }
      setBusy(true);
      fetch(
        `/api/geocode/search?q=${encodeURIComponent(trimmed)}${value.latitude != null && value.longitude != null ? `&lat=${value.latitude}&lon=${value.longitude}` : ''}`,
      )
        .then((r) => r.json())
        .then((data: { results?: GeoResult[] }) => {
          setResults(data.results ?? []);
          setOpen(true);
        })
        .catch(() => setResults([]))
        .finally(() => setBusy(false));
    }, delay);
    return () => clearTimeout(t);
  }, [query, value.latitude, value.longitude]);

  // Initialize the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new Map({
      container: containerRef.current,
      style: CARTO_STYLE as StyleSpecification,
      center: value.latitude != null && value.longitude != null ? [value.longitude, value.latitude] : [77.5946, 12.9716],
      zoom: value.hasPin ? 15 : 10,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    map.on('error', () => {
      setError(null);
    });
    map.on('click', (e) => {
      const { lat, lng } = e.lngLat;
      applyPin(lat, lng);
    });
    map.on('load', () => {
      if (value.latitude != null && value.longitude != null) {
        applyPin(value.latitude, value.longitude, value.location);
      }
    });
    mapRef.current = map;
    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (r: GeoResult) => {
    setQuery(r.label);
    setOpen(false);
    if (r.located) {
      applyPin(r.latitude, r.longitude, r.label);
    } else {
      // Label-only candidate from the fallback: keep text, clear any stale pin's
      // address conclusion but preserve text as the location.
      onChange({
        location: r.label,
        latitude: value.latitude,
        longitude: value.longitude,
        ward: r.ward ?? value.ward,
        hasPin: value.hasPin,
        geocoderAvailable: value.geocoderAvailable,
      });
    }
  };

  const handleUseMyLocation = () => {
    if (!('geolocation' in navigator)) {
      setError('Geolocation is not available in this browser.');
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        applyPin(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setBusy(false);
        setError('Could not read your location. Search for an address or click the map instead.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  return (
    <div>
      {/* Address / search input with autocomplete */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              onChange({
                ...value,
                location: e.target.value,
                // Clearing the box unsets the text-only location but keeps a pin.
                hasPin: value.hasPin,
              });
            }}
            placeholder="Search an address or landmark…"
            className="w-full rounded-lg border border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg-card pl-10 pr-10 py-2.5 text-sm text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500/40 placeholder:text-neutral-400"
            onFocus={() => results.length > 0 && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
          />
          {busy ? (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-brand-500" />
          ) : null}
        </div>

        {open && results.length > 0 && (
          <ul className="absolute z-20 mt-1 w-full rounded-lg border border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg-card shadow-lg max-h-64 overflow-auto">
            {results.map((r, i) => (
              <li key={`${r.label}-${i}`}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(r)}
                  className="w-full text-left px-3 py-2.5 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-dark-bg flex items-start gap-2"
                >
                  <MapPin className="w-4 h-4 mt-0.5 text-brand-500 flex-shrink-0" />
                  <span>
                    <span className="block">{r.label}</span>
                    {r.ward ? (
                      <span className="block text-xs text-neutral-400">{r.ward}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error ? <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{error}</p> : null}

      {/* Map click-to-pin */}
      <div ref={containerRef} className="relative mt-3 h-52 rounded-xl overflow-hidden border border-neutral-200 dark:border-dark-border">
        <p className="absolute top-2 left-2 z-10 text-[11px] px-2 py-1 rounded-full bg-neutral-900/80 text-white">
          Click the map to drop a pin
        </p>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={busy}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 disabled:opacity-60"
        >
          <Crosshair className="w-3.5 h-3.5" />
          Use My Location
        </button>
        {value.ward ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
            <MapPin className="w-3.5 h-3.5" />
            {value.ward}
          </span>
        ) : null}
        {value.hasPin && value.latitude != null && value.longitude != null ? (
          <span className="font-mono text-xs text-neutral-500">
            {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
          </span>
        ) : null}
        {reverseState === 'reverse' ? (
          <span className={cn('inline-flex items-center gap-1 text-xs text-neutral-400')}>
            <Loader2 className="w-3 h-3 animate-spin" /> resolving address…
          </span>
        ) : null}
      </div>
    </div>
  );
}
