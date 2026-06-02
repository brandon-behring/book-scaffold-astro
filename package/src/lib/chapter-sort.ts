/**
 * src/lib/chapter-sort.ts — pure sort-key helper for chapter frontmatter.
 *
 * Lives in its own file (no `astro:content` imports) so tsup can include it
 * in the toolkit's DTS bundle without trying to resolve Astro's virtual
 * modules at build time. The Astro-context wrappers (sortKey, getAllChapters,
 * getNeighbors) live in src/lib/chapters.ts and import from here.
 *
 * The academic `part`→ordinal mapping is shared with the label surfaces via
 * `academicPartOrdinal` (src/lib/academic-parts.ts, also astro:content-free),
 * so on-page sort order and the Roman heading prefix derive from one canonical
 * order (`academicParts`) and cannot drift apart (#99).
 */
import { academicPartOrdinal, UNKNOWN_PART_ORDINAL } from './academic-parts.js';

/**
 * Pure-function sort key from a chapter frontmatter object. Spans both
 * tools and academic schemas:
 *
 *  - Tools: numeric `part` (0-10), numeric `chapter` (0-99). Encodes as
 *    `part * 1000 + chapter` so chapters within a part stay grouped.
 *  - Academic: string-enum `part` (foundations|ssm-core|...), numeric `week`
 *    (1-99), no `chapter`. Maps `part` to a fixed ordinal then encodes as
 *    `partOrdinal * 1000 + week`.
 *
 * v3.5.2 (closes #24): previously the tools-only formula crashed on
 * academic chapters (string `part`, no `chapter`) by producing NaN sort
 * keys.
 */
export function chapterSortKey(data: Record<string, unknown>): number {
  const partRaw = data.part;
  const partOrdinal =
    typeof partRaw === 'number'
      ? partRaw
      : typeof partRaw === 'string'
        ? academicPartOrdinal(partRaw)
        : UNKNOWN_PART_ORDINAL;
  const within =
    typeof data.chapter === 'number'
      ? data.chapter
      : typeof data.week === 'number'
        ? data.week
        : 0;
  return partOrdinal * 1000 + within;
}
