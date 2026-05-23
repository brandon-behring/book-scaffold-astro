/**
 * src/lib/chapters-renderer.ts — per-profile strategy interface for the
 * /chapters route. Pure-function strategy; no Astro imports here or in
 * implementations (kept that way so profile modules can re-export renderers
 * without dragging Astro virtual modules into tsup's DTS bundle — same
 * constraint that motivated the chapter-sort.ts split in v3.5.2).
 *
 * v3.7.0 (closes #35): replaces the field-presence discriminator that
 * v3.5.2 put inside pages/chapters.astro. Each profile module now owns
 * its chapters-page rendering semantics via this interface, and the
 * route file dispatches via PROFILES[BOOK_PROFILE].chaptersRenderer.
 *
 * Why pure data, not Astro components: profile modules are bundled by
 * tsup into dist/, but Astro components (.astro files) cannot be processed
 * by tsup's DTS bundler. Keeping the renderer surface as plain data
 * (strings, numbers, plain objects, null) lets the route file own all
 * JSX rendering while each profile owns the per-shape semantics.
 */

export type PartKey = string | number;

export type FreshnessStatus = 'fresh' | 'verify-soon' | 'stale';

/** Volatility badge metadata for tools-profile rendering. */
export interface VolatilityBadge {
  /** CSS modifier (`stable-principle | architectural-pattern | feature-surface`). */
  level: string;
  /** Visible chip text + tooltip body. */
  label: string;
}

/** Academic status badge metadata. */
export interface StatusBadge {
  /** CSS modifier (`implemented | scaffolded | planned | ...`). */
  status: string;
  /** Visible chip text + tooltip body. */
  label: string;
}

/** Freshness affordance with status band + ARIA-friendly label. */
export interface FreshnessAffordance {
  status: FreshnessStatus;
  label: string;
}

/**
 * A renderer owns the per-shape semantics for the /chapters route. The
 * route file orchestrates: data fetching, byPart grouping, ToolFilter
 * island wiring, CSS, structural JSX. The renderer answers:
 *
 *  - How is this chapter labelled?
 *  - Which badges apply?
 *  - What's the ToolFilter attribute?
 *  - How do these chapters sort?
 *
 * All methods are pure: same input → same output, no side effects.
 */
export interface ChaptersRenderer {
  /** Group key for the byPart Map. Tools = number, academic = string-enum. */
  partKey(data: Record<string, unknown>): PartKey;

  /** Human-facing heading label for a Part group ("Part 1", "Foundations"). */
  formatPartLabel(part: PartKey): string;

  /** Whether the group renders as an appendix (tools profile only). */
  isAppendix(part: PartKey): boolean;

  /** Chapter card heading text. Examples:
   *   tools         → "Chapter 1" or "Appendix a"
   *   academic      → "Week 3"
   *   fallback      → best-effort from available fields
   */
  formatChapterNumber(data: Record<string, unknown>, appendix: boolean): string;

  /** Value for the `data-tools` attribute (ToolFilter island wiring).
   *  Tools = space-joined slugs from `tools_compared`.
   *  Non-tools = "cross-tool" (always-visible regardless of filter). */
  getToolsAttr(data: Record<string, unknown>): string;

  /** Volatility badge metadata, or null if the profile doesn't use it. */
  getVolatilityData(data: Record<string, unknown>): VolatilityBadge | null;

  /** Academic status badge metadata, or null. */
  getStatusData(data: Record<string, unknown>): StatusBadge | null;

  /** Freshness affordance, or null if the profile doesn't track `last_verified`.
   *  `now` is injectable for deterministic tests. */
  getFreshnessData(data: Record<string, unknown>, now?: Date): FreshnessAffordance | null;

  /** "verified YYYY-MM-DD" meta-row text, or null. */
  getVerifiedDateLabel(data: Record<string, unknown>): string | null;

  /** Tools-compared tag list for the bottom card row, or empty array. */
  getToolsCompared(data: Record<string, unknown>): string[];

  /** Sort key — profile-aware. Tools = `part * 1000 + chapter`;
   *  academic = `partOrdinal * 1000 + week`. */
  sortKey(data: Record<string, unknown>): number;
}
