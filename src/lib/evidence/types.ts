/**
 * Shared types for the Before & After civic-evidence search system.
 *
 * Design goal: the visual evidence layer is decoupled from any single search
 * provider. The application reads from an `ImageSearchProvider` interface; a
 * concrete provider is selected at runtime. Real photographs are retrieved
 * from a legitimate, publicly accessible image search API (Wikimedia Commons,
 * keyless) — no image-generation API or key is required anywhere.
 *
 * Honesty rule: confidence/assessment values are only ever reported when real
 * evidence was actually retrieved and analysed. The system never fabricates a
 * score, a photograph, or a verification claim.
 */

/** The reported civic issue we are searching evidence for. */
export interface IssueContext {
  /** Free-text location, e.g. "Sector 62, Noida". */
  location: string;
  /** The reported civic problem type, e.g. "drainage", "garbage", "pothole", "streetlight". */
  issueType: string;
  /** Optional human-readable label for the reported problem. */
  issueLabel?: string;
  /** Optional action taken by the authority. */
  actionLabel?: string;
  /** Optional current status, e.g. "Resolved". */
  statusLabel?: string;
  /** Optional address/locality hint to refine the search. */
  address?: string;
  /** Incremented on each retry so a new search attempts alternative cues. */
  attempt?: number;
}

/**
 * A single source-backed evidence image with full structured metadata, as
 * returned by a provider. Every displayed image must carry its source.
 */
export interface EvidenceImage {
  /** Direct, working image URL. */
  url: string;
  /** Optional thumbnail URL. */
  thumbnailUrl?: string;
  /** The page/source the image appears on (used for "View source"). */
  sourceUrl: string;
  /** Display name of the source. */
  sourceName: string;
  /** Title / caption of the image or article. */
  title: string;
  /** Publication / upload date if reliably known. Otherwise undefined — never invented. */
  published?: string;
  /** The search query that surfaced this image. */
  query: string;
  /** 0-1 relevance+credibility score assigned from actual ranking. */
  confidence: number;
  /** True only when the location ↔ source relationship has been actually verified. */
  verified: boolean;
}

/** A clickable, external search link — clearly a search, not evidence. */
export interface SearchLink {
  label: string;
  query: string;
  url: string;
}

/** A discrete, user-facing step in the real search process. */
export interface SearchStep {
  key: string;
  label: string;
  state: 'pending' | 'active' | 'done';
}

/** Before/After resolution of a real photo pair. */
export interface EvidencePair {
  before?: EvidenceImage;
  after?: EvidenceImage;
}

/** Progress/status surfaced during the real search. */
export interface SearchProgress {
  /** Messages describing what the system is genuinely doing. */
  steps: SearchStep[];
  /** Whether the search actually completed (all sub-searches attempted). */
  completed: boolean;
}

/**
 * Result of an evidence search. `available` is true only when a real image
 * pair was retrieved. `links` always carries genuine external search links for
 * the user to verify by hand. Confidence values are only populated when real
 * evidence backs them.
 */
export interface EvidenceSearchResult {
  /** Whether a real before/after image pair was actually retrieved. */
  available: boolean;
  /** True when exactly one of the two states has a verified real image. */
  partial: boolean;
  before?: EvidenceImage;
  after?: EvidenceImage;
  /** External search links (search, not evidence). */
  links: { before: SearchLink[]; after: SearchLink[] };
  /** Search-status steps for the user. */
  progress: SearchProgress;
  /** Human notes (never technical internals). */
  notes: string[];
  /** Evidence-derived metrics — only present when the pair is real. */
  metrics?: EvidenceMetrics;
}

/** Metrics only ever derived from actual retrieved+analysed evidence. */
export interface EvidenceMetrics {
  locationMatch: number;
  issueMatch: number;
  sourceCredibility: number;
  dateConfidence: number;
  overall: number;
  /** Whether the before<after chronology could actually be established. */
  chronologyEstablished: boolean;
}

/** Provider contract — implement to plug in any legitimate search mechanism. */
export interface ImageSearchProvider {
  readonly id: string;
  /** Whether a real retrieval endpoint is available (no API key required). */
  readonly imagesAvailable: boolean;
  /** Resolve a same-location before/after pair for an issue. */
  search(context: IssueContext): Promise<EvidenceSearchResult>;
}
