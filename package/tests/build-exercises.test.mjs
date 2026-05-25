/**
 * tests/build-exercises.test.mjs — extractExercises() unit tests (v4.4.0).
 *
 * Mirrors build-tips test pattern (v4.3.0). Verifies the regex extractor
 * handles single + double quoted ids + multiple exercises + graceful skip
 * on malformed input.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { extractExercises } from '../scripts/build-exercises.mjs';

test('extractExercises: extracts double-quoted Exercise', () => {
  const src = `<Exercise id="ex-1">First exercise problem.</Exercise>`;
  const ex = extractExercises(src);
  assert.equal(ex.length, 1);
  assert.equal(ex[0].id, 'ex-1');
  assert.equal(ex[0].problem, 'First exercise problem.');
});

test('extractExercises: extracts single-quoted Exercise', () => {
  const src = `<Exercise id='ex-2'>Second exercise.</Exercise>`;
  const ex = extractExercises(src);
  assert.equal(ex.length, 1);
  assert.equal(ex[0].id, 'ex-2');
  assert.equal(ex[0].problem, 'Second exercise.');
});

test('extractExercises: extracts multiple Exercises in one source', () => {
  const src = `
    <Exercise id="ex-1">First.</Exercise>
    Intervening prose.
    <Exercise id="ex-2">Second.</Exercise>
    <Exercise id="ex-3">Third.</Exercise>
  `;
  const ex = extractExercises(src);
  assert.equal(ex.length, 3);
  assert.equal(ex[0].id, 'ex-1');
  assert.equal(ex[1].id, 'ex-2');
  assert.equal(ex[2].id, 'ex-3');
});

test('extractExercises: normalizes whitespace in problem body', () => {
  const src = `<Exercise id="ex-1">
    Multi-line   problem
    body  text.
  </Exercise>`;
  const ex = extractExercises(src);
  assert.equal(ex[0].problem, 'Multi-line problem body text.');
});

test('extractExercises: preserves full body (no truncation)', () => {
  const longBody = 'word '.repeat(50).trim();
  const src = `<Exercise id="ex-long">${longBody}</Exercise>`;
  const ex = extractExercises(src);
  assert.equal(ex[0].problem, longBody);
});

test('extractExercises: skips Exercise with no id attribute', () => {
  const src = `<Exercise>body</Exercise>`;
  const ex = extractExercises(src);
  assert.equal(ex.length, 0);
});

test('extractExercises: skips Exercise with empty id', () => {
  const src = `<Exercise id="">body</Exercise>`;
  const ex = extractExercises(src);
  assert.equal(ex.length, 0);
});

test('extractExercises: empty source returns empty array', () => {
  assert.equal(extractExercises('').length, 0);
});

test('extractExercises: source with no Exercise tags returns empty array', () => {
  const src = `# Chapter\n\n<Practice id="pr-1" difficulty="2">P</Practice>\n\n<TryThis>x</TryThis>`;
  const ex = extractExercises(src);
  assert.equal(ex.length, 0);
});
