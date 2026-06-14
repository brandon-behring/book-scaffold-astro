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

test('TipsCard: imports tips.json via import.meta.glob (project-root-relative)', () => {
  const src = read('TipsCard');
  // v4.4.0: switched from `import('...')` to import.meta.glob for
  // node_modules-compatible resolution. Use [\s\S] (dotall-equivalent)
  // to span newlines since the path may be on a separate line in the
  // multi-line call.
  assert.match(src, /import\.meta\.glob[\s\S]*['"]\/src\/data\/tips\.json['"]/);
});

test('TipsCard: graceful skip when tips.json missing', () => {
  const src = read('TipsCard');
  // v4.4.0: import.meta.glob returns an empty object when the path matches no
  // files. The component checks the entry and falls back to empty tips array.
  // Older try/catch pattern is no longer needed; nullish coalescing handles it.
  assert.match(src, /\?\?\s*\[\]/);
});

test('TipsCard: links to base-aware /tips#tip-{n} permalinks (#140)', () => {
  const src = read('TipsCard');
  assert.match(src, /\$\{baseUrl\}tips#tip-\$\{tip\.n\}/);
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

test('Practice: difficulty is a closed union 1-4, validated fail-loud (#109 sweep)', () => {
  const src = read('Practice');
  // v4.15.0 sweep: the inline union became a const array → derived type, and
  // an out-of-range difficulty now throws via assertEnumProp instead of
  // rendering NaN/empty diamond markers. Still exactly 1-4.
  assert.match(src, /PRACTICE_DIFFICULTIES\s*=\s*\['1',\s*'2',\s*'3',\s*'4'\]\s*as const/);
  assert.match(src, /type Difficulty\s*=\s*\(typeof PRACTICE_DIFFICULTIES\)\[number\]/);
  assert.match(src, /assertEnumProp\(/);
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

// ===== PartReview (#111) =================================================

test('PartReview: requires part (number | string), optional title', () => {
  const src = read('PartReview');
  assert.match(src, /part:\s*number\s*\|\s*string/);
  assert.match(src, /title\?:\s*string/);
});

test('PartReview: reuses the build-exercises index (exercises.json)', () => {
  const src = read('PartReview');
  assert.match(src, /\/src\/data\/exercises\.json/);
});

test('PartReview: delegates selection to the pure selectPartExercises helper', () => {
  const src = read('PartReview');
  assert.match(src, /import \{ selectPartExercises \} from '\.\.\/src\/lib\/part-review'/);
  assert.match(src, /selectPartExercises\(chapters, byChapter, part\)/);
  assert.match(src, /getCollection\(['"]chapters['"]/);
});

test('PartReview: presence-gated build hint renders the real <code>, not a comment', () => {
  const src = read('PartReview');
  assert.match(src, /class="part-review"/);
  // Match the RENDERED hint specifically — `build-exercises` also appears in the
  // doc comment, so a loose /build-exercises/ would pass even if the hint block
  // were deleted (the F7 false-confidence trap the review caught).
  assert.match(src, /npx book-scaffold build-exercises<\/code>/);
  assert.match(src, /No exercises found in this part's chapters yet\./);
});
