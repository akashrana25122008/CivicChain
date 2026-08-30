import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Evidence object storage — one abstraction, two backends.
 *
 * - **S3-compatible object storage** (Cloudflare R2 / AWS S3 / MinIO) is used
 *   when `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY` and
 *   `STORAGE_SECRET_KEY` are all present. The S3 client is imported lazily so
 *   the local backend never loads the SDK.
 * - **Local disk** (the Phase 1 dev default, `EVIDENCE_STORAGE_DIR`) is used
 *   otherwise.
 *
 * Files are never stored inside PostgreSQL; the database only records the
 * stable object KEY returned here. `url` is that key (no leading slash), e.g.
 * `evidence/202608/<timestamp>-<uuid>.<ext>`. Stored keys are private: they
 * are served to browsers only through the authorized evidence-file route.
 *
 * Credentials never reach the browser — they live in server env vars only.
 */

export interface StoredEvidence {
  /** Stable object key, also persisted as Evidence.url. */
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

interface S3Config {
  endpoint: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  region: string;
  forcePathStyle: boolean;
}

function s3Configured(): boolean {
  return Boolean(
    process.env.STORAGE_ENDPOINT &&
      process.env.STORAGE_BUCKET &&
      process.env.STORAGE_ACCESS_KEY &&
      process.env.STORAGE_SECRET_KEY,
  );
}

function getS3Config(): S3Config {
  return {
    endpoint: process.env.STORAGE_ENDPOINT as string,
    bucket: process.env.STORAGE_BUCKET as string,
    accessKey: process.env.STORAGE_ACCESS_KEY as string,
    secretKey: process.env.STORAGE_SECRET_KEY as string,
    region: process.env.STORAGE_REGION || 'auto',
    forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === 'true',
  };
}

function objectKey(input: { originalName: string; mimeType: string; buffer: Buffer }): string {
  const stamp = new Date().toISOString().slice(0, 7).replace('-', '');
  const ext = safeExtension(input.originalName);
  return `evidence/${stamp}/${Date.now()}-${randomUUID().slice(0, 10)}${ext}`;
}

function safeExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  if (idx <= 0) return '';
  const ext = name.slice(idx).toLowerCase();
  return /^\.\w{1,10}$/.test(ext) ? ext : '';
}

async function loadS3Client(): Promise<
  { client: import('@aws-sdk/client-s3').S3Client; PutObjectCommand: typeof import('@aws-sdk/client-s3').PutObjectCommand; GetObjectCommand: typeof import('@aws-sdk/client-s3').GetObjectCommand; DeleteObjectCommand: typeof import('@aws-sdk/client-s3').DeleteObjectCommand }
> {
  const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } =
    await import('@aws-sdk/client-s3');
  const cfg = getS3Config();
  const client = new S3Client({
    endpoint: cfg.endpoint,
    region: cfg.region,
    forcePathStyle: cfg.forcePathStyle,
    credentials: { accessKeyId: cfg.accessKey, secretAccessKey: cfg.secretKey },
  });
  return { client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand };
}

/** Persists an uploaded object and returns its stable key + metadata. */
export async function storeEvidenceFile(input: {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
}): Promise<StoredEvidence> {
  const key = objectKey(input);

  if (s3Configured()) {
    const { client, PutObjectCommand } = await loadS3Client();
    const cfg = getS3Config();
    await client.send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
        Body: input.buffer,
        ContentType: input.mimeType,
        ACL: 'private',
      }),
    );
    return {
      url: key,
      fileName: input.originalName || key,
      mimeType: input.mimeType,
      sizeBytes: input.buffer.byteLength,
    };
  }

  const dir = process.env.EVIDENCE_STORAGE_DIR || 'private/uploads';
  await mkdir(join(dir, dirname(key)), { recursive: true });
  await writeFile(resolveKey(dir, key), input.buffer);
  return {
    url: key,
    fileName: input.originalName || key,
    mimeType: input.mimeType,
    sizeBytes: input.buffer.byteLength,
  };
}

function dirname(key: string): string {
  const idx = key.lastIndexOf('/');
  return idx > 0 ? key.slice(0, idx) : '';
}

/** Resolve an object key safely against the local store root. */
function resolveKey(dir: string, key: string): string {
  const safe = key.replace(/^\/+/, '');
  if (safe.includes('..')) throw new Error('Invalid storage key.');
  return join(dir, safe);
}

/** Reads a stored object. Throws if it is missing or unreadable. */
export async function readEvidenceFile(
  key: string,
): Promise<{ data: Buffer; mimeType: string }> {
  if (s3Configured()) {
    const { client, GetObjectCommand } = await loadS3Client();
    const cfg = getS3Config();
    const obj = await client.send(
      new GetObjectCommand({ Bucket: cfg.bucket, Key: key }),
    );
    if (!obj.Body) throw new Error('Empty object body.');
    const chunks: Uint8Array[] = [];
    for await (const chunk of obj.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return { data: Buffer.concat(chunks), mimeType: obj.ContentType || 'application/octet-stream' };
  }

  const dir = process.env.EVIDENCE_STORAGE_DIR || 'private/uploads';
  const data = await readFile(resolveKey(dir, key));
  return { data, mimeType: 'application/octet-stream' };
}

/** Deletes a stored object (orphan cleanup). Never throws on ENOENT. */
export async function deleteEvidenceFile(key: string): Promise<void> {
  if (s3Configured()) {
    const { client, DeleteObjectCommand } = await loadS3Client();
    const cfg = getS3Config();
    await client
      .send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }))
      .catch(() => undefined);
    return;
  }
  const dir = process.env.EVIDENCE_STORAGE_DIR || 'private/uploads';
  await rm(resolveKey(dir, key), { force: true }).catch(() => undefined);
}

/** True when the object-storage backend is active (used for health checks). */
export function storageBackend(): 's3' | 'local' {
  return s3Configured() ? 's3' : 'local';
}