/**
 * tests/assert-prop.test.mjs — node:test suite for assertEnumProp, the shared
 * fail-loud validator behind the v4.15.0 closed-union prop sweep
 * (PocLayout / StatusBadge / Practice).
 *
 * Tests import from dist/ since node:test can't load TS. Run after build.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { assertEnumProp } from '../dist/index.mjs';

const KINDS = ['tutorial', 'how-to', 'tldr'];

test('assertEnumProp: returns a valid value unchanged', () => {
  assert.equal(assertEnumProp('tutorial', KINDS, { component: 'PocLayout', prop: 'kind' }), 'tutorial');
  assert.equal(assertEnumProp('tldr', KINDS, { component: 'PocLayout', prop: 'kind' }), 'tldr');
});

test('assertEnumProp: throws an actionable error on an invalid value', () => {
  assert.throws(
    () => assertEnumProp('bogus', KINDS, { component: 'PocLayout', prop: 'kind' }),
    /<PocLayout>: kind="bogus" is not one of tutorial, how-to, tldr\./,
  );
});

test('assertEnumProp: throws on undefined (missing prop) — no silent default', () => {
  assert.throws(
    () => assertEnumProp(undefined, KINDS, { component: 'StatusBadge', prop: 'status' }),
    /<StatusBadge>: status=nothing is not one of/,
  );
});

test('assertEnumProp: a non-string value is rejected too', () => {
  assert.throws(
    () => assertEnumProp(3, ['1', '2', '3', '4'], { component: 'Practice', prop: 'difficulty' }),
    /<Practice>: difficulty=3 is not one of 1, 2, 3, 4\./,
  );
});
