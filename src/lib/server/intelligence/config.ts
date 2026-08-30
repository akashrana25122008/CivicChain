/**
 * Central, env-configurable settings for the three real intelligence engines
 * (AI analysis, duplicate detection, priority scoring).
 *
 * Disclaimer: every value here has a sensible default so the app runs without
 * any configuration. Nothing in this module ever fabricates or simulates an
 * AI result — when `AI_API_KEY`/`AI_BASE_URL` are absent the analysis pipeline
 * FAILS honestly instead of pretending.
 */

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function normalizeBaseUrl(base: string): string {
  return base.trim().replace(/\/+$/, '');
}

export const intelligenceConfig = {
  ai: {
    /** OpenAI-compatible servers only. When absent, analysis FAILS (honest). */
    apiKey: process.env.AI_API_KEY || null,
    baseUrl: process.env.AI_BASE_URL
      ? normalizeBaseUrl(process.env.AI_BASE_URL)
      : 'https://api.openai.com/v1',
    model: process.env.AI_MODEL || 'gpt-4o-mini',
    /** Hard wall-clock cap for a single model call. */
    timeoutMs: num('AI_TIMEOUT_MS', 30_000),
    /** Retries for transient failures / malformed output (not fake delays). */
    maxRetries: num('AI_MAX_RETRIES', 1),
    /** Send downscaled image evidence to the model as vision context. */
    useVision: process.env.AI_USE_VISION === 'true',
    visionMaxImages: num('AI_VISION_MAX_IMAGES', 2),
  },

  duplicate: {
    /** Candidates must fall inside this radius (metres) when coords exist. */
    geoSearchRadiusMeters: num('DUPLICATE_GEORADIUS_METERS', 500),
    /** Only recent issues are compared; time also decays the time signal. */
    lookbackDays: num('DUPLICATE_LOOKBACK_DAYS', 90),
    timeDecayDays: num('DUPLICATE_TIME_DECAY_DAYS', 30),
    maxCandidates: num('DUPLICATE_MAX_CANDIDATES', 50),
    /** Default signal weights (spec §43-contract; env-overridable). */
    weights: {
      geographic: 0.35,
      text: 0.25,
      image: 0.2,
      time: 0.1,
      category: 0.1,
    },
    /** Confidence bands; defaults per spec §duplicate (0.40 / 0.70). */
    possibleThreshold: num('DUPLICATE_POSSIBLE_THRESHOLD', 0.4),
    strongThreshold: num('DUPLICATE_STRONG_THRESHOLD', 0.7),
    /** Reports with fewer than this many characters skip text similarity. */
    textMinLength: num('DUPLICATE_TEXT_MIN_LENGTH', 4),
  },

  priority: {
    // Spec formula (§ priority): Severity×0.30 + Reports×0.20 +
    // Population Impact×0.15 + Location Criticality×0.15 +
    // Safety Risk×0.10 + Evidence Confidence×0.10.
    weights: {
      severity: num('PRIORITY_WEIGHT_SEVERITY', 0.3),
      reports: num('PRIORITY_WEIGHT_REPORTS', 0.2),
      population: num('PRIORITY_WEIGHT_POPULATION', 0.15),
      locationCriticality: num('PRIORITY_WEIGHT_LOCATION', 0.15),
      safety: num('PRIORITY_WEIGHT_SAFETY', 0.1),
      evidence: num('PRIORITY_WEIGHT_EVIDENCE', 0.1),
    },
    /** Reports beyond this count saturate the reports component. */
    reportsCap: num('PRIORITY_REPORTS_CAP', 20),
  },
} as const;