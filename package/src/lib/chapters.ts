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
 * Given a chapter id, return its ordered neighbors.
 * Either may be null at the edges of the book.
 */
export async function getNeighbors(id: string): Promise<{
  prev: Chapter | null;
  next: Chapter | null;
}> {
  const all = await getAllChapters();
  const idx = all.findIndex((c) => c.id === id);
  if (idx === -1) return { prev: null, next: null };
  return {
    prev: idx > 0 ? all[idx - 1] : null,
    next: idx < all.length - 1 ? all[idx + 1] : null,
  };
}
