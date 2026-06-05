/**
 * src/lib/questions-derive.ts — PURE grouping + objective-map derivation for the
 * study-guide `questions` collection (Tier 3, #112).
 *
 * No `astro:content` import, so this is safe in the Node-loaded main entry and
 * unit-tested directly from dist/ (tests/questions.test.mjs). The Astro-context
 * `getCollection` wrapper lives in questions.ts — same split as
 * chapter-sort.ts (pure) / chapters.ts (Astro wrapper).
 */
import type { Question } from '../schemas.js';

/** Stable string label for a chapter ref (number or academic-style string). */
export function chapterLabel(chapter: number | string): string {
  return String(chapter);
}

/**
 * Sort tuple for a chapter ref: numeric chapters sort before string chapters,
 * each ordered within its group (numbers zero-padded for lexical comparison).
 */
function chapterOrder(chapter: number | string): [number, string] {
  return typeof chapter === 'number'
    ? [0, String(chapter).padStart(6, '0')]
    : [1, chapter];
}

/** Sort questions by chapter then id (stable, deterministic). Pure. */
export function sortQuestions<
  T extends { data: Pick<Question, 'chapter' | 'id'> },
>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => {
    const [ar, as] = chapterOrder(a.data.chapter);
    const [br, bs] = chapterOrder(b.data.chapter);
    if (ar !== br) return ar - br;
    if (as !== bs) return as < bs ? -1 : 1;
    return a.data.id.localeCompare(b.data.id);
  });
}

/** Group entries by `domain`, preserving input order within each bucket. */
export function groupByDomain<T extends { data: Pick<Question, 'domain'> }>(
  entries: readonly T[],
): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const e of entries) {
    const bucket = out.get(e.data.domain) ?? [];
    bucket.push(e);
    out.set(e.data.domain, bucket);
  }
  return out;
}

/** Group entries by `chapter` (string label), preserving input order. */
export function groupByChapter<T extends { data: Pick<Question, 'chapter'> }>(
  entries: readonly T[],
): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const e of entries) {
    const key = chapterLabel(e.data.chapter);
    const bucket = out.get(key) ?? [];
    bucket.push(e);
    out.set(key, bucket);
  }
  return out;
}

/**
 * Domain → set of chapter labels that have ≥1 question in that domain. The data
 * backbone of `<ObjectiveMap>` (#117): the coverage matrix is *derived* from the
 * question bank, so it can't drift from a separately-maintained table — the
 * cheapest proof the per-book `examDomains` taxonomy is populated + consistent.
 */
export function deriveObjectiveMap<
  T extends { data: Pick<Question, 'domain' | 'chapter'> },
>(entries: readonly T[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const e of entries) {
    const set = out.get(e.data.domain) ?? new Set<string>();
    set.add(chapterLabel(e.data.chapter));
    out.set(e.data.domain, set);
  }
  return out;
}
