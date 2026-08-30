'use client';

import Link from 'next/link';
import { MapPin, ExternalLink } from 'lucide-react';
import { mapEmbedUrl } from '@/components/landing/CivicMapEmbed';

/**
 * Reliable, keyless Google Maps iframe panel shown wherever a live-map context
 * belongs (citizen / department / admin dashboards). Uses a plain iframe embed
 * (no WebGL/worker dependency) so it renders everywhere, and links through to
 * the full interactive Civic Map workspace.
 */
export function CivicMapFrame({
  title = 'Civic Map',
  location,
  zoom = 12,
  mapHref = '/map',
  className,
}: {
  title?: string;
  location: { lat?: number; lng?: number; queryLabel?: string };
  zoom?: number;
  mapHref?: string;
  className?: string;
}) {
  const src = mapEmbedUrl(location, zoom);

  return (
    <div className={`relative overflow-hidden rounded-xl border border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-bg-card ${className ?? ''}`}>
      <iframe
        key={src}
        title={`${title} — interactive map`}
        src={src}
        className="h-full w-full border-0"
        loading="lazy"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
      />

      {/* Click-through to the full interactive map */}
      <Link
        href={mapHref}
        aria-label={`Open full ${title}`}
        className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-brand-600 text-white text-xs font-semibold px-3 py-1.5 shadow-sm hover:bg-brand-700 transition-colors"
      >
        <ExternalLink className="w-3 h-3" aria-hidden="true" />
        Open full map
      </Link>

      {/* Location chip */}
      {location.queryLabel && (
        <div className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 dark:bg-dark-bg/95 border border-neutral-200 dark:border-dark-border px-2.5 py-1 text-xs font-medium text-neutral-700 dark:text-neutral-200 shadow-sm">
          <MapPin className="w-3 h-3 text-brand-600 dark:text-brand-400" aria-hidden="true" />
          {location.queryLabel}
        </div>
      )}
    </div>
  );
}
