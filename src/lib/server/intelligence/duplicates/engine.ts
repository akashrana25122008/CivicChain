/**
 * Duplicate detection engine (spec: independent from AI + priority).
 * Combines five real signals into a single 0-1 confidence score:
 *   geographic (PostGIS distance), text (trigram overlap), image (dHash),
 *   time (recency decay), category (match). Confidence never affects what is
 *   stored — it only informs banding and incident clustering.
 *
 * Unavailable signals contribute 0 but are excluded from the denominator, so
 * the score is a weighted mean over whatever evidence actually exists.
 */
import { prisma } from '@/lib/db';
import { intelligenceConfig } from '@/lib/server/intelligence/config';
import { reportTextSimilarity } from '@/lib/server/intelligence/textSimilarity';
import { bestImageSimilarity } from '@/lib/server/intelligence/imageHash';
import type { Issue } from '../../../../../generated/prisma/client';

export type DuplicateBand = 'probably_new' | 'possible' | 'strong';

export interface DuplicateSignals {
  /** 0-1 (null = not computable: a side lacks coordinates). */
  geographic: number | null;
  text: number | null;
  image: number | null;
  time: number;
  category: number;
  /** Human-readable names of the signals that were available. */
  contributors: string[];
}

export interface DuplicateVerdict {
  candidateIssueId: string;
  candidatePublicId: string;
  candidateIncidentId: string | null;
  /** Distance in metres when both sides have coordinates, else null. */
  distanceMeters: number | null;
  confidence: number;
  band: DuplicateBand;
  signals: DuplicateSignals;
}

interface CandidateRow {
  id: string;
  publicId: string;
  title: string;
  description: string | null;
  category: string;
  createdAt: Date;
  latitude: number | null;
  longitude: number | null;
  incidentId: string | null;
  dist: number | null;
}

/** Data the engine needs about the report being checked. */
export interface DuplicateSourceIssue {
  id: string;
  publicId: string;
  title: string;
  description: string | null;
  category: Issue['category'] | string;
  latitude: number | null;
  longitude: number | null;
  createdAt: Date;
  /** Perceptual hashes of the report's images (already persisted). */
  imageHashes: string[];
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function bandFor(confidence: number): DuplicateBand {
  const { possibleThreshold, strongThreshold } = intelligenceConfig.duplicate;
  if (confidence >= strongThreshold) return 'strong';
  if (confidence >= possibleThreshold) return 'possible';
  return 'probably_new';
}

async function spatialCandidates(
  issue: DuplicateSourceIssue,
): Promise<CandidateRow[]> {
  const { geoSearchRadiusMeters, lookbackDays, maxCandidates } = intelligenceConfig.duplicate;
  if (issue.latitude == null || issue.longitude == null) return [];
  const since = new Date(Date.now() - lookbackDays * 86_400_000);
  return prisma.$queryRaw<CandidateRow[]>`
    SELECT i.id, i."publicId" AS "publicId", i.title, i.description, i."category"::text AS category, i."createdAt" AS "createdAt",
           i.latitude, i.longitude, i."incidentId" AS "incidentId",
           ST_Distance(i."geoLocation"::geography,
                       ST_SetSRID(ST_MakePoint(${issue.longitude}, ${issue.latitude}), 4326)::geography) AS dist
    FROM "Issue" i
    WHERE i."id" <> ${issue.id}
      AND i."geoLocation" IS NOT NULL
      AND i."createdAt" >= ${since}
      AND ST_DWithin(i."geoLocation"::geography,
                     ST_SetSRID(ST_MakePoint(${issue.longitude}, ${issue.latitude}), 4326)::geography,
                     ${geoSearchRadiusMeters})
    ORDER BY dist ASC
    LIMIT ${maxCandidates}`;
}

async function recentCandidates(issue: DuplicateSourceIssue): Promise<CandidateRow[]> {
  const { lookbackDays, maxCandidates } = intelligenceConfig.duplicate;
  const since = new Date(Date.now() - lookbackDays * 86_400_000);
  const rows = await prisma.$queryRaw<CandidateRow[]>`
    SELECT i.id, i."publicId" AS "publicId", i.title, i.description, i."category"::text AS category, i."createdAt" AS "createdAt",
           i.latitude, i.longitude, i."incidentId" AS "incidentId", NULL AS dist
    FROM "Issue" i
    WHERE i."id" <> ${issue.id}
      AND i."createdAt" >= ${since}
    ORDER BY i."createdAt" DESC
    LIMIT ${maxCandidates}`;
  return rows;
}

async function hashesForIssues(
  ids: string[],
): Promise<Map<string, string[]>> {
  if (ids.length === 0) return new Map();
  const rows = await prisma.evidence.findMany({
    where: { issueId: { in: ids }, type: 'IMAGE', perceptualHash: { not: null } },
    select: { issueId: true, perceptualHash: true },
  });
  const map = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.perceptualHash) continue;
    const list = map.get(row.issueId) ?? [];
    list.push(row.perceptualHash);
    map.set(row.issueId, list);
  }
  return map;
}

/**
 * Scores the report against all nearby/recent candidates and returns the best
 * match, or null when nothing plausibly similar exists.
 */
export async function evaluateDuplicate(
  issue: DuplicateSourceIssue,
): Promise<DuplicateVerdict | null> {
  const { possibleThreshold, textMinLength, timeDecayDays, weights } =
    intelligenceConfig.duplicate;

  const spatial = await spatialCandidates(issue);
  const fallback = issue.latitude == null ? await recentCandidates(issue) : [];
  const seen = new Set<string>();
  const candidates = [...spatial, ...fallback].filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return c.id !== issue.id;
  });
  if (candidates.length === 0) return null;

  const hashes = await hashesForIssues(candidates.map((c) => c.id));
  const issueHashes = issue.imageHashes;

  let best: {
    row: CandidateRow;
    confidence: number;
    signals: DuplicateSignals;
    distanceMeters: number | null;
  } | null = null;

  for (const row of candidates) {
    // --- text -------------------------------------------------------------
    let text: number | null = null;
    if (issue.title.length >= textMinLength && row.title.length >= textMinLength) {
      text = reportTextSimilarity(
        { title: issue.title, description: issue.description },
        { title: row.title, description: row.description },
      );
    }

    // --- geographic --------------------------------------------------------
    let geographic: number | null = null;
    let distanceMeters: number | null = null;
    if (issue.latitude != null && issue.longitude != null && row.latitude != null && row.longitude != null) {
      const d = row.dist ?? haversine(issue.latitude, issue.longitude, row.latitude, row.longitude);
      distanceMeters = d;
      geographic = clamp01(1 - d / (intelligenceConfig.duplicate.geoSearchRadiusMeters * 2));
    }

    // --- image -------------------------------------------------------------
    let image: number | null = null;
    if (issueHashes.length > 0) {
      const cand = hashes.get(row.id);
      if (cand && cand.length > 0) image = bestImageSimilarity(issueHashes, cand);
    }

    // --- time ----------------------------------------------------------------
    const ageDays = (issue.createdAt.getTime() - row.createdAt.getTime()) / 86_400_000;
    const time = clamp01(1 - ageDays / timeDecayDays);

    // --- category --------------------------------------------------------------
    const category = row.category === issue.category ? 1 : 0;

    const contributors: string[] = [];
    if (geographic != null) contributors.push('geographic');
    if (text != null) contributors.push('text');
    if (image != null) contributors.push('image');
    contributors.push('time', 'category');

    const hasCoreSignal = geographic != null || text != null || image != null;
    if (!hasCoreSignal) continue;

    const available = contributors.reduce(
      (sum, name) =>
        sum +
        (name === 'geographic'
          ? weights.geographic
          : name === 'text'
            ? weights.text
            : name === 'image'
              ? weights.image
              : name === 'time'
                ? weights.time
                : weights.category),
      0,
    );
    const weighted =
      (geographic ?? 0) * weights.geographic +
      (text ?? 0) * weights.text +
      (image ?? 0) * weights.image +
      time * weights.time +
      category * weights.category;
    const confidence = available > 0 ? weighted / available : 0;
    if (confidence < possibleThreshold) continue;

    if (!best || confidence > best.confidence) {
      best = {
        row,
        confidence,
        distanceMeters,
        signals: {
          geographic,
          text,
          image,
          time,
          category,
          contributors,
        },
      };
    }
  }

  if (!best) return null;
  return {
    candidateIssueId: best.row.id,
    candidatePublicId: best.row.publicId,
    candidateIncidentId: best.row.incidentId,
    distanceMeters: best.distanceMeters,
    confidence: best.confidence,
    band: bandFor(best.confidence),
    signals: best.signals,
  };
}

function haversine(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}