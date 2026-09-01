/**
 * Regional deployment constants: the single source of truth for the city the
 * platform operates in. Used by the map components and dashboard map labels so
 * the displayed location is never a hardcoded duplicate string.
 *
 * Coordinates: Mathura, Uttar Pradesh (regional default).
 */
export const REGION_CITY = {
  label: 'Mathura, Uttar Pradesh',
  center: [78.0322, 27.4924] as [number, number],
};