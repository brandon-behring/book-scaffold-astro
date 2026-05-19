/**
 * src/lib/chapters.ts — ordering + nav helpers for the chapters collection.
 *
 * Centralizes the sort key (part × 100 + chapter) and draft filtering so
 * components and static-path generation use the same logic.
 */
import { getCollection, type CollectionEntry } from 'astro:content';

export type Chapter = CollectionEntry<'chapters'>;

/** Numeric sort key; chapters within a part come before a higher part. */
export function sortKey(c: Chapter): number {
  return c.data.part * 1000 + c.data.chapter;
}

/** All non-draft chapters, ordered by part+chapter ascending. */
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
