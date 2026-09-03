/**
 * The single email granted ADMIN privileges.
 *
 * Read from the environment (never hard-coded in source) and normalized by
 * trimming + lowercasing so comparisons are robust to capitalization and
 * whitespace (e.g. "Vizarya1@Gmail.com " → "vizarya1@gmail.com").
 *
 * Edge-safe: imports nothing node-only, so it is safe to use both from the
 * full server config (auth.ts) and the route-protection Proxy via auth.config.ts.
 */
export const ADMIN_EMAIL: string =
  process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? '';
