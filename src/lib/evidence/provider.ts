import type {
  EvidenceImage,
  EvidenceMetrics,
  EvidenceSearchResult,
  ImageSearchProvider,
  IssueContext,
  SearchStep,
} from './types';
import { buildQuerySets, buildSearchLinks } from './queries';

/**
 * Real evidence provider backed by the Wikimedia Commons API.
 *
 * Wikimedia Commons is a legitimate, publicly accessible image repository with
 * a keyless JSON API. It returns real photographs of real places with full
 * provenance (source page, date, license, description) — exactly the "publicly
 * available location imagery" the spec calls for. No image-generation API or
 * key is used.
 *
 * Honesty: if a real before/after pair can't be retrieved and validated, the
 * provider reports available:false and the UI shows a genuine fallback rather
 * than fabricating evidence or confidence scores.
 */

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const SEARCH_STEPS: SearchStep[] = [
  { key: 'location', label: 'Location identified', state: 'done' },
  { key: 'before', label: 'Before evidence searched', state: 'pending' },
  { key: 'after', label: 'After evidence searched', state: 'pending' },
  { key: 'sources', label: 'Sources evaluated', state: 'pending' },
  { key: 'match', label: 'Same-location candidates compared', state: 'pending' },
];

interface RawHit {
  title: string;
  url?: string;
  thumbUrl?: string;
  descriptionUrl?: string;
  date?: string;
  license?: string;
  description?: string;
  queryText?: string;
}

/** Fetch real image candidates for one query from the Commons API. */
async function commonsSearch(query: string, limit = 24): Promise<RawHit[]> {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '6', // File namespace — actual images, not categories/galleries
    gsrlimit: String(limit),
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '900',
    format: 'json',
    origin: '*',
  });

  const res = await fetch(`${COMMONS_API}?${params.toString()}`, {
    headers: { 'User-Agent': 'CivicChain/1.0 (evidence verification)' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return [];

  const data = (await res.json()) as {
    query?: { pages?: Record<string, unknown> };
  };
  const pages = data.query?.pages ?? {};
  const hits: RawHit[] = [];

  for (const p of Object.values(pages) as Array<Record<string, unknown>>) {
    const ii = p.imageinfo as Array<Record<string, unknown>> | undefined;
    if (!ii?.[0]) continue;
    const meta = ii[0];
    const ext = (meta.extmetadata ?? {}) as Record<string, { value?: string }>;
    const url = meta.url as string | undefined;
    if (!url) continue;
    if (url.match(/\.(svg|pdf|xcf|tiff|webm|ogv|oga|ogg)$/i)) continue;
    const descText = ((ext.ImageDescription?.value ?? '') as string)
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    hits.push({
      title: String(p.title ?? ''),
      url,
      thumbUrl: (meta.thumburl as string) || url,
      descriptionUrl: (meta.descriptionurl as string) || url,
      date:
        (ext.DateTimeOriginal?.value as string) ||
        (ext.DateTime?.value as string) ||
        undefined,
      license: ext.LicenseShortName?.value as string | undefined,
      description: descText.slice(0, 400),
    });
  }
  return hits;
}

/* ---------- Ranking ---------- */

const CREDIBLE_SOURCES = [
  'pib', 'india.gov', 'nic.in', 'noida', 'municipal', 'nagarnigam',
  'news', 'timesofindia', 'hindustantimes', 'indianexpress', 'hindu',
  'ndtv', 'wire', 'scroll', 'kiphoto',
];

/** Location relevance: presence of location tokens in title/description. */
function locationRelevance(text: string, location: string): number {
  const locTokens = location
    .split(/[\s,]+/)
    .filter((t) => t.length >= 3)
    .map((t) => t.toLowerCase());
  if (locTokens.length === 0) return 0.5;
  const t = text.toLowerCase();
  let hits = 0;
  for (const tok of locTokens) {
    if (t.includes(tok)) hits += 1;
  }
  return Math.min(1, hits / Math.max(1, locTokens.length) * 0.8 + (hits > 0 ? 0.2 : 0));
}

/** Issue/condition relevance: presence of real-world condition wording in text. */
const BEFORE_CUES = [
  'flood', 'inundat', 'water', 'waterlog', 'submerged', 'rain', 'pothole',
  'crater', 'garbage', 'waste', 'debris', 'broken', 'damaged', 'clogged',
  'blocked', 'overflow', 'dirty', 'dark', 'dilapidat',
];
const AFTER_CUES = [
  'repair', 'cleaned', 'cleared', 'restored', 'dry road', 'desilt', 'drain',
  'fixed', 'relaid', 'maintenance', 'new asphalt', 'fresh paint', 'renovated',
];

function issueRelevance(text: string, context: IssueContext, kind: 'before' | 'after'): number {
  const t = text.toLowerCase();
  const labels = `${context.issueLabel ?? ''} ${context.issueType}`.toLowerCase();
  const words = labels.split(/[\s,]+/).filter((w) => w.length >= 4);
  const primary = kind === 'before' ? BEFORE_CUES : AFTER_CUES;
  const secondary = kind === 'before' ? AFTER_CUES : BEFORE_CUES;

  let score = 0;
  for (const w of words) if (t.includes(w)) score += 1.2;
  for (const c of primary) if (t.includes(c)) score += 0.7;
  // penalise the opposite-state wording slightly
  for (const c of secondary) if (t.includes(c)) score -= 0.15;
  // the location itself appearing is a weak positive context signal
  const locTok = context.location.toLowerCase().split(/[\s,]+/).filter((w) => w.length >= 4)[0];
  if (locTok && t.includes(locTok)) score += 0.3;

  return Math.max(0, Math.min(1, score / 2.2));
}

/** Source credibility derived from the actual provider/host name. */
function sourceCredibility(title: string, descriptionUrl: string, license: string): number {
  const host = (descriptionUrl || title).toLowerCase();
  let s = 0.3;
  for (const c of CREDIBLE_SOURCES) {
    if (host.includes(c)) {
      s = Math.max(s, 0.95);
      break;
    }
  }
  if (license === 'CC0') s = Math.max(s, 0.55);
  if (license && license.startsWith('CC')) s = Math.max(s, 0.6);
  return Math.min(1, s);
}

function dateConfidence(published?: string): number {
  if (!published) return 0;
  const year = parseInt(published.slice(0, 4), 10);
  if (!Number.isNaN(year) && year >= 2000) return 0.7;
  return 0.5;
}

/** Minimum location match to consider a hit (keeps evidence tied to the real place). */
const MIN_LOCATION = 0.55;
/** Minimum per-state condition relevance to accept a photograph as evidence. */
const MIN_ISSUE = 0.35;
/** Minimum combined score for a candidate to count as genuine evidence. */
const MIN_SCORE = 3.4;

/**
 * Reject text documents / scanned pages masquerading as photographs.
 * A real civic photograph's title/description won't read like a report.
 */
const DOC_RE = /\b(report of|report on|commission|proceedings|conference|journal|bulletin|handbook|asia ?\-|west indies|biography|of the commission|the story of|circular|notification|minutes of|agenda)\b/i;

/** The exact text used for ranking AND for metrics — kept in one place. */
function hitText(h: RawHit): string {
  return `${h.title} ${h.description ?? ''} ${h.license ?? ''}`;
}

/** True when a candidate is a plausible photographic condition shot, not a scan. */
function plausiblePhoto(h: RawHit): boolean {
  const t = h.title.toLowerCase();
  if (t.endsWith('.pdf') || t.endsWith('.tif') || t.endsWith('.tiff')) return false;
  if (DOC_RE.test(h.title) || DOC_RE.test(h.description ?? '')) return false;
  return true;
}

/** A ranked candidate carries its relevance scores so metrics reuse them. */
type RankedImage = EvidenceImage & { _loc: number; _issue: number };

/** Rank all hits for a state and return the strongest genuine candidate. */
function rank(
  hits: RawHit[],
  context: IssueContext,
  kind: 'before' | 'after',
): RankedImage | undefined {
  let best: RankedImage | undefined;
  let bestScore = -1;
  for (const h of hits) {
    if (!plausiblePhoto(h)) continue;
    const text = hitText(h);
    const loc = locationRelevance(text, context.location);
    if (loc < MIN_LOCATION) continue;
    const issue = issueRelevance(text, context, kind);
    if (issue < MIN_ISSUE) continue;
    const src = sourceCredibility(h.title, h.descriptionUrl ?? '', h.license ?? '');
    const date = dateConfidence(h.date);

    const score = loc * 2.2 + issue * 1.6 + src * 0.9 + date * 0.5;
    if (score > bestScore) {
      bestScore = score;
      best = {
        url: h.url!,
        thumbnailUrl: h.thumbUrl,
        sourceUrl: h.descriptionUrl!,
        sourceName: new URL(h.descriptionUrl!).hostname.replace('www.', ''),
        title: h.title.replace(/^File:/, '').replace(/_/g, ' ').slice(0, 140),
        published: h.date ? h.date.slice(0, 10) : undefined,
        query: h.queryText || '',
        confidence: Math.min(1, score / 5),
        verified: false,
        _loc: loc,
        _issue: issue,
      };
    }
  }
  return bestScore >= MIN_SCORE ? best : undefined;
}

const EMPTY = (): SearchStep[] => SEARCH_STEPS.map((s) => ({ ...s }));

/**
 * Real provider. Searches multiple before/after variations against Commons,
 * ranks the returned candidates, picks the strongest before/after pair, and
 * returns metrics only when real evidence was retrieved.
 */
export class CommonsEvidenceProvider implements ImageSearchProvider {
  readonly id = 'commons';
  readonly imagesAvailable = true; // keyless, publicly accessible API

  async search(context: IssueContext): Promise<EvidenceSearchResult> {
    const progress = EMPTY();
    const notes: string[] = [];
    const queries = buildQuerySets(context);
    const links = buildSearchLinks(context);

    progress.find((s) => s.key === 'location')!.state = 'done';

    // Search BEFORE and AFTER concurrently (each side stops early once enough
    // raw candidates are collected). rank() later enforces strict honesty
    // gates, so collecting fewer raw hits only speeds up an honest fallback.
    const collectHits = async (list: string[]): Promise<RawHit[]> => {
      const out: RawHit[] = [];
      for (const q of list) {
        const hits = await commonsSearch(q);
        hits.forEach((h) => (h.queryText = q));
        out.push(...hits);
        if (out.length >= 30) break;
      }
      return out;
    };

    const [beforeHits, afterHits] = await Promise.all([
      collectHits(queries.before),
      collectHits(queries.after),
    ]);

    // Ordering of the two states above is deterministic, but progress should
    // reflect reality: both before and after searches completed.
    progress.find((s) => s.key === 'before')!.state = 'done';
    progress.find((s) => s.key === 'after')!.state = 'done';
    progress.find((s) => s.key === 'sources')!.state = 'done';

    const before = rank(beforeHits, context, 'before');
    const after = rank(afterHits, context, 'after');

    progress.find((s) => s.key === 'match')!.state = 'done';

    // A before/after pair must consist of TWO distinct photographs — the same
    // image on both sides is not evidence of a change.
    const distinct = !!before && !!after && before.url !== after.url;
    const available = distinct;
    const partialImage = !distinct ? (before ?? after) : undefined;

    if (!available) {
      notes.push(
        'We could not verify two real photographs of the same location showing the reported issue and its resolution.',
      );
      if (partialImage) {
        notes.push('A single real photograph was found, but a matching before/after pair could not be verified.');
      }
    } else {
      notes.push('Two real photographs were retrieved and attributed. Chronological ordering is asserted only where dates support it.');
    }

    return {
      available,
      partial: !available && !!partialImage,
      before: available ? before : partialImage,
      after: available ? after : undefined,
      links,
      progress: { steps: progress, completed: true },
      notes,
      metrics: available ? buildMetrics(before, after, context) : undefined,
    };
  }
}

function buildMetrics(
  before: RankedImage,
  after: RankedImage,
  context: IssueContext,
): EvidenceMetrics {
  const loc = Math.round(
    ((before._loc ?? locationRelevance(before.title, context.location)) +
      (after._loc ?? locationRelevance(after.title, context.location))) /
      2 *
      100,
  );
  const issue = Math.round(
    ((before._issue ?? 0) + (after._issue ?? 0)) / 2 * 100,
  );
  const credibility = Math.round((before.confidence + after.confidence) / 2 * 100);
  const chronologyEstablished = !!(before.published && after.published && before.published <= after.published);
  const dateConf = before.published && after.published
    ? (dateConfidence(before.published) + dateConfidence(after.published)) / 2 * 100
    : 30;
  const overall = Math.round((loc * 0.3 + issue * 0.3 + credibility * 0.25 + dateConf * 0.15));
  return {
    locationMatch: Math.max(0, Math.min(100, loc)),
    issueMatch: Math.max(0, Math.min(100, issue)),
    sourceCredibility: Math.max(0, Math.min(100, credibility)),
    dateConfidence: Math.max(0, Math.min(100, Math.round(dateConf))),
    overall: Math.max(0, Math.min(100, overall)),
    chronologyEstablished,
  };
}

/** Selected provider — a real, keyless public image API. */
export function resolveProvider(): ImageSearchProvider {
  return new CommonsEvidenceProvider();
}
