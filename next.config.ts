import type { NextConfig } from "next";

const STATIC_SECURITY_HEADERS: { key: string; value: string }[] = [
  { key: "Content-Security-Policy", value: "default-src 'self'" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=()" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "X-Download-Options", value: "noopen" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
] as const;

/**
 * Dynamic pages + API routes already receive the full path-aware security
 * header set from the proxy middleware (`src/lib/security/headers.ts`). These
 * framework-level headers cover the immutable assets under /_next/static that
 * bypass the middleware, so every response leaves with the same baseline.
 * X-Powered-By is disabled at the framework level (the middleware also strips
 * it on matched routes).
 */
const nextConfig: NextConfig = {
  poweredByHeader: false,
  headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: STATIC_SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;