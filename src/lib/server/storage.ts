import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';

/**
 * Simple local disk storage for uploaded evidence (development).
 *
 * Files are written under EVIDENCE_STORAGE_DIR (default public/uploads) and
 * served back at /uploads/* by the static folder. Failures throw and abort the
 * enclosing report transaction — an upload is never silently pretended to have
 * succeeded.
 *
 * Production: replace with object storage (S3/R2) keeping the same URL shape.
 */
export async function storeEvidenceFile(input: {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
}): Promise<{ url: string; fileName: string }> {
  const dir = process.env.EVIDENCE_STORAGE_DIR || 'public/uploads';
  const ext = safeExtension(input.originalName);
  const fileName = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, fileName), input.buffer);
  return { url: `/uploads/${fileName}`, fileName: input.originalName || fileName };
}

function safeExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  if (idx <= 0) return '';
  const ext = name.slice(idx).toLowerCase();
  return /^\.\w{1,10}$/.test(ext) ? ext : '';
}