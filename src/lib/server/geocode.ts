/**
 * Optional reverse geocoding hook.
 *
 * Phase 2 never fabricates an address: when GEOCODER_URL is configured the
 * server asks the provider for a human-readable label from the captured
 * coordinates; when it is absent/unreachable the report keeps the citizen's
 * free-text location (or "Not available"). A geocoding outage must never fail
 * report submission.
 *
 * Contract (provider-agnostic, JSON): either a plain string, or
 * `{ address: string }`. Authorization key is sent only when configured.
 */

export async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  const endpoint = process.env.GEOCODER_URL;
  if (!endpoint) return null;

  try {
    const url = new URL(endpoint);
    url.searchParams.set('lat', String(latitude));
    url.searchParams.set('lon', String(longitude));
    url.searchParams.set('format', 'json');

    const res = await fetch(url, {
      headers: process.env.GEOCODER_API_KEY
        ? { Authorization: `Bearer ${process.env.GEOCODER_API_KEY}` }
        : undefined,
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;

    const text = await res.text();
    const raw: unknown = text ? JSON.parse(text) : null;
    if (typeof raw === 'string') return raw.length ? raw : null;
    if (raw && typeof raw === 'object') {
      const maybeAddress = (raw as { address?: unknown }).address;
      if (typeof maybeAddress === 'string' && maybeAddress.length) return maybeAddress;
    }
    return null;
  } catch {
    return null;
  }
}