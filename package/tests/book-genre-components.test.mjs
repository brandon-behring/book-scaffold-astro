/**
 * tests/book-genre-components.test.mjs — contract tests for v4.3.0
 * book-genre components: Tip, TipsCard, Exercise, Practice, Solution,
 * ExerciseSolutions. Closes #70 + #71.
 *
 * Same pattern as pedagogy-callouts.test.mjs (v4.1.0): asserts on the
 * .astro source (Props interface + key class names + slot semantics).
 * Full DOM verification deferred to fixture-pedagogy-style visual fixture.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMPONENTS_DIR = join(__dirname, '..', 'components');

function read(name) {
  return readFileSync(join(COMPONENTS_DIR, `${name}.astro`), 'utf8');
}

// ===== Tip (#70) =========================================================

test('Tip: requires n + title props', () => {
  const src = read('Tip');
  assert.match(src, /n:\s*string\s*\|\s*number/);
  assert.match(src, /title:\s*string/);
});

test('Tip: anchor id is prefixed "tip-"', () => {
  const src = read('Tip');
  assert.match(src, /tip-\$\{n\}/);
});

test('Tip: renders .callout-tip-numbered class (distinct from TipBox)', () => {
  const src = read('Tip');
  assert.match(src, /class="callout callout-tip-numbered"/);
});

test('Tip: displays "Tip {n}" label', () => {
  const src = read('Tip');
  assert.match(src, />Tip \{n\}</);
});

// ===== TipsCard (#70) ===================================================

test('TipsCard: imports tips.json via dynamic import', () => {
  const src = read('TipsCard');
  assert.match(src, /import\(['"][^'"]*tips\.json['"]/);
});

test('TipsCard: graceful skip when tips.json missing', () => {
  const src = read('TipsCard');
  assert.match(src, /try\s*\{/);
  assert.match(src, /catch\s*\{/);
});

test('TipsCard: links to /tips#tip-{n} permalinks', () => {
  const src = read('TipsCard');
  assert.match(src, /\/tips#tip-\$\{tip\.n\}/);
});

// ===== Exercise (#71) ====================================================

test('Exercise: requires id prop', () => {
  const src = read('Exercise');
  assert.match(src, /id:\s*string/);
});

test('Exercise: anchor id is prefixed "exercise-"', () => {
  const src = read('Exercise');
  assert.match(src, /exercise-\$\{id\}/);
});

test('Exercise: renders .exercise class + "Exercise" label', () => {
  const src = read('Exercise');
  assert.match(src, /class="exercise"/);
  assert.match(src, />Exercise</);
});

// ===== Practice (#71) ====================================================

test('Practice: requires id + difficulty props', () => {
  const src = read('Practice');
  assert.match(src, /id:\s*string/);
  assert.match(src, /difficulty:\s*Difficulty/);
});

test('Practice: difficulty type is closed union "1" | "2" | "3" | "4"', () => {
  const src = read('Practice');
  // Inlined as single line per v4.1.0 PocLayout lesson (Astro frontmatter parser).
  assert.match(src, /type Difficulty\s*=\s*'1'\s*\|\s*'2'\s*\|\s*'3'\s*\|\s*'4'/);
});

test('Practice: anchor id is prefixed "practice-"', () => {
  const src = read('Practice');
  assert.match(src, /practice-\$\{id\}/);
});

test('Practice: renders difficulty markers via ◆/◇', () => {
  const src = read('Practice');
  assert.match(src, /'◆'\.repeat\(filled\)/);
  assert.match(src, /'◇'\.repeat\(4 - filled\)/);
});

// ===== Solution (#71) ====================================================

test('Solution: requires for prop (renamed to forId internally)', () => {
  const src = read('Solution');
  assert.match(src, /for:\s*string/);
  assert.match(src, /const \{ for: forId \}/);
});

test('Solution: backlinks to #exercise-{forId}', () => {
  const src = read('Solution');
  assert.match(src, /#exercise-\$\{forId\}/);
});

test('Solution: anchor id is prefixed "solution-"', () => {
  const src = read('Solution');
  assert.match(src, /solution-\$\{forId\}/);
});

// ===== ExerciseSolutions (#71) ===========================================

test('ExerciseSolutions: emits "Exercise solutions" heading', () => {
  const src = read('ExerciseSolutions');
  assert.match(src, />Exercise solutions</);
});

test('ExerciseSolutions: anchor id is "exercise-solutions"', () => {
  const src = read('ExerciseSolutions');
  assert.match(src, /id="exercise-solutions"/);
});

test('ExerciseSolutions: provides slot for manually-placed <Solution> elements', () => {
  const src = read('ExerciseSolutions');
  assert.match(src, /<slot\s*\/?>/);
});
