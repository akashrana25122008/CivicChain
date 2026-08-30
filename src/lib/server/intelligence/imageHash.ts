/**
 * Perceptual image fingerprints for the duplicate engine's image signal.
 * Computed server-side with sharp/libvips: a 64-bit difference hash (dHash)
 * over the 9x8 grayscale thumbnail. Real, reproducible, and provider-free.
 * Simpler than an exact-content hash yet stable across minor re-encoding.
 *
 * sharp is pinned as a direct dependency (Next.js already ships it).
 */

type Sharp = typeof import('sharp')['default'];

let cachedSharp: Sharp | null = null;

async function loadSharp(): Promise<Sharp> {
  if (!cachedSharp) cachedSharp = (await import('sharp')).default;
  return cachedSharp;
}

/**
 * 64-bit dHash hex string for an image buffer, or null when the image cannot
 * be decoded (e.g. unreadable HEIC) — callers treat null as "signal absent",
 * never as a fabricated similarity.
 */
export async function computeDHashHex(buffer: Buffer): Promise<string | null> {
  try {
    const sharp = await loadSharp();
    const { data, info } = await sharp(buffer)
      .rotate()
      .resize(9, 8, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (info.width !== 9 || info.height !== 8 || data.length !== 72) return null;

    let bits = BigInt(0);
    for (let y = 0; y < 8; y += 1) {
      const row = y * 9;
      for (let x = 0; x < 8; x += 1) {
        // Determine 1 if the right pixel is brighter than the left.
        if (data[row + x + 1] > data[row + x]) {
          bits |= BigInt(1) << BigInt(x + y * 8);
        }
      }
    }
    return bits.toString(16).padStart(16, '0');
  } catch {
    return null;
  }
}

/** Hamming distance between two 16-char hex dHashes (0..64). */
export function dHashHammingDistance(a: string, b: string): number {
  let av = BigInt(`0x${a}`);
  let bv = BigInt(`0x${b}`);
  let dist = 0;
  while (av !== BigInt(0) || bv !== BigInt(0)) {
    const bit = (av & BigInt(1)) ^ (bv & BigInt(1));
    if (bit === BigInt(1)) dist += 1;
    av >>= BigInt(1);
    bv >>= BigInt(1);
  }
  return dist;
}

/** Perceptual similarity in [0,1]; identical hashes are 1. */
export function imageSimilarity(a: string, b: string): number {
  const distance = dHashHammingDistance(a, b);
  return Math.max(0, 1 - distance / 64);
}

/**
 * Pairwise best match between two sets of hashes. Returns null only when
 * either side has no usable hashes (signal unavailable).
 */
export function bestImageSimilarity(
  a: string[],
  b: string[],
): number | null {
  if (a.length === 0 || b.length === 0) return null;
  let best = 0;
  for (const ha of a) {
    for (const hb of b) {
      best = Math.max(best, imageSimilarity(ha, hb));
    }
  }
  return best;
}