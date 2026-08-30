'use client';

import { MapPin } from 'lucide-react';

/**
 * A civic issue location for the inline map.
 *
 * Coordinates are preferred when the app has them; otherwise a place name is
 * used. We never fabricate either.
 */
export interface MapLocation {
  lat?: number;
  lng?: number;
  queryLabel?: string;
  locationLabel?: string;
  issueLabel?: string;
  statusLabel?: string;
  markerId?: string;
}

/**
 * Build a keyless Google Maps embed URL (no API key required).
 *
 * `https://maps.google.com/maps?q=…&output=embed` renders an interactive map
 * inside an iframe that stays on the current page. Coordinates are preferred;
 * a place-name search is used as the fallback.
 */
export function mapEmbedUrl(loc: MapLocation, zoom = 15): string {
  const hasCoords =
    typeof loc.lat === 'number' && typeof loc.lng === 'number' &&
    Number.isFinite(loc.lat) && Number.isFinite(loc.lng);
  const q = hasCoords
    ? `${loc.lat},${loc.lng}`
    : (loc.queryLabel?.trim() || '');
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=${zoom}&hl=en&output=embed`;
}

export function CivicMapEmbed({ location }: { location: MapLocation }) {
  const src = mapEmbedUrl(location);

  return (
    <div className="relative h-full w-full">
      <iframe
        key={src}
        title={`Map of ${location.locationLabel || location.queryLabel || 'civic location'}`}
        src={src}
        className="h-full w-full border-0"
        loading="lazy"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
      />

      {location.locationLabel && (
        <div className="pointer-events-none absolute left-4 top-4 md:left-6 md:top-6 z-10 flex max-w-[280px] items-start gap-2 rounded-xl bg-dark-bg/90 p-3 backdrop-blur-md border border-dark-border">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{location.locationLabel}</p>
            <p className="mt-0.5 line-clamp-2 text-[11px] text-white/60">
              {[location.issueLabel && `Issue: ${location.issueLabel}`, location.statusLabel && `Status: ${location.statusLabel}`]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
