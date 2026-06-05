/**
 * tests/questions.test.mjs — node:test suite for the PURE questions helpers
 * (v4.17.0, Tier 3 #112/#117): grouping, sorting, and the objective-map
 * coverage derivation that backs <ObjectiveMap>.
 *
 * These are pure (no astro:content), so they import straight from dist/. Mock
 * entries use the same `{ data: {...} }` shape as a CollectionEntry. Run after
 * build.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  chapterLabel,
  sortQuestions,
  groupByDomain,
  groupByChapter,
  deriveObjectiveMap,
} from '../dist/index.mjs';

const entry = (id, domain, chapter) => ({ data: { id, domain, chapter } });

const BANK = [
  entry('q3', 'identity', 2),
  entry('q1', 'crypto', 1),
  entry('q2', 'crypto', 1),
  entry('q5', 'identity', 'appendix'),
  entry('q4', 'crypto', 2),
];

test('chapterLabel stringifies numeric + string chapters', () => {
  assert.equal(chapterLabel(1), '1');
  assert.equal(chapterLabel('appendix'), 'appendix');
});

test('sortQuestions orders numeric chapters first, then by id; strings last', () => {
  const ids = sortQuestions(BANK).map((e) => e.data.id);
  // ch1: q1,q2 (id order) → ch2: q3,q4 → string chapter 'appendix': q5
  assert.deepEqual(ids, ['q1', 'q2', 'q3', 'q4', 'q5']);
});

test('sortQuestions does not mutate the input array', () => {
  const before = BANK.map((e) => e.data.id);
  sortQuestions(BANK);
  assert.deepEqual(BANK.map((e) => e.data.id), before);
});

test('groupByDomain buckets by domain, preserving input order', () => {
  const g = groupByDomain(BANK);
  assert.deepEqual([...g.keys()], ['identity', 'crypto']);
  assert.deepEqual(g.get('crypto').map((e) => e.data.id), ['q1', 'q2', 'q4']);
  assert.deepEqual(g.get('identity').map((e) => e.data.id), ['q3', 'q5']);
});

test('groupByChapter buckets by chapter label', () => {
  const g = groupByChapter(BANK);
  assert.deepEqual(g.get('1').map((e) => e.data.id), ['q1', 'q2']);
  assert.deepEqual(g.get('2').map((e) => e.data.id), ['q3', 'q4']);
  assert.deepEqual(g.get('appendix').map((e) => e.data.id), ['q5']);
});

test('deriveObjectiveMap maps each domain → set of covered chapters (the <ObjectiveMap> backbone)', () => {
  const m = deriveObjectiveMap(BANK);
  assert.deepEqual([...m.get('crypto')].sort(), ['1', '2']);
  assert.deepEqual([...m.get('identity')].sort(), ['2', 'appendix']);
});

test('deriveObjectiveMap on an empty bank yields an empty map (honest no-coverage)', () => {
  assert.equal(deriveObjectiveMap([]).size, 0);
});
