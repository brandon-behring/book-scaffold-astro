/**
 * tests/katex-display-overflow.test.mjs — guards the display-math reflow fix (#162).
 *
 * KaTeX sets no `overflow` on `.katex-display`, so it defaults to `visible`: a
 * wide equation (long derivations, big matrices) overflows the viewport and the
 * whole page scrolls sideways on mobile — a WCAG 1.4.10 (Reflow) failure across
 * every math book. chapter.css must give `.katex-display` `overflow-x: auto` so
 * a too-wide equation scrolls WITHIN its own block instead. See #162.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(__dirname, '..', 'styles', 'chapter.css'), 'utf8');

test('chapter.css: .katex-display contains the overflow rule (#162)', () => {
  const block = css.match(/\.katex-display\s*\{([^}]*)\}/s);
  assert.ok(block, '.katex-display block present in chapter.css');
  assert.match(block[1], /overflow-x:\s*auto/, 'overflow-x: auto so wide display math scrolls in-block');
  assert.match(block[1], /overflow-y:\s*hidden/, 'overflow-y: hidden — no spurious vertical scrollbar');
});
