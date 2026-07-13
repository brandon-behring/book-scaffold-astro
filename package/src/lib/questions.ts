/**
 * src/lib/questions.ts — Astro-context consumption helper for the study-guide
 * `questions` collection (Tier 3, #112).
 *
 * Thin wrapper over `getCollection` (needs the `astro:content` runtime, like
 * lib/chapters.ts). The PURE grouping + objective-map derivation live in
 * questions-derive.ts (no Astro import → unit-tested from dist/) and are
 * re-exported here so .astro pages get one import surface.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { sortQuestions } from './questions-derive.js';

export type QuestionEntry = CollectionEntry<'questions'>;

export {
  chapterLabel,
  sortQuestions,
  groupByDomain,
  groupByChapter,
  deriveObjectiveMap,
  distinctChaptersSorted,
} from './questions-derive.js';

/**
 * All non-draft questions, ordered by chapter then id (stable, deterministic).
 * A corpus caller supplies the registered book id; single-book callers omit it
 * and retain the exact historical collection behavior.
 */
export async function getAllQuestions(bookId?: string): Promise<QuestionEntry[]> {
  const all = await getCollection('questions', (e) => !e.data.draft);
  const scoped = bookId ? all.filter((entry) => entry.id.startsWith(`${bookId}/`)) : all;
  return sortQuestions(scoped);
}
