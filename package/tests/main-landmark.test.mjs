/**
 * tests/main-landmark.test.mjs — guards the single-`<main>`-landmark invariant
 * (#91, v4.12.0).
 *
 * Best practice (HTML/ARIA): exactly one `<main>` landmark per page. We enforce
 * it structurally by having Base.astro OWN the single `<main>` for every page
 * (both the sidebar and full-bleed branches); slotted pages must use
 * `<article>`/`<section>`/`<div>`, never `<main>`, or the page ends up with
 * nested/duplicate landmarks.
 *
 * These are source assertions (not a render harness): they fail loudly if a
 * page re-introduces its own `<main>`, or if Base stops wrapping a branch.
 *
 * Run: node --test tests/main-landmark.test.mjs
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PAGES_DIR = join(__dirname, '..', 'pages');
const LAYOUTS_DIR = join(__dirname, '..', 'layouts');

test('no injected page emits its own <main> (Base owns the landmark)', async () => {
  const entries = await readdir(PAGES_DIR, { recursive: true, withFileTypes: true });
  const pages = entries
    .filter((e) => e.isFile() && e.name.endsWith('.astro'))
    .map((e) => join(e.parentPath ?? e.path, e.name));
  assert.ok(pages.length > 0, 'expected to find injected .astro pages');

  for (const page of pages) {
    const src = await readFile(page, 'utf8');
    assert.ok(
      !/<main[\s>]/.test(src),
      `${page} must not emit <main> — Base.astro owns the single landmark (use <div>/<section>/<article>)`,
    );
  }
});

test('Base.astro wraps both branches in exactly one <main>', async () => {
  const src = await readFile(join(LAYOUTS_DIR, 'Base.astro'), 'utf8');
  const template = src.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
  assert.equal(
    [...template.matchAll(/^\s*<main(?:\s|>)/gm)].length,
    2,
    'the two mutually exclusive layout branches should each own one <main>',
  );
  assert.equal(
    [...template.matchAll(/^\s*(?:><slot \/>)?<\/main>/gm)].length,
    2,
    'each conditional <main> must close exactly once',
  );
  assert.match(
    template,
    /<main\s+class="layout-main"\s+data-pagefind-body=\{pagefindFilter \? true : undefined\}\s+data-pagefind-filter=\{pagefindFilter\}\s*>\s*<slot \/><\/main>/,
    'sidebar branch should wrap the slot in a Pagefind-scoped <main class="layout-main">',
  );
  assert.match(
    template,
    /\) : \(\s*<main\s+data-pagefind-body=\{pagefindFilter \? true : undefined\}\s+data-pagefind-filter=\{pagefindFilter\}\s*>\s*<slot \/><\/main>/,
    'no-sidebar branch should wrap the slot in its own Pagefind-scoped <main>',
  );
});
