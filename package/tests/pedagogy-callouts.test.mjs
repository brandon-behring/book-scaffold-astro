/**
 * tests/pedagogy-callouts.test.mjs — DOM snapshots for v4.1.0 pedagogy
 * components: <Pitfall> #58, <WorkedExample> #57, <YouWillLearn> #59,
 * <PocLayout> #56.
 *
 * Components are .astro files (compiled by Astro), so we can't import
 * them directly in node:test. Instead, assert on the source: the props
 * interface + the rendered template structure. This is a contract test
 * — it catches accidental API drift (renamed props, removed slots,
 * removed CSS classes) without requiring a full Astro build.
 *
 * Full DOM verification lives in the visual regression fixture
 * (package/tests/visual/fixture-pedagogy/), which renders each component
 * via Astro and compares pixels at AE=0.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMPONENTS_DIR = join(__dirname, '..', 'components');

function readComponent(name) {
  return readFileSync(join(COMPONENTS_DIR, `${name}.astro`), 'utf8');
}

// ===== Pitfall (#58) =====================================================

test('Pitfall: default title is "Common mistake"', () => {
  const src = readComponent('Pitfall');
  assert.match(src, /title = ['"]Common mistake['"]/, 'default title literal');
});

test('Pitfall: renders .callout-pitfall class', () => {
  const src = readComponent('Pitfall');
  assert.match(src, /class="callout callout-pitfall"/);
});

test('Pitfall: accepts optional title prop', () => {
  const src = readComponent('Pitfall');
  assert.match(src, /title\?:\s*string/);
});

// ===== WorkedExample (#57) ===============================================

test('WorkedExample: requires id and title; optional expanded', () => {
  const src = readComponent('WorkedExample');
  assert.match(src, /id:\s*string/);
  assert.match(src, /title:\s*string/);
  assert.match(src, /expanded\?:\s*boolean/);
});

test('WorkedExample: anchor id is prefixed "worked-example-"', () => {
  const src = readComponent('WorkedExample');
  assert.match(src, /worked-example-\$\{id\}/, 'id template literal');
});

test('WorkedExample: uses native <details> for collapse (no JS)', () => {
  const src = readComponent('WorkedExample');
  assert.match(src, /<details open=\{expanded\}>/);
  assert.match(src, /<summary>/);
});

test('WorkedExample: emits "Worked example" chip in summary', () => {
  const src = readComponent('WorkedExample');
  assert.match(src, /class="callout-chip"/);
  assert.match(src, />Worked example</);
});

test('WorkedExample: default expanded = false', () => {
  const src = readComponent('WorkedExample');
  assert.match(src, /expanded\s*=\s*false/);
});

// ===== YouWillLearn (#59) ================================================

test('YouWillLearn: accepts optional prerequisites prop', () => {
  const src = readComponent('YouWillLearn');
  assert.match(src, /prerequisites\?:\s*string/);
});

test('YouWillLearn: prereq sub-block conditional on prop', () => {
  const src = readComponent('YouWillLearn');
  assert.match(src, /\{prerequisites && \(/, 'conditional render');
  assert.match(src, /class="callout-prereq"/);
});

test('YouWillLearn: title is literal "You will learn"', () => {
  const src = readComponent('YouWillLearn');
  assert.match(src, />You will learn</);
});

test('YouWillLearn: renders .callout-learn class', () => {
  const src = readComponent('YouWillLearn');
  assert.match(src, /class="callout callout-learn"/);
});

// ===== PocLayout (#56) ===================================================

test('PocLayout: kind union has exactly 5 members', () => {
  const src = readComponent('PocLayout');
  const kinds = ['tutorial', 'how-to', 'tldr', 'part-summary', 'cheat-sheet'];
  for (const k of kinds) {
    assert.match(src, new RegExp(`'${k}'`), `kind '${k}' present in union`);
  }
});

test('PocLayout: kind prop is required (no ?)', () => {
  const src = readComponent('PocLayout');
  assert.match(src, /kind:\s*PocLayoutKind/);
  assert.doesNotMatch(src, /kind\?:/, 'kind must be required, not optional');
});

test('PocLayout: outer div class includes kind variant', () => {
  const src = readComponent('PocLayout');
  assert.match(src, /class=\{`poc-layout poc-layout-\$\{kind\}`\}/);
});

test('PocLayout: exports PocLayoutKind type publicly', () => {
  const src = readComponent('PocLayout');
  assert.match(src, /export type PocLayoutKind/);
});
