/**
 * tests/sidebar-brand.test.mjs — source-contract suite for the sidebar brand
 * (v4.23.0, #135).
 *
 * The bug class: brand strings hardcoded in the shipped component meant every
 * consumer rendered the placeholder ("Book" / "A scaffold-astro book") with no
 * config escape hatch. These pin the contract: the brand reads the book-config
 * virtual module with the old strings as FALLBACKS only. (Full render goes
 * through the fixture snapshot + demo smoke; this guards the source wiring —
 * same pattern as the glossary <Term> source checks.)
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(__dirname, '..', 'components', 'Sidebar.astro'), 'utf8');

test('Sidebar brand title prefers corpus book, then single-book config, then legacy fallback', () => {
  assert.match(
    src,
    /const siteTitle = currentBook\?\.title \?\? bookConfig\.title \?\? 'Book';/,
  );
});

test('Sidebar brand subtitle prefers corpus book, then single-book config, then legacy fallback', () => {
  assert.match(
    src,
    /const siteSubtitle = currentBook\?\.subtitle \?\? bookConfig\.subtitle \?\? 'A scaffold-astro book';/,
  );
});

test('Sidebar home is book-local in corpus and preserves the single-book base link', () => {
  assert.match(
    src,
    /const homeHref = currentBook \? `\$\{baseUrl\}\$\{currentBook\.id\}\/` : baseUrl;/,
  );
  assert.match(src, /<a href=\{homeHref\} class="sidebar-home">/);
  assert.match(
    src,
    /const currentBookId = bookConfig\.corpus[\s\S]*?corpusBookIdFromPath\([\s\S]*?: null;/,
  );
});

test('Sidebar imports the book-config virtual module (the only consumer-config channel)', () => {
  assert.match(src, /import bookConfig from 'virtual:book-scaffold\/book-config';/);
});

test('the integration threads subtitle into the virtual module (config → plugin)', () => {
  const integration = readFileSync(
    resolve(__dirname, '..', 'src', 'integration.ts'),
    'utf8',
  );
  assert.match(integration, /subtitle: subtitle \?\? null,/);
  assert.match(integration, /subtitle: string \| null;/);
});
