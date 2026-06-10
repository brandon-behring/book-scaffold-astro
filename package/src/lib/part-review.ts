/**
 * part-review.ts — PURE selection for <PartReview> (#111).
 *
 * Picks a Part's exercises out of the build-exercises index: filter the chapters
 * to those in `part` (String-coerced so a number-vs-string prop can't silently
 * miss — tools/minimal/course-notes chapters store a numeric `part`, academic a
 * string enum), order them by `chapterSortKey` (book order), and join against the
 * exercises index. No `astro:content` import — unit-tested in
 * tests/part-review.test.mjs and DTS-bundle-safe, like exam-engine.ts /
 * chapter-sort.ts. `PartReview.astro` is a thin render over this.
 */
import { chapterSortKey } from './chapter-sort.js';

/** One exercise as emitted by `book-scaffold build-exercises` (src/data/exercises.json). */
export interface ReviewExercise {
  id: string;
  problem: string;
}

/** A chapter entry — structurally what `getCollection('chapters')` yields. */
export interface ReviewChapter {
  id: string;
  data: Record<string, unknown>;
}

export interface PartReviewGroup {
  chapter: string;
  exercises: ReviewExercise[];
}

export interface PartReviewSelection {
  groups: PartReviewGroup[];
  total: number;
}

/**
 * Select a Part's exercises, in book order, joining `chapters` (filtered by
 * `part`) against the `byChapter` index (keyed by chapter id). `part` is matched
 * with `String()` coercion so `<PartReview part="2" />` finds numeric-`part`
 * chapters and vice versa (the fail-silent trap a strict `===` left). Chapters
 * with no exercises in the index are skipped; `total` sums the rest.
 */
export function selectPartExercises(
  chapters: readonly ReviewChapter[],
  byChapter: Readonly<Record<string, ReviewExercise[]>>,
  part: number | string,
): PartReviewSelection {
  const want = String(part);
  const groups = chapters
    .filter((c) => String(c.data.part ?? '') === want)
    .sort((a, b) => chapterSortKey(a.data) - chapterSortKey(b.data))
    .map((c) => ({ chapter: c.id, exercises: byChapter[c.id] ?? [] }))
    .filter((g) => g.exercises.length > 0);
  const total = groups.reduce((n, g) => n + g.exercises.length, 0);
  return { groups, total };
}
