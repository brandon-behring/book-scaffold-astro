/**
 * src/lib/chapters.ts — ordering + nav helpers for the chapters collection.
 *
 * Astro-context wrappers (need `astro:content`). The pure sort-key logic
 * lives in src/lib/chapter-sort.ts so it can be included in the toolkit's
 * DTS bundle without dragging Astro virtual modules into the build graph.
 *
 * v3.5.2 (closes #24): schema-aware sort. Previously assumed tools-profile
 * shape (numeric `part` * 1000 + numeric `chapter`); academic chapters
 * (string `part` enum + numeric `week`, no `chapter`) crashed.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { chapterSortKey } from './chapter-sort.js';
import { bookOf } from './nav-href.js';
import { corpusBookIdOf } from './corpus.js';
import type { BookCorpus } from '../types.js';

export type Chapter = CollectionEntry<'chapters'>;

/** Sort key for an Astro Chapter collection entry. Thin wrapper over the
 *  pure `chapterSortKey` helper. */
export function sortKey(c: Chapter): number {
  return chapterSortKey(c.data as Record<string, unknown>);
}

/** All non-draft chapters, ordered by part+chapter (tools) or part+week (academic). */
export async function getAllChapters(): Promise<Chapter[]> {
  const all = await getCollection('chapters', (entry) => !entry.data.draft);
  return all.sort((a, b) => sortKey(a) - sortKey(b));
}

/**
 * Given a chapter id, return its ordered neighbors. Either may be null at the
 * edges of the book.
 *
 * v4.26.0 (#80): book-aware. When the entry carries a book (multi-book consumer,
 * `data[bookField]`), neighbors are scoped to the SAME book so prev/next never
 * bleed across books. Single-book schemas have no book field → no scoping → the
 * pre-4.26 global ordering (byte-identical BC).
 */
export async function getNeighbors(
  id: string,
  opts: { bookField?: string; corpus?: BookCorpus | null } = {},
): Promise<{ prev: Chapter | null; next: Chapter | null }> {
  const { bookField = 'book', corpus = null } = opts;
  const all = await getAllChapters();
  const self = all.find((c) => c.id === id);
  if (!self) return { prev: null, next: null };
  const entryBook = (entry: Chapter) =>
    corpus
      ? corpusBookIdOf(corpus, entry.id)
      : bookOf({ id: entry.id, data: entry.data as Record<string, unknown> }, bookField);
  const selfBook = entryBook(self);
  const scoped = selfBook
    ? all.filter((c) => entryBook(c) === selfBook)
    : all;
  const idx = scoped.findIndex((c) => c.id === id);
  if (idx === -1) return { prev: null, next: null };
  return {
    prev: idx > 0 ? scoped[idx - 1]! : null,
    next: idx < scoped.length - 1 ? scoped[idx + 1]! : null,
  };
}
