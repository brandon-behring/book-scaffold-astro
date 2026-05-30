/**
 * tests/xref-component.test.mjs — guards components/XRef.astro against two
 * v4.9.0 regressions:
 *
 *   1. A JSDoc block comment in the .astro frontmatter whose embedded example
 *      contains a literal close-comment delimiter closes the doc comment early;
 *      the trailing brace then parses as code and esbuild throws
 *      `Unexpected "}"` on EVERY MDX import of the component. A pure source
 *      grep can't catch this, so we reproduce the real path with esbuild.
 *   2. Documenting HTML comments as the way to comment out an <XRef> in MDX —
 *      MDX rejects HTML comments; the JSX expression-comment form is correct.
 *
 * Zero test-framework deps (node:test built-in). Uses esbuild — already an
 * Astro dependency — to transform the frontmatter exactly as Astro does.
 *
 * Run: node --test tests/xref-component.test.mjs
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';

const __dirname = dirname(fileURLToPath(import.meta.url));
const XREF = resolve(__dirname, '..', 'components', 'XRef.astro');

/** Extract the TypeScript frontmatter (between the first pair of `---` fences). */
function frontmatter(astroSource) {
  const m = astroSource.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(m, 'XRef.astro must open with a --- frontmatter fence');
  return m[1];
}

test('XRef.astro frontmatter compiles — no trapped close-comment delimiter', async () => {
  const fm = frontmatter(readFileSync(XREF, 'utf8'));
  // Astro hands the frontmatter to esbuild as TS. A close-comment delimiter
  // trapped inside a block comment throws `Unexpected "}"`. Pre-v4.9.0 this
  // threw on every MDX import; it must not now.
  await transform(fm, { loader: 'ts' });
});

test('XRef.astro documents the MDX-correct comment form, not HTML comments', () => {
  const fm = frontmatter(readFileSync(XREF, 'utf8'));
  assert.ok(
    fm.includes('{/* <XRef'),
    'should keep the JSX-expression comment example authors actually use',
  );
  assert.ok(
    !fm.includes('<!--'),
    'must not advise HTML comments — MDX rejects them (use {/* */})',
  );
});
