import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Regression guard for #140 (base-unaware links) + #141 (ChapterNav dropped the
// /chapters/ prefix). Nav/anchor components must build every route/anchor href from
// import.meta.env.BASE_URL, so a book built with a non-root `base` (e.g. a path-proxied
// multi-guide series at base: '/ai-engineering/') keeps links inside the base instead of
// escaping to the host root. A bare `href="/..."` or `href={`/...`}` in these files is the bug.

const FILES = [
  'components/ChapterNav.astro',
  'components/Sidebar.astro',
  'layouts/Base.astro',
  'components/Cite.astro',
  'components/Term.astro',
  'components/TipsCard.astro',
  'components/PartReview.astro',
  'components/Rationale.astro',
];

test('nav/anchor components derive hrefs from BASE_URL (#140, #141)', () => {
  for (const rel of FILES) {
    const src = readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
    assert.match(src, /import\.meta\.env\.BASE_URL/, `${rel}: should read import.meta.env.BASE_URL`);
    assert.doesNotMatch(src, /href="\//, `${rel}: bare string href="/..." escapes the base`);
    assert.doesNotMatch(src, /href=\{`\//, `${rel}: bare template href={\`/...\`} escapes the base`);
  }
});

test('ChapterNav prev/next route through /chapters/ with the base (#141)', () => {
  const src = readFileSync(new URL('../components/ChapterNav.astro', import.meta.url), 'utf8');
  assert.match(src, /\$\{baseUrl\}chapters\/\$\{prev\.id\}/, 'prev link must be `${baseUrl}chapters/${prev.id}/`');
  assert.match(src, /\$\{baseUrl\}chapters\/\$\{next\.id\}/, 'next link must be `${baseUrl}chapters/${next.id}/`');
});

// #142: v4.24.0 made nav *components* base-aware but left the injected *route
// pages* (and a few non-route emitters) emitting root-absolute hrefs, so any
// book on a non-root `base` got broken navigation + a dead search page. These
// guard the route pages + the remaining component emitters found by sweep.
const ROUTE_FILES = [
  'pages/index.astro',       // ROUTE_LABELS landing list
  'pages/chapters.astro',    // chapter cards
  'pages/exercises.astro',   // chapter deep links
  'pages/tips.astro',        // chapter back-links
  'pages/answers.astro',     // practice-exam + chapter links
  'pages/search.astro',      // Pagefind asset URLs (see asset-specific test below)
  'components/WeekRef.astro', // \weekref chapter link
  'components/XRef.astro',    // \cref → labels.json href
  'components/AssessmentTest.astro', // practice-exam link + deriveDomainRouting base
];

test('route pages + nav components derive hrefs from BASE_URL (#142)', () => {
  for (const rel of ROUTE_FILES) {
    const src = readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
    assert.match(src, /import\.meta\.env\.BASE_URL/, `${rel}: should read import.meta.env.BASE_URL`);
    assert.doesNotMatch(src, /href="\//, `${rel}: bare string href="/..." escapes the base`);
    assert.doesNotMatch(src, /href=\{`\//, `${rel}: bare template href={\`/...\`} escapes the base`);
  }
});

// search.astro loads the Pagefind bundle via `src=` (script) + `href=` (link).
// Those assets land in dist/pagefind/ → served under the base; a root-absolute
// URL 404s under a non-root base. (The generic test above misses the `src=`.)
test('search.astro Pagefind assets prefix BASE_URL (#142)', () => {
  const src = readFileSync(new URL('../pages/search.astro', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /src="\/pagefind/, 'pagefind <script src> must prefix the base');
  assert.doesNotMatch(src, /href="\/pagefind/, 'pagefind <link href> must prefix the base');
  assert.match(src, /\$\{baseUrl\}pagefind\/pagefind-ui\.js/, 'pagefind JS must be `${baseUrl}pagefind/...`');
});

// Non-route emitters bake hrefs into data, not .astro markup, so the fix differs:
// build-labels writes a base-less ref into labels.json (XRef prefixes the base
// at render); exam-manifest takes baseUrl as a param (it ships pre-compiled in
// dist/ where Vite env replacement does not reach — a self-read drops the base).
test('build-labels emits base-less chapter refs into labels.json (#142)', () => {
  const src = readFileSync(new URL('../scripts/build-labels.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /href: `\/chapters\//, 'labels.json href must be base-less `chapters/...`, not root-absolute');
  assert.match(src, /href: `chapters\/\$\{slug\}#\$\{id\}`/, 'href must be `chapters/${slug}#${id}`');
});

test('exam-manifest routes through an injected baseUrl, not a hardcoded root (#142)', () => {
  const src = readFileSync(new URL('../src/lib/exam-manifest.ts', import.meta.url), 'utf8');
  assert.match(src, /baseUrl = '\/'/, 'deriveDomainRouting must take a baseUrl param (default "/")');
  assert.match(src, /\$\{baseUrl\}chapters\/\$\{e\.data\.chapter\}\//, 'href must be `${baseUrl}chapters/${chapter}/`');
  assert.doesNotMatch(src, /\? `\/chapters\//, 'must not hardcode a root-absolute `/chapters/...`');
});
