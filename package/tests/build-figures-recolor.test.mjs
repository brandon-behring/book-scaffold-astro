/**
 * tests/build-figures-recolor.test.mjs — pure recolorSvg() rewrite (v4.11.0 #84).
 *
 * No external tools: feeds known pdftocairo/poppler-format SVG strings (the real
 * emitter writes `stroke="rgb(0%, 0%, 0%)"` presentation attributes — verified
 * against a live pdftocairo run) and asserts the theming rewrite. The end-to-end
 * pipeline is covered separately in build-figures-tikz.test.mjs.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { parseColor, classifyColor, recolorSvg } from '../src/lib/figure.mjs';

// Checked-in output from the real pdflatex -> pdftocairo pipeline. Keeping
// Poppler's exact percentage spellings here protects the parser/matcher from
// drifting toward hand-normalized fixture colors that the exporter never emits.
const RAW_POPPLER_SVG = readFileSync(
  new URL('./fixtures/figures/tikz-basic.poppler.svg', import.meta.url),
  'utf8',
);

// Minimal poppler-shaped fixture: black stroked path + black-filled <g> text,
// exactly the attribute syntax pdftocairo emits.
const POPPLER_SVG =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<svg xmlns="http://www.w3.org/2000/svg" width="68pt" height="60pt" viewBox="0 0 68 60">\n' +
  '<path fill="none" stroke-width="0.8" stroke="rgb(0%, 0%, 0%)" stroke-opacity="1" d="M 0 0 L 56 0 Z"/>\n' +
  '<g fill="rgb(0%, 0%, 0%)" fill-opacity="1"><use xlink:href="#g0" x="23" y="40"/></g>\n' +
  '</svg>\n';

test('recolorSvg: injects role + both style blocks + ink mapping', () => {
  const out = recolorSvg(POPPLER_SVG);
  assert.match(out, /<svg\b[^>]*\brole="img"/, 'adds role="img" to root <svg>');
  assert.match(out, /<style data-diagram-theme>/, 'injects standalone theme block');
  assert.match(out, /@media \(prefers-color-scheme:dark\)/, 'theme block carries an OS dark-mode rule');
  assert.match(out, /<style data-diagram-map="2">/, 'injects the versioned color-map block');
  assert.match(
    out,
    /\[stroke="rgb\(0%, 0%, 0%\)"\]\{stroke:var\(--diagram-ink, rgb\(0%, 0%, 0%\)\)\}/,
    'black stroke remaps to var(--diagram-ink, <orig>)',
  );
  assert.match(
    out,
    /\[fill="rgb\(0%, 0%, 0%\)"\]\{fill:var\(--diagram-ink, rgb\(0%, 0%, 0%\)\)\}/,
    'black fill remaps to var(--diagram-ink, <orig>)',
  );
});

test('recolorSvg: leaves the drawing elements untouched (attr stays as fallback)', () => {
  const out = recolorSvg(POPPLER_SVG);
  // The original presentation attributes survive verbatim — they are the
  // automatic fallback where var() is unsupported.
  assert.match(out, /<path fill="none" stroke-width="0.8" stroke="rgb\(0%, 0%, 0%\)"/);
  assert.match(out, /<g fill="rgb\(0%, 0%, 0%\)" fill-opacity="1">/);
});

test('recolorSvg: idempotent (second pass is a no-op)', () => {
  const once = recolorSvg(POPPLER_SVG);
  const twice = recolorSvg(once);
  assert.equal(twice, once, 're-theming an already-themed SVG changes nothing');
  assert.equal((once.match(/data-diagram-map/g) || []).length, 1, 'exactly one map block');
});

test('recolorSvg: upgrades a cached neutral-only map to the palette-aware map', () => {
  const old =
    '<svg xmlns="http://www.w3.org/2000/svg">' +
    '<style data-diagram-theme>:root{--diagram-ink:#1A1A19}</style>' +
    '<style data-diagram-map>[stroke="#3B6FA0"]{stroke:#3B6FA0}</style>' +
    '<path stroke="#3B6FA0" d="M0 0 L1 1"/>' +
    '</svg>';
  const out = recolorSvg(old);

  assert.match(out, /<style data-diagram-map="2">/, 'old map is replaced with current version');
  assert.match(out, /stroke:var\(--fig-blue, #3B6FA0\)/, 'canonical color gains semantic mapping');
  assert.equal((out.match(/data-diagram-theme/g) || []).length, 1, 'old standalone defaults are replaced');
  assert.equal((out.match(/data-diagram-map/g) || []).length, 1, 'old map is not retained');
  assert.equal(recolorSvg(out), out, 'migrated output is immediately idempotent');
});

test('recolorSvg: real Poppler fixture preserves opacity and maps both palette families', () => {
  const out = recolorSvg(RAW_POPPLER_SVG);

  assert.match(
    out,
    /var\(--fig-blue, rgb\(23\.136902%, 43\.528748%, 62\.745667%\)\)/,
    'Poppler spelling of canonical Warm–Tol blue maps to the semantic token',
  );
  assert.match(
    out,
    /var\(--series-1, rgb\(90\.194702%, 62\.353516%, 0%\)\)/,
    'Poppler spelling of Okabe–Ito orange maps to its ordinal series token',
  );
  assert.match(out, /fill-opacity="0\.14"/, 'base semantic color keeps separate fill opacity');
  assert.match(out, /<g fill="rgb\(0%, 0%, 0%\)" fill-opacity="1">/, 'text stays fully opaque');
  assert.equal(recolorSvg(out), out, 'real generated output is byte-stable on a second pass');
});

test('recolorSvg: real cached pre-v2 map migrates once, then remains byte-stable', () => {
  const current = recolorSvg(RAW_POPPLER_SVG);
  const oldCached = current.replace(
    /<style data-diagram-map="2">[\s\S]*?<\/style>/,
    '<style data-diagram-map>[fill="rgb(0%, 0%, 0%)"]{fill:var(--diagram-ink, rgb(0%, 0%, 0%))}</style>',
  );

  assert.notEqual(oldCached, current, 'fixture downgrade produces a pre-v2 cached artifact');
  const migrated = recolorSvg(oldCached);
  assert.equal(migrated, current, 'cached migration rebuilds the exact current palette-aware artifact');
  assert.equal(recolorSvg(migrated), migrated, 'current map sentinel makes later passes a no-op');
});

test('recolorSvg: optOut returns the input unchanged', () => {
  assert.equal(recolorSvg(POPPLER_SVG, { optOut: true }), POPPLER_SVG);
});

test('recolorSvg: preserves saturated accent colors (no remap rule)', () => {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg"><path fill="rgb(80%, 10%, 10%)" d="M0 0"/></svg>';
  const out = recolorSvg(svg);
  assert.ok(!out.includes('--diagram-'), 'no diagram var rule emitted for a saturated red');
  assert.match(out, /fill="rgb\(80%, 10%, 10%\)"/, 'accent color left exactly as authored');
  assert.match(out, /role="img"/, 'still surfaces role="img" for a11y');
});

test('recolorSvg: white→paper, mid-gray→grid', () => {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg">' +
    '<rect fill="rgb(100%, 100%, 100%)"/>' +
    '<path stroke="rgb(70%, 70%, 70%)"/>' +
    '</svg>';
  const out = recolorSvg(svg);
  assert.match(out, /\[fill="rgb\(100%, 100%, 100%\)"\]\{fill:var\(--diagram-paper,/);
  assert.match(out, /\[stroke="rgb\(70%, 70%, 70%\)"\]\{stroke:var\(--diagram-grid,/);
});

test('recolorSvg: no <svg> tag → unchanged; non-string → unchanged', () => {
  assert.equal(recolorSvg('not an svg'), 'not an svg');
  assert.equal(recolorSvg(null), null);
  assert.equal(recolorSvg(42), 42);
});

test('parseColor: rgb% / rgb255 / #hex3 / #hex6 / invalid', () => {
  assert.deepEqual(parseColor('rgb(0%, 0%, 0%)'), { r: 0, g: 0, b: 0 });
  assert.deepEqual(parseColor('rgb(100%, 100%, 100%)'), { r: 1, g: 1, b: 1 });
  assert.deepEqual(parseColor('rgb(255, 0, 0)'), { r: 1, g: 0, b: 0 });
  assert.deepEqual(parseColor('#fff'), { r: 1, g: 1, b: 1 });
  assert.deepEqual(parseColor('#000000'), { r: 0, g: 0, b: 0 });
  assert.equal(parseColor('none'), null);
  assert.equal(parseColor('url(#grad)'), null);
  assert.equal(parseColor('currentColor'), null);
  assert.equal(parseColor(undefined), null);
});

test('classifyColor: ink / paper / grid / accent(null)', () => {
  assert.equal(classifyColor('rgb(0%, 0%, 0%)'), 'ink');
  assert.equal(classifyColor('#222'), 'ink');
  assert.equal(classifyColor('rgb(100%, 100%, 100%)'), 'paper');
  assert.equal(classifyColor('rgb(50%, 50%, 50%)'), 'grid');
  assert.equal(classifyColor('rgb(80%, 10%, 10%)'), null, 'saturated red is an accent');
  assert.equal(classifyColor('none'), null);
});
