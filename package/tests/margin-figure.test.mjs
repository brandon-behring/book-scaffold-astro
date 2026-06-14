/**
 * tests/margin-figure.test.mjs — 1d contract tests for:
 *   - <MarginFigure> (the Tufte margin figure that floats into the gutter)
 *   - the ADDITIVE layout.css placement rules (.column-margin / .margin-figure /
 *     .column-page) + the per-page width knob (.prose[data-layout="wide"])
 *   - a REGRESSION GUARD for the 1d hard constraint: `.prose` must NOT gain
 *     `display: grid`, and the `.sidenote` float technique must be untouched.
 *
 * Source-contract style (like pedagogy-callouts.test.mjs / poc-layout-css.test.mjs):
 * .astro + .css are read as text and asserted on, catching API/contract drift
 * without a full Astro build.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const marginFigure = readFileSync(join(ROOT, 'components', 'MarginFigure.astro'), 'utf8');
const layoutCss = readFileSync(join(ROOT, 'styles', 'layout.css'), 'utf8');
const chapterLayout = readFileSync(join(ROOT, 'layouts', 'Chapter.astro'), 'utf8');

// The rendered TEMPLATE only (everything after the closing `---` frontmatter
// fence) — so prose inside the component's doc comment (which legitimately
// MENTIONS <img>/set:html when explaining the delegation) doesn't trip the
// "doesn't reinvent Figure" assertions below.
const marginFigureTemplate = marginFigure.slice(marginFigure.lastIndexOf('---') + 3);

// ===== MarginFigure.astro (delegates rendering to Figure) =================

test('MarginFigure: delegates rendering to <Figure> (does not reinvent SVG/img)', () => {
  assert.match(marginFigure, /import Figure from '\.\/Figure\.astro'/);
  assert.match(marginFigureTemplate, /<Figure\b/, 'renders a <Figure>');
  // The TEMPLATE must NOT re-implement Figure internals (no raw <img>/set:html).
  assert.doesNotMatch(marginFigureTemplate, /<img\b/, 'no hand-rolled <img> — that is Figure’s job');
  assert.doesNotMatch(marginFigureTemplate, /set:html/, 'no hand-rolled SVG inlining');
});

test('MarginFigure: forwards the figure prop surface', () => {
  for (const prop of ['src', 'caption', 'width', 'id', 'alt', 'desc']) {
    assert.match(marginFigure, new RegExp(`\\b${prop}\\b`), `forwards ${prop}`);
  }
});

test('MarginFigure: wraps in .margin-figure (the gutter-float hook)', () => {
  assert.match(marginFigure, /class="margin-figure"/);
});

test('MarginFigure: width defaults to 100% of the gutter column', () => {
  assert.match(marginFigure, /width = ['"]100%['"]/);
});

// ===== Additive layout.css placement + width knob =========================

test('layout.css: .column-margin + .margin-figure float into the gutter via the sidenote technique', () => {
  // The shared @media (min-width: 64rem) block lists both selectors and uses
  // the same negative margin-right pull as .sidenote.
  assert.match(layoutCss, /\.column-margin\s*,\s*\.margin-figure\s*\{/);
  assert.match(
    layoutCss,
    /margin-right:\s*calc\(\s*-1\s*\*\s*\(var\(--measure-side\)\s*\+\s*var\(--space-6\)\)\s*\)/,
    'gutter pull mirrors .sidenote / SectionMap',
  );
});

test('layout.css: .column-page is a full-width breakout (alias of .wide)', () => {
  const block = layoutCss.match(/\.column-page\s*\{([^}]*)\}/);
  assert.ok(block, '.column-page block exists');
  assert.match(block[1], /max-width:\s*none\s*!important/);
  assert.match(block[1], /width:\s*100%/);
});

test('layout.css: per-page width knob widens --measure-main on [data-layout="wide"]', () => {
  const block = layoutCss.match(/\.prose\[data-layout="wide"\]\s*\{([^}]*)\}/);
  assert.ok(block, '.prose[data-layout="wide"] block exists');
  assert.match(block[1], /--measure-main:\s*80ch/);
});

test('layout.css: margin-figure caption is shrunk without touching global figcaption', () => {
  assert.match(layoutCss, /\.margin-figure[^{]*figcaption[^{]*\{[^}]*--text-xs/s);
});

// ===== Chapter.astro threads data-layout ==================================

test('Chapter.astro: emits data-layout only for a non-default value (byte-identical default)', () => {
  assert.match(chapterLayout, /data-layout=\{layoutMode\}/);
  // Normalizes 'default'/undefined → undefined so Astro drops the attribute.
  assert.match(chapterLayout, /layout\s*!==\s*['"]default['"]\s*\?\s*dataAny\.layout\s*:\s*undefined/);
});

// ===== HARD-CONSTRAINT REGRESSION GUARD (1d "bridge") =====================

test('1d guard: .prose did NOT gain display:grid (block layout preserved)', () => {
  // Isolate every `.prose {...}` / `.prose[...] {...}` rule body and assert none
  // declares `display: grid`. (`.layout-with-sidebar` grid is the page chrome,
  // a separate selector — explicitly allowed.)
  const proseBlocks = layoutCss.match(/\.prose(?:\[[^\]]*\])?\s*\{[^}]*\}/g) ?? [];
  assert.ok(proseBlocks.length > 0, 'found .prose rules to check');
  for (const b of proseBlocks) {
    assert.doesNotMatch(b, /display:\s*grid/, `.prose rule must stay block layout: ${b}`);
  }
});

test('1d guard: .sidenote float technique is untouched', () => {
  const block = layoutCss.match(/\.sidenote\s*\{([^}]*)\}/);
  assert.ok(block, '.sidenote block exists');
  assert.match(block[1], /float:\s*right/);
  assert.match(block[1], /clear:\s*right/);
  assert.match(block[1], /width:\s*var\(--measure-side\)/);
  assert.match(
    block[1],
    /margin-right:\s*calc\(\s*-1\s*\*\s*\(var\(--measure-side\)\s*\+\s*var\(--space-6\)\)\s*\)/,
  );
});
