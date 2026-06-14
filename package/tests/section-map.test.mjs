/**
 * tests/section-map.test.mjs — the PURE section-map logic (#section-map):
 * the shared h2/h3 TOC filter (tocHeadings) and the scrollspy active-pick
 * (pickActive). No browser — this is the verifiable core under the ChapterTOC
 * fallback and the SectionMap island. pickActive is fed plain arrays here and
 * IntersectionObserver state in the island.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { tocHeadings, pickActive } from '../dist/index.mjs';

const h = (depth, slug, text = slug) => ({ depth, slug, text });

// ===== tocHeadings (the shared h2/h3 filter) =====

test('tocHeadings: empty in → empty out', () => {
  assert.deepEqual(tocHeadings([]), []);
});

test('tocHeadings: keeps h2 + h3, drops h1 and h4 (the "noise" bands)', () => {
  const headings = [
    h(1, 'chapter-title'), // the chapter title — not body TOC
    h(2, 'overview'),
    h(3, 'a-subsection'),
    h(4, 'too-deep'), // h4+ is noise in an anchor list
  ];
  assert.deepEqual(
    tocHeadings(headings).map((x) => x.slug),
    ['overview', 'a-subsection'],
  );
});

test('tocHeadings: fewer than 3 matching headings still returns them (gating is the caller’s job)', () => {
  // The >= 3 "render nothing" gate lives in ChapterTOC/SectionMap, NOT here —
  // this filter is total and just reports the h2/h3 set.
  const headings = [h(2, 'one'), h(2, 'two')];
  assert.equal(tocHeadings(headings).length, 2);
});

test('tocHeadings: pure — does not mutate the input array', () => {
  const headings = [h(2, 'keep'), h(4, 'drop')];
  const snapshot = headings.slice();
  tocHeadings(headings);
  assert.deepEqual(headings, snapshot);
});

// ===== pickActive (scrollspy) =====

test('pickActive: none visible → retain prev (sticky highlight)', () => {
  assert.equal(pickActive([], 'overview'), 'overview');
  assert.equal(pickActive([], null), null);
});

test('pickActive: single visible heading wins regardless of sign', () => {
  assert.equal(pickActive([{ slug: 'a', top: 42 }], null), 'a');
  assert.equal(pickActive([{ slug: 'a', top: -42 }], 'prev'), 'a');
});

test('pickActive: multiple visible → smallest non-negative top wins (topmost in view)', () => {
  const visible = [
    { slug: 'first', top: 220 },
    { slug: 'second', top: 40 }, // closest to the top edge from below
    { slug: 'third', top: 600 },
  ];
  assert.equal(pickActive(visible, null), 'second');
});

test('pickActive: a heading above the fold loses to one still below it', () => {
  // 'intro' scrolled above the top (-30); 'body' is just below (+10) → body.
  const visible = [
    { slug: 'intro', top: -30 },
    { slug: 'body', top: 10 },
  ];
  assert.equal(pickActive(visible, 'intro'), 'body');
});

test('pickActive: all above the fold → the one nearest the fold (greatest top) stays lit', () => {
  // Tall section: its own heading and the previous one both scrolled off the
  // top; nothing below has entered yet. Keep the enclosing section (-15, the
  // closest to 0) rather than going dark.
  const visible = [
    { slug: 'earlier', top: -400 },
    { slug: 'current', top: -15 },
  ];
  assert.equal(pickActive(visible, 'current'), 'current');
});

test('pickActive: exact-zero top counts as in view (>= 0), beats a negative', () => {
  const visible = [
    { slug: 'above', top: -5 },
    { slug: 'pinned', top: 0 },
  ];
  assert.equal(pickActive(visible, null), 'pinned');
});

test('pickActive: total — never throws on degenerate input', () => {
  assert.doesNotThrow(() => pickActive([], null));
  assert.doesNotThrow(() => pickActive([{ slug: 'x', top: 0 }], null));
});
