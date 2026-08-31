import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PREFERENCES,
  validatePatchValue,
  unknownKeys,
  pickPatch,
  toView,
} from '../preferences';
import { requireProfilePatch } from '../profile';

test('validatePatchValue: theme accepts valid enums only', () => {
  assert.equal(validatePatchValue('theme', 'DARK'), null);
  assert.equal(validatePatchValue('theme', 'SYSTEM'), null);
  assert.match(validatePatchValue('theme', 'BLUE') ?? '', /must be one of/);
  assert.match(validatePatchValue('theme', 3) ?? '', /must be one of/);
});

test('validatePatchValue: language must be non-empty, trimmed', () => {
  assert.equal(validatePatchValue('language', 'en'), null);
  assert.equal(validatePatchValue('language', 'hi'), null);
  assert.match(validatePatchValue('language', '') ?? '', /non-empty/);
  assert.match(validatePatchValue('language', 'xx') ?? '', /not supported/);
  assert.match(validatePatchValue('language', 42) ?? '', /non-empty/);
});

test('validatePatchValue: boolean flags enforce booleans', () => {
  assert.equal(validatePatchValue('weeklyDigest', true), null);
  assert.equal(validatePatchValue('reportUpdates', false), null);
  assert.match(validatePatchValue('weeklyDigest', 'yes') ?? '', /must be a boolean/);
  assert.match(validatePatchValue('reportUpdates', 1) ?? '', /must be a boolean/);
});

test('validatePatchValue: unknown key rejected', () => {
  assert.match(validatePatchValue('hacked', 'x') ?? '', /Unknown preference/);
});

test('unknownKeys: only allowed preference keys are recognized', () => {
  assert.deepEqual(unknownKeys({ theme: 'DARK', language: 'en' }), []);
  assert.deepEqual(
    unknownKeys({ theme: 'DARK', malicious: 1 }),
    ['malicious'],
  );
});

test('pickPatch: drops unrecognized fields', () => {
  const { patch } = pickPatch({ theme: 'LIGHT', role: 'admin', weeklyDigest: true });
  assert.deepEqual(patch, { theme: 'LIGHT', weeklyDigest: true });
});

test('toView: maps a persisted row to the stable API shape', () => {
  const view = toView({
    theme: 'LIGHT',
    language: 'hi',
    weeklyDigest: true,
    reportUpdates: false,
  });
  assert.deepEqual(view, {
    theme: 'LIGHT',
    language: 'hi',
    weeklyDigest: true,
    reportUpdates: false,
  });
});

test('requireProfilePatch: allows name, trims, caps length', () => {
  const { patch, error } = requireProfilePatch({ name: '  Ada Lovelace  ' });
  assert.equal(error, undefined);
  assert.equal(patch.name, 'Ada Lovelace');
});

test('requireProfilePatch: rejects empty/oversized/unknown fields', () => {
  assert.match(requireProfilePatch({ name: '   ' }).error?.message ?? '', /non-empty/);
  assert.match(
    requireProfilePatch({ name: 'x'.repeat(81) }).error?.message ?? '',
    /80 characters/,
  );
  assert.match(
    requireProfilePatch({ role: 'ADMIN' }).error?.message ?? '',
    /Unknown profile field/,
  );
});

test('requireProfilePatch: email/role are never editable, empty patch ok', () => {
  const { patch, error } = requireProfilePatch({});
  assert.equal(error, undefined);
  assert.deepEqual(patch, {});
  assert.equal(DEFAULT_PREFERENCES.theme, 'SYSTEM');
  assert.equal(DEFAULT_PREFERENCES.language, 'en');
  assert.equal(DEFAULT_PREFERENCES.reportUpdates, true);
  assert.equal(DEFAULT_PREFERENCES.weeklyDigest, false);
});
