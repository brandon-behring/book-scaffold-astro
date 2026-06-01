/**
 * src/lib/academic-parts.ts — single source of truth for academic-profile
 * part labels (#95).
 *
 * The academic `part` enum (src/schemas.ts: academicParts) is rendered on
 * three surfaces — the `/chapters` index, the Sidebar nav, and the chapter
 * header. Before v4.14.0 each surface carried its own copy of the
 * enum→label map, and they had silently diverged: `beyond-ssm` rendered
 * "Beyond SSM" on the index but "Beyond SSMs" in the sidebar/header. This
 * module is the one place that owns:
 *
 *   - the base display name per part ("SSM Core", "Beyond SSMs", …), and
 *   - the unknown/custom-part fallback (titleCase, consistently).
 *
 * The renderer uses the bare name; the Sidebar/ChapterHeader compose
 * "Part {roman} · {name}". Both the Roman heading prefix AND the on-page
 * sort order derive from the part's position in `academicParts` (the
 * canonical order) via `academicPartOrdinal()` below — so labels and
 * ordering share one source and cannot drift apart (#95 + #99).
 */
import { academicParts } from '../schemas.js';

type AcademicPart = (typeof academicParts)[number];

/**
 * Base display names for the academic `part` enum. An explicit map (not
 * naive title-casing) so acronyms render correctly: `ssm-core` → "SSM Core",
 * not "Ssm Core" (#91). Keys mirror `academicParts` in src/schemas.ts.
 * Canonical spelling for `beyond-ssm` is the plural "Beyond SSMs" (#95).
 */
export const ACADEMIC_PART_NAMES: Record<AcademicPart, string> = {
  foundations: 'Foundations',
  'ssm-core': 'SSM Core',
  'beyond-ssm': 'Beyond SSMs',
  integration: 'Integration',
  synthesis: 'Synthesis',
};

/** Roman ordinals for the "Part {roman}" heading prefix, indexed by the
 *  part's position in `academicParts`. Sized past the 5 known parts so a
 *  future enum addition still resolves a numeral. */
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

/** Title-case an enum string: "consumer-custom" → "Consumer Custom".
 *  Fallback for parts outside the known ACADEMIC_PART_NAMES map. */
function titleCase(part: string): string {
  return part
    .split('-')
    .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

/**
 * Bare part name for the `/chapters` index group heading. Known parts use
 * the explicit map; unknown/custom parts fall back to titleCase.
 */
export function academicPartName(part: string): string {
  return ACADEMIC_PART_NAMES[part as AcademicPart] ?? titleCase(part);
}

/** Ordinal returned for any `part` outside `academicParts` — it sorts after
 *  all known parts and renders with no Roman prefix. */
export const UNKNOWN_PART_ORDINAL = 99;

/**
 * 1-based ordinal of an academic `part`, from its position in `academicParts`
 * (the canonical order); `UNKNOWN_PART_ORDINAL` for anything outside the enum.
 * The single source for BOTH the on-page sort key (academicChaptersRenderer
 * and chapterSortKey) and the Roman heading prefix below — so a reorder of
 * `academicParts` moves sort order and labels together, never apart (#99).
 */
export function academicPartOrdinal(part: string): number {
  const i = academicParts.indexOf(part as AcademicPart);
  return i >= 0 ? i + 1 : UNKNOWN_PART_ORDINAL;
}

/**
 * "Part {roman} · {name}" heading for the Sidebar and ChapterHeader. Known
 * parts get the Roman-ordinal prefix; unknown/custom parts (no ordinal)
 * fall back to the bare title-cased name — one consistent rule across both
 * surfaces, replacing the old divergent fallbacks (raw key vs "Part: key").
 */
export function academicPartHeading(part: string): string {
  const ord = academicPartOrdinal(part);
  const name = academicPartName(part);
  return ord === UNKNOWN_PART_ORDINAL ? name : `Part ${ROMAN[ord - 1]} · ${name}`;
}
