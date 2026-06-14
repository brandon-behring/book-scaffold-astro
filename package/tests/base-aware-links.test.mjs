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
