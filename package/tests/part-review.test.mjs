/**
 * tests/part-review.test.mjs — the PURE <PartReview> selection (#111),
 * extracted in the PR #131 review remediation so the aggregation is testable.
 * Imports from dist/ (node:test can't load TS). Run after build.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { selectPartExercises } from '../dist/index.mjs';

// Mock chapters — structurally what getCollection('chapters') yields.
const ch = (id, part, chapter) => ({ id, data: { part, chapter } });
const acadCh = (id, part, week) => ({ id, data: { part, week } });
const ex = (id) => ({ id, problem: `problem ${id}` });

test('selectPartExercises: numeric part — book order (not lexical) + total', () => {
  // Authored out of order; chapter 10 must sort AFTER chapter 2 (numeric, not "10" < "2").
  const chapters = [ch('p1-c10', 1, 10), ch('p1-c2', 1, 2), ch('p2-c1', 2, 1)];
  const byChapter = { 'p1-c10': [ex('x')], 'p1-c2': [ex('y'), ex('z')], 'p2-c1': [ex('w')] };
  const { groups, total } = selectPartExercises(chapters, byChapter, 1);
  assert.deepEqual(groups.map((g) => g.chapter), ['p1-c2', 'p1-c10']); // chapter 2 before 10
  assert.equal(total, 3);
});

test('selectPartExercises: STRING prop matches numeric-part chapters (the bug fix)', () => {
  // <PartReview part="2" /> — string prop, numeric chapter part. Pre-fix the strict
  // `=== part` returned nothing and rendered a misleading empty review.
  const chapters = [ch('d2-01', 2, 1), ch('d2-02', 2, 2)];
  const byChapter = { 'd2-01': [ex('a')], 'd2-02': [ex('b'), ex('c')] };
  const { groups, total } = selectPartExercises(chapters, byChapter, '2');
  assert.deepEqual(groups.map((g) => g.chapter), ['d2-01', 'd2-02']);
  assert.equal(total, 3);
});

test('selectPartExercises: numeric prop matches string-part chapters (symmetric)', () => {
  const chapters = [ch('c1', '3', 1)]; // chapter stores part as the string "3"
  const byChapter = { c1: [ex('a')] };
  assert.equal(selectPartExercises(chapters, byChapter, 3).total, 1); // numeric prop matches
});

test('selectPartExercises: academic string part matches + sorts by week', () => {
  const chapters = [acadCh('w2', 'foundations', 2), acadCh('w1', 'foundations', 1)];
  const byChapter = { w1: [ex('a')], w2: [ex('b')] };
  const { groups } = selectPartExercises(chapters, byChapter, 'foundations');
  assert.deepEqual(groups.map((g) => g.chapter), ['w1', 'w2']); // sorted by week
});

test('selectPartExercises: no matching chapters / no exercises → empty', () => {
  const chapters = [ch('d1-01', 1, 1)];
  assert.deepEqual(selectPartExercises(chapters, {}, 9), { groups: [], total: 0 }); // no match
  assert.deepEqual(selectPartExercises(chapters, {}, 1), { groups: [], total: 0 }); // match, no index
  assert.deepEqual(selectPartExercises(chapters, { 'd1-01': [] }, 1), { groups: [], total: 0 }); // empty arr
});

test('selectPartExercises: skips part-matching chapters that have no exercises', () => {
  const chapters = [ch('d1-01', 1, 1), ch('d1-02', 1, 2)];
  const byChapter = { 'd1-02': [ex('a')] }; // d1-01 has none
  const { groups, total } = selectPartExercises(chapters, byChapter, 1);
  assert.deepEqual(groups.map((g) => g.chapter), ['d1-02']);
  assert.equal(total, 1);
});
