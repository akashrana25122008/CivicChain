/**
 * Geocoding service (Phase 15).
 *
 * Provider-agnostic forward/reverse geocoding with a graceful, self-contained
 * fallback when no external provider is configured.
 *
 * Contract (provider JSON):
 *   reverse  -> Nominatim-style `{ display_name, address: { suburb, ward, ... } }`
 *                or a plain string / `{ address }` (legacy Phase 2 shape).
 *   search   -> array of `{ display_name, lat, lon }` (Nominatim-style) or a
 *                flat string list.
 *
 * A geocoding outage or missing provider must NEVER fail report submission.
 * Server-side down-calls are wrapped; failures degrade to a best-effort label
 * derived from the free-text location and the captured coordinates.
 *
 * Ward/zone detection is intentionally DATA-DERIVED (regex/tokenizer over the
 * location text, plus a deterministic grid-cell fallback) — there is no
 * hardcoded ward list baked into the source.
 */

export interface GeocodeResult {
  label: string;
  latitude?: number;
  longitude?: number;
  /** Political/administrative subdivision (ward/zone) when detectable. */
  ward?: string | null;
  raw?: unknown;
}

export interface ReverseResult extends GeocodeResult {
  latitude: number;
  longitude: number;
}

export interface SearchResult extends GeocodeResult {
  latitude: number;
  longitude: number;
}

/** Lookup config, env-overridable. Timeout keeps an outage from hanging reports. */
const REQUEST_TIMEOUT_MS = 4000;

function endpoint(): string | null {
  const e = process.env.GEOCODER_URL;
  return e && e.trim() ? e.trim() : null;
}

function authHeaders(): Record<string, string> | undefined {
  const key = process.env.GEOCODER_API_KEY;
  return key && key.trim() ? { Authorization: `Bearer ${key.trim()}` } : undefined;
}

// ---------------------------------------------------------------------------
// Ward / zone detection — derived purely from text + coordinates (no mappings)
// ---------------------------------------------------------------------------

/** Ward token regex: "Ward 12", "Ward 12-A", "गट 3", "Zone 4", "zone 12a". */
const WARD_TOKEN_REGEX =
  /(?:^|[\s,/()])(?:ward|zone|गट|गट\s*क्र|वॉर्ड)\s*[.:-]?\s*(\d{1,4}(?:[a-z]|-\w+)?)(?:[\s,/()]|$)/i;

/**
 * Strips noisy punctuation so a scan for administrative tokens is predictable
 * without mutating the original label we display.
 */
function normalizeForScan(text: string): string {
  return text.replace(/[\u00a0\u2009\u2002\u2003]/g, ' ').trim();
}

/**
 * Extracts a ward/zone token from location text. Pure, deterministic — never a
 * hardcoded lookup table. Returns normalized "Ward N" (or null when absent).
 */
export function extractWardFromText(location: string | null | undefined): string | null {
  if (!location) return null;
  const scan = normalizeForScan(location);
  const m = scan.match(WARD_TOKEN_REGEX);
  if (!m) return null;
  const num = m[1];
  const isWard = /ward|वॉर्ड|गट/i.test(m[0]);
  return `${isWard ? 'Ward' : 'Zone'} ${num.toUpperCase()}`;
}

/**
 * Deterministic grid-cell key used as a fallback area identity when no ward
 * token is present in the location text and coordinates exist.
 */
export function gridCellKey(latitude: number, longitude: number, gridSize = 0.01): string {
  const gridLat = Math.round(latitude / gridSize) * gridSize;
  const gridLng = Math.round(longitude / gridSize) * gridSize;
  return `area_${gridLat.toFixed(3)}_${gridLng.toFixed(3)}`;
}

// ---------------------------------------------------------------------------
// Provider calls (best-effort, never throws to the caller)
// ---------------------------------------------------------------------------

async function reverseFromProvider(
  latitude: number,
  longitude: number,
): Promise<ReverseResult | null> {
  const base = endpoint();
  if (!base) return null;
  try {
    const url = new URL(base);
    url.searchParams.set('lat', String(latitude));
    url.searchParams.set('lon', String(longitude));
    url.searchParams.set('format', 'jsonv2');
    if (!url.searchParams.has('addressdetails')) url.searchParams.set('addressdetails', '1');

    const res = await fetch(url, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const text = await res.text();
    const raw: unknown = text ? JSON.parse(text) : null;

    // Legacy Phase 2 shapes: plain string or { address }
    if (typeof raw === 'string') {
      return raw.length ? { label: raw, latitude, longitude } : null;
    }
    if (raw && typeof raw === 'object') {
      const obj = raw as { address?: unknown; display_name?: unknown };
      const label =
        (typeof obj.display_name === 'string' && obj.display_name.length && obj.display_name) ||
        (typeof (obj.address as { address?: unknown } | undefined)?.address === 'string'
          ? ((obj.address as { address: string }).address as string)
          : null);
      if (!label) return null;
      const ward = addressWard(obj.address);
      return { label, latitude, longitude, ward };
    }
    return null;
  } catch {
    return null;
  }
}

/** Pulls a ward/zone out of a Nominatim-style `address` object, if present. */
function addressWard(address: unknown): string | null {
  if (!address || typeof address !== 'object') return null;
  const a = address as Record<string, unknown>;
  for (const key of ['ward', 'suburb', 'city_district', 'borough', 'neighbourhood']) {
    const v = a[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

async function searchFromProvider(
  query: string,
  opts: { limit?: number; lat?: number; lon?: number } = {},
): Promise<SearchResult[] | null> {
  const base = endpoint();
  if (!base) return null;
  try {
    const url = new URL(base);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', String(opts.limit ?? 6));
    if (opts.lat != null && opts.lon != null) {
      url.searchParams.set('lat', String(opts.lat));
      url.searchParams.set('lon', String(opts.lon));
      url.searchParams.set('bounded', '1');
    }

    const res = await fetch(url, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const text = await res.text();
    const raw: unknown = text ? JSON.parse(text) : null;

    // Flat string list (provider-agnostic alternative).
    if (Array.isArray(raw) && raw.every((i) => typeof i === 'string')) {
      return raw
        .filter((s) => s.length)
        .slice(0, opts.limit ?? 6)
        .map((s) => ({ label: s as string, latitude: 0, longitude: 0 }));
    }
    if (!Array.isArray(raw)) return null;

    return (raw as Array<{ display_name?: unknown; lat?: unknown; lon?: unknown; address?: unknown }>)
      .map((r): SearchResult | null => {
        const label = typeof r.display_name === 'string' ? r.display_name : null;
        const lat = Number(r.lat);
        const lon = Number(r.lon);
        if (!label) return null;
        return {
          label,
          latitude: Number.isFinite(lat) ? lat : 0,
          longitude: Number.isFinite(lon) ? lon : 0,
          ward: addressWard(r.address),
        };
      })
      .filter((r): r is SearchResult => r !== null)
      .slice(0, opts.limit ?? 6);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public service API
// ---------------------------------------------------------------------------

/**
 * Reverse geocodes coordinates to a human-readable label. Falls back to the
 * free-text `location` when the provider is absent/unreachable. Never throws.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
  fallback?: string | null,
): Promise<string | null> {
  const fromProvider = await reverseFromProvider(latitude, longitude);
  if (fromProvider) return fromProvider.label;
  return fallback || null;
}

/**
 * Reverse geocodes to a structured result (label + ward). Null when neither a
 * provider nor coordinates yield anything usable.
 */
export async function reverseGeocodeStructured(
  latitude: number,
  longitude: number,
  fallback?: string | null,
): Promise<ReverseResult | null> {
  const fromProvider = await reverseFromProvider(latitude, longitude);
  if (fromProvider) return fromProvider;
  if (fallback) {
    return { label: fallback, latitude, longitude, ward: extractWardFromText(fallback) };
  }
  return null;
}

/**
 * Forward search of an address/landmark. Falls back to local parsing when the
 * provider is absent. Never throws. Coordinates may be (0,0) for local matches
 * (label-only) — callers must treat zero coords as "unlocated".
 */
export async function searchGeocode(
  query: string,
  opts: { limit?: number; lat?: number; lon?: number } = {},
): Promise<SearchResult[]> {
  const trimmed = (query ?? '').trim();
  if (!trimmed) return [];

  const fromProvider = await searchFromProvider(trimmed, opts);
  if (fromProvider) return fromProvider;

  // Fallback: surface a label-only candidate derived from the query itself so
  // the picker stays usable offline. Zero coordinates signal "no location".
  return [{ label: trimmed, latitude: 0, longitude: 0, ward: extractWardFromText(trimmed) }];
}

/**
 * Combines the user's free-text address and any coordinates + ward into a
 * single human-readable label for persistence (Phase 2 contract: never
 * fabricate; keep the citizen's own words when present).
 */
export function humanLocationLabel(input: {
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  ward?: string | null;
}): string | null {
  const parts: string[] = [];
  if (input.location?.trim()) parts.push(input.location.trim());
  const ward = input.ward?.trim();
  if (ward && !parts.some((p) => p.toLowerCase().includes(ward.toLowerCase()))) {
    parts.push(ward);
  }
  return parts.length ? parts.join(', ') : null;
}
