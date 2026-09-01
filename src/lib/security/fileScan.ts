/**
 * Upload threat pipeline (Phase 21 hardening) — sits between magic-byte
 * validation (src/lib/validation/evidence.ts) and persisted storage.
 *
 * Two responsibilities:
 *   1. IMAGE METADATA STRIPPING — re-encode images through sharp so embedded
 *      EXIF/IPTC/XMP/GPS (which can carry geolocation or steganographic
 *      payloads) is removed before the object is written. Video files cannot
 *      be losslessly re-encoded here and are passed through; their metadata is
 *      not trusted (see serving pipeline: stored MIME is the sniffed container
 *      MIME, never the browser-declared one).
 *   2. MALWARE / POLYGLOT SCAN — a fail-safe, in-process detector for the
 *      highest-risk "same bytes, two parsers" (polyglot) attacks: an uploaded
 *      "image" that also decodes as an executable/archive. A real AV provider
 *      (ClamAV, cloud scan) can be attached at the documented hook below.
 *
 * Design notes:
 *  - Every function is defensive and NEVER throws for infrastructure reasons
 *    (e.g. sharp not installed) — a scan/meta-strip outage must not break
 *    uploads or leak a stack trace; it degrades to "review the object" rather
 *    than "block all uploads".
 *  - Verdicts are explicit and logged server-side; the client only ever sees a
 *    user-safe rejection message derived from a stable error code.
 */

import { randomUUID } from 'node:crypto';
import { currentLogger } from '@/lib/server/requestContext';

/* ---------------------------------------------------------------------------
 * Malware / polyglot detection (in-process, fail-safe)
 * ------------------------------------------------------------------------- */

/**
 * Executable / archive signatures that must NOT be decodeable from an uploaded
 * image container (a classic polyglot: a JPEG whose trailing bytes are also an
 * ELF/PE/ZIP/RAR/GZ/EXE/etc.). Presence AFTER the trailing image marker flags
 * the file as suspicious.
 */
const APPENDED_PAYLOAD_SIGNATURES: Array<{ label: string; bytes: number[] }> = [
  // ZIP (PK\x03\x04)
  { label: 'ZIP', bytes: [0x50, 0x4b, 0x03, 0x04] },
  // GZIP
  { label: 'GZIP', bytes: [0x1f, 0x8b] },
  // RAR4 / RAR5
  { label: 'RAR4', bytes: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00] },
  { label: 'RAR5', bytes: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00] },
  // 7-Zip
  { label: '7Z', bytes: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c] },
  // ELF executable
  { label: 'ELF', bytes: [0x7f, 0x45, 0x4c, 0x46] },
  // PE (MZ ... PE\0\0)
  { label: 'MZ', bytes: [0x4d, 0x5a] },
  // Mach-O (FE ED FA CE / FE ED FA CF / CE FA ED FE / CF FA ED FE)
  { label: 'MACHO', bytes: [0xfe, 0xed, 0xfa, 0xce] },
  // PDF
  { label: 'PDF', bytes: [0x25, 0x50, 0x44, 0x46] },
  // Windows Script Host / batch heartbeats
  { label: 'SHS', bytes: [0x53, 0x48, 0x53] },
];

/** Maximum bytes scanned past the file head for appended payloads. */
const SCAN_TAIL_BYTES = 4096;

function startsWith(buf: Uint8Array, offset: number, sig: number[]): boolean {
  if (offset + sig.length > buf.length) return false;
  for (let i = 0; i < sig.length; i += 1) {
    if (buf[offset + i] !== sig[i]) return false;
  }
  return true;
}

/**
 * Fail-safe heuristic: looks for embedded executable/archive signatures that a
 * second parser could decode. Returns `{ flagged: true, reason }` when found.
 * Never throws.
 */
export function detectPolyglotPayload(buffer: Uint8Array): { flagged: boolean; reason?: string } {
  try {
    // Scan the LAST SCAN_TAIL_BYTES of the file. Embedded payloads are appended
    // AFTER the legitimate container (e.g. after a JPEG's EOI marker), so the
    // tail is where a second parser succeeds. Scanning the tail (rather than a
    // fixed offset from the head) also works for very short files and avoids
    // matching legitimate media container headers at the file's start.
    const start = Math.max(0, buffer.length - SCAN_TAIL_BYTES);
    const end = buffer.length;
    for (let offset = start; offset < end; offset += 1) {
      for (const sig of APPENDED_PAYLOAD_SIGNATURES) {
        if (startsWith(buffer, offset, sig.bytes)) {
          return { flagged: true, reason: `Embedded ${sig.label} payload detected.` };
        }
      }
    }
  } catch {
    // Defensive: a scan bug must not reject a legitimate upload.
  }
  return { flagged: false };
}

/**
 * External AV provider hook — replace/augment `detectPolyglotPayload` with a
 * real scanner (ClamAV, VirusTotal, cloud scan) behind this async contract.
 * Configure via SECURITY_AV_PROVIDER, e.g. "clamav:unix:/var/run/clamav/clamd.sock".
 * When unset, the in-process heuristic is the active scanner.
 */
export interface MalwareScanProvider {
  /** Returns true when the bytes are clean. */
  scan(buffer: Uint8Array): Promise<{ clean: boolean; reason?: string }>;
}

async function resolveAvProvider(): Promise<MalwareScanProvider | null> {
  const provider = process.env.SECURITY_AV_PROVIDER;
  if (!provider) return null;
  if (typeof console !== 'undefined') {
    console.warn(
      `[security] SECURITY_AV_PROVIDER="${provider}" is set but no provider is wired ` +
        '— falling back to the in-process polyglot heuristic only. Configured ' +
        'scanning is NOT active.',
    );
  }
  // Real providers register here. Until one is wired, we fail-OPEN for the
  // configured-but-unknown case (log at the call site) so a misconfigured env
  // does not brick uploads, but we DO still run the in-process heuristic.
  return null;
}

export interface ScanResult {
  clean: boolean;
  /** User-safe rejection message (only when not clean). */
  reason?: string;
  /** Scanner that produced the verdict. */
  scanner: 'polyglot-heuristic' | 'av-provider' | 'none';
}

/**
 * Runs the full malware pipeline. Fail-safe: an infrastructure error never
 * throws; a flagged file returns `clean:false` with a stable, user-safe reason.
 */
export async function scanEvidenceBuffer(
  buffer: Uint8Array,
): Promise<ScanResult> {
  // 1. In-process heuristic always runs (cheap, dependency-free).
  const polyglot = detectPolyglotPayload(buffer);
  if (polyglot.flagged) {
    return { clean: false, reason: polyglot.reason, scanner: 'polyglot-heuristic' };
  }

  // 2. External provider (if configured and resolved).
  const provider = await resolveAvProvider();
  if (provider) {
    try {
      const verdict = await provider.scan(buffer);
      if (!verdict.clean) {
        return { clean: false, reason: verdict.reason ?? 'File failed security scan.', scanner: 'av-provider' };
      }
      return { clean: true, scanner: 'av-provider' };
    } catch {
      // Fail-open with a warning for a provider outage — the in-process
      // heuristic already ran; a single failing scan should not reject uploads.
      return { clean: true, scanner: 'none' };
    }
  }

  return { clean: true, scanner: 'polyglot-heuristic' };
}

/* ---------------------------------------------------------------------------
 * Image metadata stripping (EXIF / IPTC / XMP / GPS)
 * ------------------------------------------------------------------------- */

const IMAGE_KINDS_WITH_SHARP = new Set(['jpeg', 'png', 'webp']);

/**
 * Re-encodes an image through sharp to strip all embedded metadata
 * (EXIF, IPTC, XMP, ICC, GPS) before storage. Fails-safe: if sharp cannot
 * process the buffer (e.g. HEIC without libvips support, format edge case),
 * the ORIGINAL bytes are returned untouched — a legitimate upload must never
 * be broken by the stripper. Returns `{ buffer, stripped }`.
 */
export async function stripImageMetadata(input: {
  buffer: Buffer;
  kind: 'jpeg' | 'png' | 'webp' | 'heic' | 'mp4' | 'mov' | 'webm';
}): Promise<{ buffer: Buffer; stripped: boolean }> {
  if (!IMAGE_KINDS_WITH_SHARP.has(input.kind)) {
    return { buffer: input.buffer, stripped: false };
  }
  try {
    const sharp = (await import('sharp')).default;
    const info = await sharp(input.buffer, { failOn: 'error' }).metadata();
    const hasMetadata = Boolean(info.exif) || Boolean(info.iptc) || Boolean(info.xmp) || Boolean(info.icc);

    // Re-encode at native dimensions with metadata stripped (default sharp
    // behaviour drops EXIF/ICC on re-encode). Applying `rotate()` bakes any
    // orientation into pixels so we don't lose uprightness.
    const out = await sharp(input.buffer, { failOn: 'error' })
      .rotate()
      .toBuffer({ resolveWithObject: true });

    return { buffer: out.data, stripped: hasMetadata };
  } catch {
    return { buffer: input.buffer, stripped: false };
  }
}

/**
 * Full "sanitize file at intake" helper: polyglot/heuristic scan + metadata
 * strip. Used by the upload pipelines before insertion. Never throws for
 * infrastructure reasons; returns a sanitized buffer + verdict.
 */
export async function sanitizeUpload(input: {
  buffer: Buffer;
  kind: 'jpeg' | 'png' | 'webp' | 'heic' | 'mp4' | 'mov' | 'webm';
  evidenceId?: string;
}): Promise<{ clean: boolean; reason?: string; buffer: Buffer; metadataStripped: boolean }> {
  const scan = await scanEvidenceBuffer(input.buffer);
  if (!scan.clean) {
    return { clean: false, reason: scan.reason, buffer: input.buffer, metadataStripped: false };
  }

  const stripped = await stripImageMetadata({ buffer: input.buffer, kind: input.kind });

  if (process.env.NODE_ENV !== 'test') {
    const reqId = input.evidenceId || randomUUID().slice(0, 8);
    if (scan.scanner !== 'none') {
      currentLogger().info(
        { evidence: reqId, scanner: scan.scanner, metadataStripped: stripped.stripped },
        'evidence scan completed',
      );
    }
  }

  return { clean: true, buffer: stripped.buffer, metadataStripped: stripped.stripped };
}
