/**
 * tests/flashcards.test.mjs — node:test suite for the PURE flashcard-deck
 * manifest (v4.22.0, #116).
 *
 * Pure (no astro:content) — imports straight from dist/. Mock entries use the
 * glossary CollectionEntry shape (file-derived `id` at the top level, `term`
 * in data). Run after build.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFlashcardDeck, shuffle } from '../dist/index.mjs';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const routeSource = readFileSync(join(packageRoot, 'pages', 'flashcards.astro'), 'utf8');
const islandSource = readFileSync(join(packageRoot, 'components', 'Flashcards.tsx'), 'utf8');

const term = (id, display, draft = false) => ({ id, data: { term: display, draft } });

test('buildFlashcardDeck maps id+front, drops drafts, sorts by display term', () => {
  const deck = buildFlashcardDeck([
    term('zeta-fn', 'zeta function'),
    term('agentic-loop', 'agentic loop'),
    term('wip-term', 'work in progress', true),
    term('big-o', 'Big-O notation'),
  ]);
  assert.deepEqual(deck, [
    { id: 'agentic-loop', front: 'agentic loop' },
    { id: 'big-o', front: 'Big-O notation' },
    { id: 'zeta-fn', front: 'zeta function' },
  ]);
});

test('buildFlashcardDeck sorting is locale-aware (case does not split the order)', () => {
  const deck = buildFlashcardDeck([term('b', 'banana'), term('a', 'Apple')]);
  assert.deepEqual(deck.map((c) => c.front), ['Apple', 'banana']);
});

test('buildFlashcardDeck on an empty glossary is an empty deck (honest empty state upstream)', () => {
  assert.deepEqual(buildFlashcardDeck([]), []);
});

test('deck ids feed the exam-engine shuffle directly (island contract)', () => {
  const deck = buildFlashcardDeck([term('a', 'a'), term('b', 'b'), term('c', 'c')]);
  const order = shuffle(deck.map((c) => c.id), () => 0.5);
  assert.equal(order.length, 3);
  assert.deepEqual([...order].sort(), ['a', 'b', 'c']);
});

test('corpus flashcard persistence is namespaced by deployment base and book', () => {
  assert.match(
    routeSource,
    /book:\$\{import\.meta\.env\.BASE_URL\}:flashcards:\$\{bookId\}:known/,
  );
  assert.match(routeSource, /storageKey=\{storageKey\}/);
  assert.match(islandSource, /localStorage\.getItem\(storageKey\)/);
  assert.match(islandSource, /localStorage\.setItem\(storageKey,/);
  assert.doesNotMatch(islandSource, /localStorage\.(?:get|set)Item\(DEFAULT_STORAGE_KEY/);
});
