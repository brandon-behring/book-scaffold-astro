/**
 * section-map.ts — PURE heading-selection + scrollspy logic for the right-gutter
 * "On this page" section map (#section-map).
 *
 * No DOM, no Preact: this is the testable core under both ChapterTOC.astro (the
 * collapsed mobile fallback) and the SectionMap island (the sticky gutter nav).
 * Two pure, total functions:
 *
 *   - tocHeadings:  the ONE filter (h2+h3) that both the fallback TOC and the
 *                   gutter map share — a single source of truth so the two
 *                   never disagree about which headings are "on this page".
 *   - pickActive:   given the headings currently intersecting the viewport (slug
 *                   + viewport-relative top), choose which one is "active". The
 *                   island feeds it IntersectionObserver state; node:test feeds
 *                   it plain arrays. Browser geometry stays OUT of this file.
 *
 * Both are unit-tested in tests/section-map.test.mjs (node:test, no browser),
 * mirroring exam-engine.ts.
 */

import type { MarkdownHeading } from 'astro';

/**
 * Filter a chapter's headings to the TOC set: depth 2–3 only. h1 is the chapter
 * title (rendered by ChapterHeader, not the body) and h4+ is noise in an anchor
 * list. This is the shared contract — ChapterTOC.astro and SectionMap.astro both
 * call it so the fallback and the gutter map carry IDENTICAL entries. Pure: it
 * copies (filter) rather than mutating the input.
 */
export function tocHeadings(headings: MarkdownHeading[]): MarkdownHeading[] {
  return headings.filter((h) => h.depth >= 2 && h.depth <= 3);
}

/**
 * One visible heading, as the island measures it: its slug and its
 * viewport-relative top (CSS pixels — `getBoundingClientRect().top`). A negative
 * `top` means the heading has scrolled above the top of the viewport.
 */
export interface VisibleHeading {
  slug: string;
  /** Viewport-relative top in px (negative = scrolled above the fold). */
  top: number;
}

/**
 * Choose the active section slug from the headings currently intersecting the
 * viewport.
 *
 * Rule (a stable, total scrollspy):
 *   1. Prefer the topmost heading at or below the top of the viewport — the
 *      visible heading with the SMALLEST non-negative `top`. That's the section
 *      the reader has just scrolled to / is reading into.
 *   2. If every visible heading is above the fold (all `top` negative — e.g. a
 *      heading STRADDLING the top edge: its top is slightly negative but its box
 *      still overlaps the top zone, so it's intersecting yet has no non-negative
 *      sibling below it), fall back to the one nearest the fold from above: the
 *      GREATEST `top` (closest to 0 from the negative side). That keeps the
 *      enclosing section lit instead of going dark mid-section. (A heading whose
 *      box FULLY scrolled above the top has left `inView` entirely — it isn't in
 *      `visible` at all, and is handled by the empty-set → `prev` branch below.)
 *   3. If NOTHING is visible (the observer reports an empty set — between two
 *      sparse intersections, or scrolled past the last heading), retain `prev`
 *      so the highlight is sticky rather than flickering off.
 *
 * Pure + total: no DOM, no throw, deterministic. Ties (equal `top`) resolve to
 * the first in iteration order, which the island passes in document order.
 */
export function pickActive(
  visible: ReadonlyArray<VisibleHeading>,
  prev: string | null,
): string | null {
  if (visible.length === 0) return prev;

  let bestNonNeg: VisibleHeading | null = null; // smallest top >= 0
  let bestAbove: VisibleHeading | null = null; // greatest top < 0
  for (const h of visible) {
    if (h.top >= 0) {
      if (bestNonNeg === null || h.top < bestNonNeg.top) bestNonNeg = h;
    } else {
      if (bestAbove === null || h.top > bestAbove.top) bestAbove = h;
    }
  }

  if (bestNonNeg !== null) return bestNonNeg.slug;
  // All above the fold: the one just above the top edge keeps its section lit.
  if (bestAbove !== null) return bestAbove.slug;
  return prev;
}
