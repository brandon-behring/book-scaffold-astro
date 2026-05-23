/**
 * tests/poc-layout-css.test.mjs — assert poc-layouts.css contract.
 *
 * Each of the 5 kinds must declare all 3 CSS variables. Asserts the
 * variable surface stays narrow (line-length, vertical-rhythm,
 * heading-emphasis) — adding a new variable requires updating this test
 * + documenting it in recipe 15.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(__dirname, '..', 'styles', 'poc-layouts.css');
const css = readFileSync(CSS_PATH, 'utf8');

const KINDS = ['tutorial', 'how-to', 'tldr', 'part-summary', 'cheat-sheet'];
const VARS = [
  '--bs-content-line-length',
  '--bs-content-vertical-rhythm',
  '--bs-heading-emphasis',
];

for (const kind of KINDS) {
  test(`poc-layouts.css: .poc-layout-${kind} block exists`, () => {
    assert.match(css, new RegExp(`\\.poc-layout-${kind}`), `selector for ${kind}`);
  });

  test(`poc-layouts.css: .poc-layout-${kind} sets all 3 CSS vars`, () => {
    // Extract just the block for this kind, then check vars inside it.
    const blockRegex = new RegExp(
      `:where\\(\\.poc-layout-${kind}\\)\\s*\\{([^}]*)\\}`,
      's',
    );
    const match = css.match(blockRegex);
    assert.ok(match, `block for ${kind} found`);
    for (const v of VARS) {
      assert.match(match[1], new RegExp(v.replace(/[-]/g, '\\-')), `${v} in ${kind} block`);
    }
  });
}

test('poc-layouts.css: cheat-sheet sets table width to 100%', () => {
  assert.match(css, /\.poc-layout-cheat-sheet\s+table\s*\{[^}]*width:\s*100%/s);
});

test('poc-layouts.css: .poc-layout base reads --bs-content-line-length', () => {
  assert.match(css, /\.poc-layout\s*\{[^}]*max-width:\s*var\(--bs-content-line-length/s);
});
