import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractWardFromText,
  gridCellKey,
  humanLocationLabel,
} from '../geocode';

test('extractWardFromText: recognizes Ward N tokens', () => {
  assert.equal(extractWardFromText('Near market, Ward 12, Agra'), 'Ward 12');
  assert.equal(extractWardFromText('ward 3'), 'Ward 3');
  assert.equal(extractWardFromText('around Ward 45-A crossing'), 'Ward 45-A');
  assert.equal(extractWardFromText('Zone 4 sector'), 'Zone 4');
  assert.equal(extractWardFromText('Main road, zone 12a'), 'Zone 12A');
});

test('extractWardFromText: normalizes whitespace variants', () => {
  assert.equal(extractWardFromText('Ward\u00a012'), 'Ward 12');
  assert.equal(extractWardFromText('ward : 9'), 'Ward 9');
});

test('extractWardFromText: returns null when absent', () => {
  assert.equal(extractWardFromText(null), null);
  assert.equal(extractWardFromText(undefined), null);
  assert.equal(extractWardFromText(''), null);
  assert.equal(extractWardFromText('just a landmark near the park'), null);
  // The literal word "ward" without a number is not a ward reference.
  assert.equal(extractWardFromText('ward office'), null);
});

test('gridCellKey: deterministic grid identity for coordinates', () => {
  assert.equal(gridCellKey(21.17, 72.83), gridCellKey(21.17, 72.83));
  // Close-but-distinct cells stay distinct.
  assert.notEqual(gridCellKey(21.1701, 72.8301), gridCellKey(21.179, 72.839));
  assert.equal(gridCellKey(21.1755, 72.8355), 'area_21.180_72.840');
});

test('humanLocationLabel: prefers the citizen words, folds in ward when useful', () => {
  assert.equal(humanLocationLabel({ location: 'Near market' }), 'Near market');
  assert.equal(humanLocationLabel({ location: 'Near market', ward: 'Ward 12' }), 'Near market, Ward 12');
  // Ward already present in the location text is not duplicated.
  assert.equal(humanLocationLabel({ location: 'Near market, Ward 12', ward: 'Ward 12' }), 'Near market, Ward 12');
  assert.equal(humanLocationLabel({}), null);
  assert.equal(humanLocationLabel({ location: '   ' }), null);
});
