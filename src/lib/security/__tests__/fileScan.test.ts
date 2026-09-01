import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectPolyglotPayload,
  sanitizeUpload,
  stripImageMetadata,
} from '../fileScan';

/** Minimal, structurally-valid JPEG (SOI + a tiny body + EOI). */
function makeJpeg(extraTail: number[] = []): Buffer {
  const body = [
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, // APP0 JFIF
    0xff, 0xd9, // EOI
  ];
  return Buffer.from([...body, ...extraTail]);
}

test('fileScan: clean image is not flagged as polyglot', () => {
  const buf = makeJpeg();
  const r = detectPolyglotPayload(buf);
  assert.equal(r.flagged, false);
});

test('fileScan: appended ZIP payload is flagged', () => {
  const buf = makeJpeg([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
  const r = detectPolyglotPayload(buf);
  assert.equal(r.flagged, true);
  assert.match(r.reason ?? '', /ZIP/);
});

test('fileScan: appended ELF payload is flagged', () => {
  const buf = makeJpeg([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]);
  const r = detectPolyglotPayload(buf);
  assert.equal(r.flagged, true);
  assert.match(r.reason ?? '', /ELF/);
});

test('fileScan: appended PE (MZ) payload is flagged', () => {
  const buf = makeJpeg([0x4d, 0x5a, 0x90, 0x00]);
  const r = detectPolyglotPayload(buf);
  assert.equal(r.flagged, true);
  assert.match(r.reason ?? '', /MZ/);
});

test('fileScan: polyglot detection is fail-safe (never throws on odd input)', () => {
  assert.equal(detectPolyglotPayload(Buffer.alloc(0)).flagged, false);
  assert.equal(detectPolyglotPayload(Buffer.from([0xff])).flagged, false);
  assert.equal(detectPolyglotPayload(Buffer.from([0x50, 0x4b])).flagged, false);
});

test('fileScan: sanitizeUpload returns clean for a plain image buffer', async () => {
  const r = await sanitizeUpload({ buffer: makeJpeg(), kind: 'jpeg' });
  assert.equal(r.clean, true);
  assert.ok(Buffer.isBuffer(r.buffer));
  assert.equal(typeof r.metadataStripped, 'boolean');
});

test('fileScan: sanitizeUpload rejects a polyglot-flagged file', async () => {
  const r = await sanitizeUpload({ buffer: makeJpeg([0x50, 0x4b, 0x03, 0x04]), kind: 'jpeg' });
  assert.equal(r.clean, false);
  assert.ok(r.reason);
});

test('fileScan: stripImageMetadata passes through non-image kinds untouched', async () => {
  const mp4 = Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]);
  const r = await stripImageMetadata({ buffer: mp4, kind: 'mp4' });
  assert.equal(r.buffer.equals(mp4), true);
  assert.equal(r.stripped, false);
});
