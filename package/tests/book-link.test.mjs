/**
 * tests/book-link.test.mjs — node:test suite for cross-book link resolution
 * (v4.16.0, #96).
 *
 * Each scaffold book is a separate Astro app with its own labels.json + deploy
 * origin, so <XRef> can't reach a sibling book. <BookLink book to> resolves
 * `book` against a per-consumer registry of sibling base URLs; an unknown book
 * throws rather than emitting a dead cross-origin link.
 *
 * Tests import from dist/ since node:test can't load TS. Run after build.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolveBookHref, resolveCorpusBookHref } from '../dist/index.mjs';

const SIBLINGS = { design: 'https://design.example', handbook: 'https://hb.example/' };
const DESCRIPTORS = {
  design: {
    url: 'https://hub.example/library/design/',
    labels: './vendor/design-labels.json',
  },
};

test('resolveBookHref: joins base + to, normalizing the slash seam', () => {
  assert.equal(
    resolveBookHref(SIBLINGS, 'design', 'chapters/foo/#thm-1'),
    'https://design.example/chapters/foo/#thm-1',
  );
  // trailing slash on base + leading slash on `to` collapse to one
  assert.equal(
    resolveBookHref(SIBLINGS, 'handbook', '/chapters/bar/'),
    'https://hb.example/chapters/bar/',
  );
});

test('resolveBookHref: descriptor URLs preserve a path-proxied sibling base (#147)', () => {
  assert.equal(
    resolveBookHref(DESCRIPTORS, 'design', '/chapters/patterns/#layered'),
    'https://hub.example/library/design/chapters/patterns/#layered',
  );
});

test('resolveBookHref: THROWS on an unknown sibling book, listing the known ones (#96)', () => {
  assert.throws(
    () => resolveBookHref(SIBLINGS, 'missing', 'x'),
    /<BookLink book="missing">.*unknown sibling book.*design, handbook/s,
  );
});

test('resolveBookHref: THROWS when no registry is configured — no silent dead link', () => {
  assert.throws(() => resolveBookHref(undefined, 'design', 'x'), /siblingBooks/);
  assert.throws(() => resolveBookHref(null, 'design', 'x'), /siblingBooks/);
  assert.throws(() => resolveBookHref({}, 'design', 'x'), /unknown sibling book/);
  assert.throws(() => resolveBookHref({}, 'constructor', 'x'), /unknown sibling book/);
});

test('resolveBookHref: invalid descriptor entries fail loud', () => {
  assert.throws(
    () => resolveBookHref({ design: { labels: './labels.json' } }, 'design', 'x'),
    /invalid siblingBooks entry.*\{ url:/s,
  );
});

test('resolveCorpusBookHref: chapters use the shared chapter namespace', () => {
  assert.equal(
    resolveCorpusBookHref('evaluation', 'chapters/foo#bar'),
    '/chapters/evaluation/foo/#bar',
  );
  assert.equal(
    resolveCorpusBookHref('evaluation', 'chapters/foo?mode=review#bar', '/canary/'),
    '/canary/chapters/evaluation/foo/?mode=review#bar',
  );
  assert.equal(resolveCorpusBookHref('evaluation', 'chapters'), '/chapters/evaluation/');
});

test('resolveCorpusBookHref: non-chapter targets stay under the book namespace', () => {
  assert.equal(
    resolveCorpusBookHref('llm-app-engineering', 'glossary/term#definition'),
    '/llm-app-engineering/glossary/term/#definition',
  );
  assert.equal(
    resolveCorpusBookHref('llm-app-engineering', 'references'),
    '/llm-app-engineering/references/',
  );
});

test('resolveCorpusBookHref: invalid local targets fail loud', () => {
  for (const target of [
    '',
    '   ',
    '/chapters/foo',
    '//example.test/foo',
    'https://example.test/foo',
    '../foo',
    'chapters/../foo',
    'chapters/%2e%2e/foo',
    'chapters/%2Ffoo',
    '?book=foo',
    '#fragment',
  ]) {
    assert.throws(() => resolveCorpusBookHref('evaluation', target), /invalid local corpus target/);
  }
});
