import type { IssueContext, SearchLink } from './types';

/**
 * Location- and issue-aware search query builder.
 *
 * Produces BEFORE query variants (unresolved problem) and AFTER query variants
 * (completed work), interpolating the location into every query so all results
 * stay anchored to the same place. Query wording is driven by the reported
 * issue type so the transformation always corresponds to the actual problem.
 */

interface IssueFrames {
  before: string[];
  after: string[];
}

/**
 * Generic real-world photos are captioned with words like "flood", "waterlogged",
 * "pothole", "garbage" rather than administrative terms. We always include these
 * broad unresolved/resolved conditions alongside the issue-specific ones so the
 * searcher can actually find genuine photographs.
 */
const GENERIC_BEFORE = [
  'flood', 'flooding', 'waterlogged road', 'water accumulation', 'water on road',
  'rain water', 'submerged road', 'damaged road', 'pothole', 'garbage pile',
  'broken', 'waterlogging',
];
const GENERIC_AFTER = [
  'repaired', 'clean', 'cleared', 'dry road', 'drain cleaning', 'desilting',
  'desilt', 'restored', 'anti waterlogging', 'maintenance',
];

function withGeneric(frames: IssueFrames, kind: 'before' | 'after'): IssueFrames['before'] {
  const pool = kind === 'before' ? GENERIC_BEFORE : GENERIC_AFTER;
  const specific = frames[kind];
  // Interleave specific + generic so ranking can match real captions.
  return [...specific, ...pool];
}

const ISSUE_FRAMES: Record<string, IssueFrames> = {
  pothole: {
    before: ['road pothole before', 'damaged road potholes', 'road crater'],
    after: ['road repaired', 'pothole repair completed', 'repaired road'],
  },
  drainage: {
    before: [
      'blocked drainage waterlogging',
      'drainage water accumulation',
      'drain blockage',
      'drainage problem',
    ],
    after: [
      'drainage repaired',
      'drain cleaning',
      'waterlogging resolved',
      'drainage repair completed',
    ],
  },
  garbage: {
    before: ['garbage accumulation', 'waste pile overflowing', 'garbage dumped street'],
    after: ['garbage cleaned', 'waste cleared cleaned area', 'clean street'],
  },
  streetlight: {
    before: ['broken street light', 'street light not working'],
    after: ['street light repaired', 'street lamp working fixed'],
  },
  sidewalk: {
    before: ['broken sidewalk', 'damaged footpath'],
    after: ['sidewalk repaired', 'footpath reconstructed'],
  },
  infrastructure: {
    before: ['damaged infrastructure', 'deteriorated public structure'],
    after: ['infrastructure repaired', 'rebuilt restored public facility'],
  },
  road: {
    before: ['damaged road', 'deteriorated road surface'],
    after: ['road repaired', 'road resurfaced'],
  },
};

const DEFAULT_FRAMES: IssueFrames = {
  before: ['before civic work', 'original problem', 'damaged condition'],
  after: ['after civic work', 'repaired condition', 'completed repair'],
};

function framesFor(issueType: string): { before: string[]; after: string[] } {
  const key = issueType.toLowerCase();
  let base = DEFAULT_FRAMES;
  for (const [k, v] of Object.entries(ISSUE_FRAMES)) {
    if (key.includes(k)) {
      base = v;
      break;
    }
  }
  return {
    before: withGeneric(base, 'before'),
    after: withGeneric(base, 'after'),
  };
}

function asQueryTerm(location: string): string {
  return location.trim().replace(/\s+/g, ' ').replace(/,\s*/g, ' ').slice(0, 80);
}

/**
 * Build BEFORE/AFTER search query phrases for the location + reported issue.
 * `attempt` varies the wording on retry (rotation + extra alternates) so a
 * retry genuinely performs a new search rather than repeating the same one.
 */
export function buildQuerySets(context: IssueContext): { before: string[]; after: string[] } {
  const location = asQueryTerm(context.location || 'the location');
  const frames = framesFor(context.issueType);
  const attempt = context.attempt ?? 0;
  const qb = frameVariant(frames.before, attempt).map((v) => `${location} ${v}`.trim());
  const qa = frameVariant(frames.after, attempt).map((v) => `${location} ${v}`.trim());

  if (attempt === 0) return { before: qb, after: qa };

  // On retry, also try the location with its locality reordered ("Noida Sector 62")
  // and a couple of broad alternates that the first pass did not use.
  const altLocation = alternateLocation(context.location);
  const extraBefore = ['condition', 'issue', 'problem'].map((v) => `${altLocation} ${v}`.trim());
  const extraAfter = ['development', 'improvement', 'fixed'].map((v) => `${altLocation} ${v}`.trim());
  return {
    before: [...qb, ...extraBefore],
    after: [...qa, ...extraAfter],
  };
}

/** Rotate a list by `attempt` and de-duplicate, so retries differ from pass 1. */
function frameVariant(list: string[], attempt: number): string[] {
  if (attempt === 0) return list;
  const rot = attempt % list.length;
  const rotated = [...list.slice(rot), ...list.slice(0, rot)];
  return rotated;
}

/** Reverse/alternate the locality wording, e.g. "Sector 62, Noida" -> "Noida Sector 62". */
function alternateLocation(location: string): string {
  const parts = location.replace(/,\s*/g, ' ').trim().split(/\s+/);
  return parts.length > 1 ? [...parts.slice(1), parts[0]].join(' ') : location;
}

/**
 * Build clickable external search links for the user to verify by hand.
 * These are genuine Google search URLs — presented as search, never evidence.
 */
export function buildSearchLinks(context: IssueContext): { before: SearchLink[]; after: SearchLink[] } {
  const location = asQueryTerm(context.location || 'the location');
  const frames = framesFor(context.issueType);
  const map = (list: string[]): SearchLink[] =>
    list.map((v) => {
      const query = `${location} ${v}`.trim();
      return {
        label: v.charAt(0).toUpperCase() + v.slice(1),
        query,
        url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      };
    });
  return { before: map(frames.before), after: map(frames.after) };
}
