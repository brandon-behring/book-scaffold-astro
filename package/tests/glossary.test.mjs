/**
 * tests/glossary.test.mjs — node:test for the study-guide glossary (v4.19.0, #115).
 *
 * Two halves: (1) the `glossary` collection schema (glossarySchema) — the
 * `.strict()` flat envelope schemas-entry.ts registers; (2) the inline <Term>
 * component contract (source-pattern, like pedagogy-callouts.test.mjs). The term
 * DEFINITION lives in the MDX body, so a `definition` frontmatter key must fail
 * (.strict()) — the fail-loud invariant applied to glossary authoring.
 *
 * The schema half imports from dist/ (node:test can't load TS). Run after build.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { glossarySchema } from '../dist/index.mjs';

// ===== glossary schema (#115) ============================================

test('glossary: minimal valid term parses; arrays default to []', () => {
  const r = glossarySchema.parse({ term: 'Agentic loop' });
  assert.equal(r.term, 'Agentic loop');
  assert.deepEqual(r.aliases, []);
  assert.deepEqual(r.see, []);
  assert.deepEqual(r.tags, []);
  assert.equal(r.draft, false);
});

test('glossary: full term parses (aliases / domain / see / tags / draft)', () => {
  const r = glossarySchema.parse({
    term: 'Agent',
    aliases: ['agentic system'],
    domain: 'D1',
    see: ['agentic-loop', 'tool-use'],
    tags: ['core'],
    draft: true,
  });
  assert.deepEqual(r.aliases, ['agentic system']);
  assert.deepEqual(r.see, ['agentic-loop', 'tool-use']);
  assert.equal(r.draft, true);
});

test('glossary: missing term fails', () => {
  assert.throws(() => glossarySchema.parse({ aliases: ['x'] }));
});

test('glossary: whitespace-only term fails (trim + min(1))', () => {
  assert.throws(() => glossarySchema.parse({ term: '   ' }));
});

test('glossary: stray key fails (.strict() — definition lives in the body)', () => {
  assert.throws(() =>
    glossarySchema.parse({ term: 'X', definition: 'in body, not frontmatter' }),
  );
});

// ===== Term component (#115) =============================================

const __dirname = dirname(fileURLToPath(import.meta.url));
function readComponent(name) {
  return readFileSync(join(__dirname, '..', 'components', `${name}.astro`), 'utf8');
}

test('Term: requires id: string prop', () => {
  const src = readComponent('Term');
  assert.match(src, /id:\s*string/);
});

test('Term: links to book-local glossary in corpus and legacy glossary in single-book mode', () => {
  const src = readComponent('Term');
  assert.match(
    src,
    /const currentBook = bookConfig\.corpus[\s\S]*?corpusBookIdFromPath\([\s\S]*?: null;/,
  );
  assert.ok(
    src.includes("`${baseUrl}${currentBook ? `${currentBook}/` : ''}glossary#term-${id}`"),
    'corpus pages must prefix the glossary with the current book; currentBook=null preserves /glossary',
  );
  assert.match(src, /corpusBookHasApparatusRoute\([\s\S]*?'glossary'/);
  assert.match(src, /requires the current corpus book's glossary route/);
});

test('Term: renders .term-link and a slot', () => {
  const src = readComponent('Term');
  assert.match(src, /class="term-link"/);
  assert.match(src, /<slot\s*\/?>/);
});
