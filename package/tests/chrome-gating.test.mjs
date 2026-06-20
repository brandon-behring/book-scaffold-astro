/**
 * tests/chrome-gating.test.mjs — guards the showChrome opt-out (#163).
 *
 * The tools chrome (ToolFilter + VersionSelector islands) must be suppressible
 * by a consumer page WITHOUT borrowing the academic profile: a landing/hub page
 * passes `showChrome={false}` and gets the search + theme-toggle cluster only.
 * Before #163 the only chrome-free profile was `academic` (which also drags the
 * katex peer deps), so a tools-family hub had to misuse it.
 *
 * Source assertions on Base.astro (the repo's render-free test style, cf.
 * main-landmark.test.mjs).
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const base = readFileSync(join(__dirname, '..', 'layouts', 'Base.astro'), 'utf8');

test('Base.astro: showChrome is a declared prop, default true (#163)', () => {
  assert.match(base, /showChrome\?\s*:\s*boolean/, 'showChrome?: boolean in Props');
  assert.match(base, /showChrome\s*=\s*true/, 'showChrome defaults to true in the destructure');
});

test('Base.astro: showChrome gates the tools-chrome islands (#163)', () => {
  // showToolsChrome must AND-in showChrome, so showChrome={false} suppresses them.
  assert.match(
    base,
    /showToolsChrome\s*=\s*\(?\s*profile\s*!==\s*'academic'\s*\)?\s*&&\s*showChrome/,
    "showToolsChrome = (profile !== 'academic') && showChrome",
  );
  // ...and both islands render under showToolsChrome, so the gate actually applies.
  assert.match(base, /\{\s*showToolsChrome\s*&&\s*<ToolFilter/, 'ToolFilter gated by showToolsChrome');
  assert.match(base, /\{\s*showToolsChrome\s*&&\s*<VersionSelector/, 'VersionSelector gated by showToolsChrome');
});

test('Base.astro: the universal cluster (search + theme toggle) is NOT behind showChrome (#163)', () => {
  // theme-toggle must always render; it must not sit inside a showToolsChrome guard.
  assert.match(base, /id="theme-toggle"/, 'theme-toggle button present');
  assert.doesNotMatch(
    base,
    /showToolsChrome\s*&&[^\n]*id="theme-toggle"/,
    'theme-toggle must not be gated by showToolsChrome',
  );
});
