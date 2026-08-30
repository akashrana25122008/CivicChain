/**
 * Server-side evidence file validation — never trusts the browser's declared
 * MIME type, file name, or size alone.
 *
 * The browser may supply anything (a renamed executable, a mismatched
 * extension, a truncated file). We verify in this order:
 *   1. allowed declared MIME + allowed extension
 *   2. size limit
 *   3. magic bytes: actual file signature vs. the declared type
 *   4. structural sanity: enough bytes + well-formed container markers, so a
 *      truncated/corrupted file (e.g. a PNG missing its IHDR/IEND) is rejected
 *      instead of being "successfully" stored.
 */

import { ACCEPTED_IMAGE_MIMES, ACCEPTED_VIDEO_MIMES, MAX_UPLOAD_BYTES } from './report';

export type DetectedKind = 'jpeg' | 'png' | 'webp' | 'heic' | 'mp4' | 'mov' | 'webm' | null;

/** Does the head of this buffer match this format's signature? */
type Signature = (b: Uint8Array) => boolean;

const PROBES: Array<{
  kind: Exclude<DetectedKind, null>;
  signature: Signature;
  structure: (b: Uint8Array) => boolean;
}> = [
  {
    // FF D8 FF (SOI) … FF D9 (EOI)
    kind: 'jpeg',
    signature: (b) =>
      b.length >= 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff && b[3] !== undefined,
    structure: (b) =>
      b.length >= 8 && b[b.length - 2] === 0xff && b[b.length - 1] === 0xd9,
  },
  {
    // 89 50 4E 47 0D 0A 1A 0A + IHDR chunk + IEND chunk
    kind: 'png',
    signature: (b) =>
      b.length >= 16 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a &&
      b[12] === 0x49 &&
      b[13] === 0x48 &&
      b[14] === 0x44 &&
      b[15] === 0x52,
    structure: (b) =>
      b.length >= 24 &&
      b[b.length - 8] === 0x49 &&
      b[b.length - 7] === 0x45 &&
      b[b.length - 6] === 0x4e &&
      b[b.length - 5] === 0x44,
  },
  {
    // "RIFF" <size> "WEBP"
    kind: 'webp',
    signature: (b) => b.length >= 12 && ascii(b, 0, 'RIFF') && ascii(b, 8, 'WEBP'),
    structure: (b) => {
      const size = readU32LE(b, 4) + 8;
      return b.length >= 20 && size >= b.length - 64 && size <= b.length + 64;
    },
  },
  {
    // ISO BMFF: size(4) "ftyp" brand(4)
    kind: 'heic',
    signature: (b) => b.length >= 12 && ascii(b, 4, 'ftyp'),
    structure: (b) => ['heic', 'heix', 'heif', 'mif1', 'msf1'].includes(asciiSlice(b, 8, 12)),
  },
  {
    // QuickTime movie: "ftyp" + "qt  " brand.
    kind: 'mov',
    signature: (b) => b.length >= 12 && ascii(b, 4, 'ftyp') && asciiSlice(b, 8, 12) === 'qt',
    structure: () => true,
  },
  {
    kind: 'mp4',
    signature: (b) => b.length >= 12 && ascii(b, 4, 'ftyp'),
    structure: (b) => /^[a-z0-9]{4}$/.test(asciiSlice(b, 8, 12) || ''),
  },
  {
    // EBML "1A 45 DF A3" + "webm"
    kind: 'webm',
    signature: (b) =>
      b.length >= 8 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3 && ascii(b, 4, 'webm'),
    structure: () => true,
  },
];

function ascii(b: Uint8Array, offset: number, expected: string): boolean {
  for (let i = 0; i < expected.length; i += 1) {
    if (b[offset + i] !== expected.charCodeAt(i)) return false;
  }
  return true;
}

function asciiSlice(b: Uint8Array, from: number, to: number): string {
  let out = '';
  for (let i = from; i < to && i < b.length; i += 1) {
    out += String.fromCharCode(b[i]);
  }
  return out;
}

/** RIFF sizes are little-endian. */
function readU32LE(b: Uint8Array, offset: number): number {
  return (
    (b[offset + 3] << 24) |
    (b[offset + 2] << 16) |
    (b[offset + 1] << 8) |
    b[offset]
  ) >>> 0;
}

export interface SniffResult {
  kind: DetectedKind;
  validStructure: boolean;
}

/** Detects the actual file kind from its leading bytes. */
export function sniffFileKind(buffer: Uint8Array): SniffResult {
  const head = buffer.subarray(0, Math.min(buffer.length, 80));
  for (const probe of PROBES) {
    if (probe.signature(head)) {
      // Structural sanity must run against the FULL buffer (e.g. JPEG EOI and
      // PNG IEND are terminal markers): an 80-byte preview cannot prove a
      // well-formed end of file.
      return { kind: probe.kind, validStructure: probe.structure(buffer) };
    }
  }
  return { kind: null, validStructure: false };
}

const EXTENSIONS_BY_KIND: Record<Exclude<DetectedKind, null>, string[]> = {
  jpeg: ['jpg', 'jpeg'],
  png: ['png'],
  webp: ['webp'],
  heic: ['heic', 'heif'],
  mp4: ['mp4'],
  mov: ['mov', 'qt'],
  webm: ['webm'],
};

const MIME_BY_KIND: Record<Exclude<DetectedKind, null>, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
};

function extensionOf(name: string): string {
  const idx = name.lastIndexOf('.');
  if (idx <= 0) return '';
  return name.slice(idx + 1).toLowerCase();
}

/**
 * Validates a single uploaded file. Throws TypeError with a user-safe message
 * on any failure so route handlers can surface it through the API error
 * contract without leaking internals.
 */
export function assertValidEvidenceFile(input: {
  buffer: Uint8Array;
  originalName: string;
  declaredMime: string;
}): { mimeType: string; detected: Exclude<DetectedKind, null> } {
  const { buffer, originalName, declaredMime } = input;

  if (buffer.byteLength === 0) {
    throw new TypeError('The uploaded file is empty.');
  }
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new TypeError(`"${originalName}" exceeds the ${MAX_UPLOAD_BYTES / 1024 / 1024} MB file limit.`);
  }

  const isImage = ACCEPTED_IMAGE_MIMES.has(declaredMime);
  const isVideo = ACCEPTED_VIDEO_MIMES.has(declaredMime);
  if (!isImage && !isVideo) {
    throw new TypeError(`Unsupported file type "${declaredMime || 'unknown'}". Only images and videos are accepted.`);
  }

  const sniff = sniffFileKind(buffer);
  if (sniff.kind === null) {
    throw new TypeError(`"${originalName}" is not a valid image/video file.`);
  }
  if (!sniff.validStructure) {
    throw new TypeError(`"${originalName}" appears to be corrupted or truncated.`);
  }

  const detectedMime = MIME_BY_KIND[sniff.kind];
  if (detectedMime !== declaredMime) {
    throw new TypeError(
      `"${originalName}" declares ${declaredMime} but its contents are ${detectedMime}.`,
    );
  }

  const ext = extensionOf(originalName);
  if (!ext || !EXTENSIONS_BY_KIND[sniff.kind].includes(ext)) {
    throw new TypeError(
      `"${originalName}" has an extension that does not match its contents (${detectedMime}).`,
    );
  }

  return { mimeType: detectedMime, detected: sniff.kind };
}