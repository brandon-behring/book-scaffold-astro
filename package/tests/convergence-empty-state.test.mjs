/**
 * tests/convergence-empty-state.test.mjs — source-contract tests for the
 * v4.14.0 (#86) fix: the injected /convergence route must not error when a
 * tools-profile book uses <Convergence> inline but defines no
 * `changelog/patterns.yaml` (so the `patterns` collection is unregistered).
 *
 * Same source-contract pattern as provenance-component.test.mjs: the visual
 * suite has no tools fixture that exercises /convergence, and patterns.ts
 * imports `astro:content` (so it can't be imported into a plain-node test).
 * We assert on the source that the presence-gate + empty-state wiring is in
 * place. Full runtime proof is the fixture build at release (a tools book
 * without patterns.yaml builds /convergence clean).
 *
 * Run: node --test tests/convergence-empty-state.test.mjs
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG = join(__dirname, '..');
const patterns = readFileSync(join(PKG, 'src', 'lib', 'patterns.ts'), 'utf8');
const route = readFileSync(join(PKG, 'pages', 'convergence.astro'), 'utf8');

// ===== patterns.ts: the pure all-empty map =====

test('patterns: exports a pure emptyPatternsByCategory() built from patternCategories', () => {
  assert.match(patterns, /export function emptyPatternsByCategory\(\)/);
  // built from the category enum, not a hand-listed object literal
  assert.match(patterns, /emptyPatternsByCategory[\s\S]*?patternCategories\.map/);
});

test('patterns: getPatternsByCategory reuses emptyPatternsByCategory (no duplicate seed)', () => {
  assert.match(
    patterns,
    /getPatternsByCategory[\s\S]*?const grouped = emptyPatternsByCategory\(\)/,
  );
});

// ===== convergence.astro: the presence-gate (mirrors references.astro) =====

test('convergence: gates on the changelog/patterns.yaml manifest presence', () => {
  assert.match(
    route,
    /import\.meta\.glob\(\s*['"]\/changelog\/patterns\.yaml['"]/,
  );
  assert.match(route, /const hasPatterns\s*=/);
});

test('convergence: reads the collection only when present, else the empty map', () => {
  // ternary: present → await getPatternsByCategory(); absent → emptyPatternsByCategory()
  assert.match(
    route,
    /hasPatterns[\s\S]*?await getPatternsByCategory\(\)[\s\S]*?:\s*emptyPatternsByCategory\(\)/,
  );
});

test('convergence: no unconditional getPatternsByCategory() call remains (#86 regression guard)', () => {
  // the old line that crashed when `patterns` was unregistered
  assert.doesNotMatch(route, /const grouped = await getPatternsByCategory\(\);/);
});

test('convergence: surfaces an actionable hint when the manifest is absent (#86 audit)', () => {
  // a missing/misnamed changelog/patterns.yaml must not look identical to a
  // legitimately-empty registry — cf. tips.astro / references.astro.
  assert.match(route, /noManifestHint/);
  assert.match(route, /changelog\/patterns\.yaml found/);
});
