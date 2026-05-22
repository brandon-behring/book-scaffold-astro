/**
 * tests/chapters-sort.test.mjs — node:test suite for chapterSortKey.
 *
 * Run after `npm run build`: tests import from dist/ since node:test can't
 * load TS directly. Closes #24 regression coverage — previously the sort key
 * computed `part * 1000 + chapter` on academic chapters where `part` is a
 * string and `chapter` is undefined, producing NaN and crashing the rendered
 * `/chapters` route on academic profile books with `routes.chapters=true`
 * (consumer:double-ml-time-series surfaced this).
 *
 * Run: node --test tests/chapters-sort.test.mjs
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { chapterSortKey } from '../dist/index.mjs';

// ===== Tools-profile schema (numeric part + chapter) =====

test('tools schema: part 1, chapter 0 sorts before part 1, chapter 1', () => {
  const a = chapterSortKey({ part: 1, chapter: 0, volatility: 'feature-surface' });
  const b = chapterSortKey({ part: 1, chapter: 1, volatility: 'feature-surface' });
  assert.ok(a < b, `expected ${a} < ${b}`);
});

test('tools schema: part 1 chapter 99 sorts before part 2 chapter 0', () => {
  const a = chapterSortKey({ part: 1, chapter: 99 });
  const b = chapterSortKey({ part: 2, chapter: 0 });
  assert.ok(a < b, `expected ${a} < ${b}`);
});

test('tools schema: appendix (part 6) sorts after all numbered parts', () => {
  const last = chapterSortKey({ part: 5, chapter: 99 });
  const appendix = chapterSortKey({ part: 6, chapter: 1 });
  assert.ok(appendix > last, `expected ${appendix} > ${last}`);
});

// ===== Academic-profile schema (string-enum part + numeric week) =====
// Closes #24: these must NOT throw and must produce monotonic ordering.

test('academic schema: foundations week 1 has a finite numeric sort key', () => {
  const k = chapterSortKey({ part: 'foundations', week: 1, status: 'implemented' });
  assert.equal(typeof k, 'number');
  assert.ok(Number.isFinite(k), `expected finite, got ${k}`);
  assert.ok(!Number.isNaN(k), 'expected non-NaN sort key');
});

test('academic schema: foundations week 1 sorts before foundations week 2', () => {
  const a = chapterSortKey({ part: 'foundations', week: 1 });
  const b = chapterSortKey({ part: 'foundations', week: 2 });
  assert.ok(a < b, `expected ${a} < ${b}`);
});

test('academic schema: foundations sorts before ssm-core', () => {
  const a = chapterSortKey({ part: 'foundations', week: 99 });
  const b = chapterSortKey({ part: 'ssm-core', week: 1 });
  assert.ok(a < b, `expected ${a} < ${b}`);
});

test('academic schema: synthesis (last enum) sorts after foundations (first)', () => {
  const first = chapterSortKey({ part: 'foundations', week: 1 });
  const last = chapterSortKey({ part: 'synthesis', week: 1 });
  assert.ok(last > first, `expected ${last} > ${first}`);
});

test('academic schema: full part enum ordering matches src/schemas.ts academicParts', () => {
  // Order from src/schemas.ts: foundations, ssm-core, beyond-ssm, integration, synthesis
  const keys = ['foundations', 'ssm-core', 'beyond-ssm', 'integration', 'synthesis'].map(
    (part) => chapterSortKey({ part, week: 1 }),
  );
  for (let i = 1; i < keys.length; i++) {
    assert.ok(keys[i] > keys[i - 1], `enum position ${i} not strictly greater`);
  }
});

// ===== Resilience: unknown shapes (consumer extensions, partial data) =====

test('unknown part-enum value sorts to the end (does not throw)', () => {
  const known = chapterSortKey({ part: 'foundations', week: 1 });
  const unknown = chapterSortKey({ part: 'consumer-custom-part', week: 1 });
  assert.ok(unknown > known, `expected unknown to sort after known: ${unknown} > ${known}`);
});

test('missing chapter and week defaults to 0 (no crash)', () => {
  const k = chapterSortKey({ part: 1 });
  assert.equal(typeof k, 'number');
  assert.ok(Number.isFinite(k));
});

test('empty data object returns a finite sort key (defensive)', () => {
  const k = chapterSortKey({});
  assert.equal(typeof k, 'number');
  assert.ok(Number.isFinite(k));
});
