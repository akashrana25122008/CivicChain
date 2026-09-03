import type { StyleSpecification } from 'maplibre-gl';

/** CARTO Voyager raster tile style — shared across all Maplibre map surfaces. */
export const CARTO_STYLE: StyleSpecification = {
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

/** Status → marker color mapping used by the civic map surfaces. */
export const STATUS_COLORS: Record<string, string> = {
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
