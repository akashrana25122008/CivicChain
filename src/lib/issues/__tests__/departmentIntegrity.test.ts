import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORY_LABELS,
  DEPARTMENT_BY_CATEGORY,
  DEFAULT_SEVERITY_BY_CATEGORY,
  defaultSeverityForCategory,
  getAuthorityDepartmentForCategory,
} from '../mapping';
import type { IssueCategory, Severity } from '../../../../generated/prisma/client';
import { DEPARTMENTS, isDepartmentName } from '../../server/departments/registry';

const SEVERITIES = new Set<Severity>(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

test('every non-OTHER category routes to a department (Phase 23 invariant)', () => {
  const categories = Object.keys(CATEGORY_LABELS) as IssueCategory[];
  assert.ok(categories.length >= 6, 'expected the full category vocabulary');
  for (const category of categories) {
    const dept = getAuthorityDepartmentForCategory(category);
    if (category === 'OTHER') {
      assert.equal(dept, null, 'OTHER is the explicit catch-all and must stay unassigned');
    } else {
      assert.ok(dept, `${category} must resolve to a department for routing`);
    }
  }
});

test('every category has a deterministic default severity (dev-order Phase 1)', () => {
  const categories = Object.keys(CATEGORY_LABELS) as IssueCategory[];
  for (const category of categories) {
    const severity = defaultSeverityForCategory(category);
    assert.ok(
      SEVERITIES.has(severity),
      `${category} must resolve to a real Severity value, got ${String(severity)}`,
    );
    assert.equal(
      DEFAULT_SEVERITY_BY_CATEGORY[category],
      severity,
      'mapping table and helper must agree',
    );
  }
  assert.equal(defaultSeverityForCategory('OTHER'), 'LOW');
});

test('severity mapping is exhaustive across the whole vocabulary', () => {
  const categories = Object.keys(CATEGORY_LABELS) as IssueCategory[];
  assert.deepEqual(
    Object.keys(DEFAULT_SEVERITY_BY_CATEGORY).sort(),
    categories.slice().sort(),
    'every category must appear exactly once in DEFAULT_SEVERITY_BY_CATEGORY',
  );
});

test('every mapped department name exists in the canonical registry', () => {
  const mapped = Object.values(DEPARTMENT_BY_CATEGORY).filter(
    (d): d is string => typeof d === 'string',
  );
  assert.ok(mapped.length > 0, 'mapping must declare at least one department');
  for (const dept of mapped) {
    assert.ok(
      isDepartmentName(dept),
      `mapped department "${dept}" is missing from the DEPARTMENTS registry — ` +
        'seeding and routing would silently disagree',
    );
  }
});

test('registry names are unique and non-empty', () => {
  assert.equal(new Set(DEPARTMENTS).size, DEPARTMENTS.length, 'duplicate department names');
  for (const name of DEPARTMENTS) {
    assert.ok(name.trim().length > 0, 'empty department name');
  }
});