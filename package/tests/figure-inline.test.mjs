/**
 * tests/figure-inline.test.mjs — pure render-side figure helpers (v4.11.0 #84).
 *
 * shouldInline() decides when <Figure> inlines a local pipeline SVG vs renders
 * an <img>; assembleSvg() prepares the inlined markup (strip standalone theme
 * block, a11y <title>/<desc> from props, role + aria-labelledby + sizing).
 * Pure string transforms — no renderer needed.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  shouldInline,
  publicSvgPath,
  assembleSvg,
  stripThemeBlock,
  recolorSvg,
} from '../src/lib/figure.mjs';

test('shouldInline: only local .svg paths', () => {
  assert.equal(shouldInline('/figures/phase.svg'), true);
  assert.equal(shouldInline('/figures/deep/x.SVG'), true, 'case-insensitive extension');
  assert.equal(shouldInline('/figures/plot.png'), false, 'png fallback stays <img>');
  assert.equal(shouldInline('//cdn.example/x.svg'), false, 'protocol-relative is remote');
  assert.equal(shouldInline('https://example.com/x.svg'), false, 'remote URL stays <img>');
  assert.equal(shouldInline('figures/x.svg'), false, 'relative path (no leading slash)');
  assert.equal(shouldInline(undefined), false);
  assert.equal(shouldInline(''), false);
});

test('publicSvgPath: removes a non-root BASE_URL for local public-file lookup', () => {
  assert.equal(publicSvgPath('/guide/figures/phase.svg', '/guide/'), 'figures/phase.svg');
  assert.equal(publicSvgPath('/guide/figures/phase.svg', '/guide'), 'figures/phase.svg');
  assert.equal(
    publicSvgPath('/figures/phase.svg', '/guide/'),
    'figures/phase.svg',
    'literal root URLs retain the historical lookup behavior',
  );
  assert.equal(publicSvgPath('/figures/phase.svg'), 'figures/phase.svg');
  assert.equal(publicSvgPath('/guidebook/figures/phase.svg', '/guide/'), 'guidebook/figures/phase.svg');
  assert.equal(publicSvgPath('/guide/../private.svg', '/guide/'), null, 'dot segments cannot escape public');
  assert.equal(publicSvgPath('/guide/figures\\private.svg', '/guide/'), null, 'backslashes are rejected');
  assert.equal(publicSvgPath('/guide/figures/phase.png', '/guide/'), null, 'non-SVG stays raster');
});

// A raw SVG as build-figures would emit it: standalone theme block + map block,
// plus a stale hand-authored <title> we expect to be replaced.
const RAW =
  '<svg xmlns="http://www.w3.org/2000/svg" width="68pt" height="60pt" viewBox="0 0 68 60">' +
  '<style data-diagram-theme>:root{--diagram-ink:#1A1A19}@media (prefers-color-scheme:dark){:root{--diagram-ink:#E8E5DD}}</style>' +
  '<style data-diagram-map>[stroke="rgb(0%, 0%, 0%)"]{stroke:var(--diagram-ink, rgb(0%, 0%, 0%))}</style>' +
  '<title id="old">stale</title>' +
  '<path stroke="rgb(0%, 0%, 0%)" d="M0 0 L56 0 Z"/>' +
  '</svg>';

test('assembleSvg: strips theme block, keeps map block', () => {
  const out = assembleSvg(RAW, { caption: 'Cap', idBase: 'f1' });
  assert.ok(!out.includes('data-diagram-theme'), 'standalone theme block removed (host themes it)');
  assert.match(out, /data-diagram-map/, 'color-map block retained');
});

test('assembleSvg: injects title/desc from props, replaces stale title', () => {
  const out = assembleSvg(RAW, {
    caption: 'Phase portrait',
    alt: 'A damped spiral',
    desc: 'Trajectory spiraling to the origin.',
    width: '80%',
    idBase: 'w4:fig:phase',
  });
  assert.ok(!out.includes('stale'), 'stale hand-authored <title> removed');
  assert.match(out, /<title id="w4-fig-phase-title">A damped spiral<\/title>/, 'alt is the short accessible name');
  assert.match(out, /<desc id="w4-fig-phase-desc">Trajectory spiraling to the origin.<\/desc>/);
  assert.match(out, /<svg\b[^>]*\brole="img"/, 'role="img" on root');
  assert.match(out, /aria-labelledby="w4-fig-phase-title"/, 'accessible name points to the alt-derived title');
  assert.match(out, /aria-describedby="w4-fig-phase-desc"/, 'long description stays separate from the name');
  assert.match(out, /style="[^"]*width:80%[^"]*max-width:100%[^"]*height:auto/, 'responsive sizing applied');
});

test('assembleSvg: alt-only → title=alt, no separate desc', () => {
  const out = assembleSvg(RAW, { alt: 'Just alt', idBase: 'f2' });
  assert.match(out, /<title id="f2-title">Just alt<\/title>/);
  assert.ok(!out.includes('<desc'), 'no <desc> when desc would duplicate the title');
  assert.match(out, /aria-labelledby="f2-title"/);
});

test('assembleSvg: caption + distinct alt (no desc) → title uses alt', () => {
  const out = assembleSvg(RAW, { caption: 'Title here', alt: 'Described differently', idBase: 'f3' });
  assert.match(out, /<title id="f3-title">Described differently<\/title>/);
  assert.ok(!out.includes('<desc'), 'caption is visible prose, not a substitute long description');
  assert.match(out, /aria-labelledby="f3-title"/);
});

test('assembleSvg: escapes XML metacharacters in a11y text', () => {
  const out = assembleSvg(RAW, { caption: 'a < b & c > d', idBase: 'f4' });
  assert.match(out, /<title id="f4-title">a &lt; b &amp; c &gt; d<\/title>/);
});

test('assembleSvg: merges into an existing root <svg style>', () => {
  const raw = '<svg xmlns="http://www.w3.org/2000/svg" style="background:white"><path/></svg>';
  const out = assembleSvg(raw, { caption: 'C', width: '100%', idBase: 'f5' });
  assert.match(out, /style="background:white;width:100%;max-width:100%;height:auto"/);
});

test('assembleSvg: guards — non-string → empty, no <svg> → unchanged', () => {
  assert.equal(assembleSvg(null), '');
  assert.equal(assembleSvg('plain text', { caption: 'x' }), 'plain text');
});

test('build→render chain: recolorSvg output, once assembled, is host-themed', () => {
  // The real handoff: build emits a themed SVG; <Figure> inlines it. After
  // assembly the standalone theme block is gone (host tokens.css supplies
  // --diagram-*), but the color-map rules + role + a11y are intact.
  const built =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 68 60">' +
    '<path stroke="rgb(0%, 0%, 0%)" d="M0 0 L56 0 Z"/></svg>';
  const themed = recolorSvg(built);
  const inlined = assembleSvg(themed, { caption: 'Diagram', idBase: 'chain' });

  assert.ok(!inlined.includes('data-diagram-theme'), 'host themes inlined figures — embedded defaults stripped');
  assert.match(inlined, /data-diagram-map/, 'color-map rules survive inlining');
  assert.match(inlined, /stroke:var\(--diagram-ink, rgb\(0%, 0%, 0%\)\)/, 'ink mapping intact for host cascade');
  assert.match(inlined, /<title id="chain-title">Diagram<\/title>/, 'a11y title injected from props');
  assert.match(inlined, /<svg\b[^>]*\brole="img"/, 'role preserved');
});

test('stripThemeBlock: removes only the data-diagram-theme block', () => {
  const out = stripThemeBlock(RAW);
  assert.ok(!out.includes('data-diagram-theme'));
  assert.match(out, /data-diagram-map/);
  assert.match(out, /<path stroke=/);
});
