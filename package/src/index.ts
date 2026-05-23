/**
 * @brandon_m_behring/book-scaffold-astro — main entry.
 *
 * Node-loadable: this file is imported by the consumer's `astro.config.mjs`
 * which uses Node's default ESM loader. No `astro:` virtual modules here.
 * For `defineBookSchemas` (which needs `astro:content`), import from the
 * `/schemas` subpath which is only loaded inside Vite-processed
 * `content.config.ts`. See PACKAGE_DESIGN.md §5.
 *
 * Stable surface (main entry):
 *   - defineBookConfig({ site, profile?, extraIntegrations?, extraStyles?, markdown? })
 *   - bookScaffoldIntegration (used internally; exposed for advanced override)
 *   - BookProfile, BOOK_PROFILES, BookConfigError, resolveProfile
 *   - schema enum constants (academicParts, chapterStatus, toolSlugs, …)
 *   - Raw Zod schemas (academicChapterSchema, toolsChapterSchema, …) for
 *     consumers who want to compose without the defineBookSchemas helper.
 *
 * Stable surface (`/schemas` subpath, separate entry):
 *   - defineBookSchemas({ profile?, chaptersBase? })
 */

// ----- Public re-exports -----

export { defineBookConfig } from './config.js';
export { bookScaffoldIntegration } from './integration.js';
export type {
  BookProfile,
  BookPreset,         // v3.4.0 — canonical name (alias of BookProfile, closes #9)
  BookConfigOptions,
  BookSchemasOptions,
  BookScaffoldIntegrationOptions,
  RouteToggles,
} from './types.js';
export {
  BOOK_PROFILES,
  BOOK_PRESETS,       // v3.4.0 — alias of BOOK_PROFILES
  BookConfigError,
  resolveProfile,
  resolvePreset,      // v3.4.0 — canonical resolver (accepts both preset + profile)
} from './types.js';

// Profile-kit: defineProfile helper (v3.3.0) for consumers writing their
// own profile modules (advanced) or extending toolkit-shipped ones.
export { defineProfile, type ProfileDefinition } from './profile-kit.js';

// mdx-components helper (v3.3.0, closes #2): consumers create
// src/mdx-components.ts that calls defineMdxComponents({ ... }); scaffold-
// injected routes (/print etc.) import the default export via a Vite
// virtual module.
export { defineMdxComponents } from './mdx-components-resolver.js';

// Freshness utility (v3.3.0): now tolerates undefined lastVerified;
// returns null instead of crashing (closes #1).
export { getFreshness, freshnessLabel, type Freshness, type FreshnessStatus, type VolatilityLevel } from './lib/freshness.js';

// Chapter sort key (v3.5.2, closes #24): pure-function helper that produces
// a numeric ordering for both tools-profile (numeric part+chapter) and
// academic-profile (string part-enum + numeric week) chapter shapes.
// Exported so consumers building custom chapter index pages can reuse the
// same ordering as the shipped /chapters route. Sourced from chapter-sort.ts
// (no Astro virtual-module imports — safe for the DTS bundle).
export { chapterSortKey } from './lib/chapter-sort.js';

// Chapters renderer strategy (v3.7.0, closes #35): per-profile strategy
// interface for the /chapters route. Pure-function design; no Astro imports
// in implementations. The route file at pages/chapters.astro dispatches via
// PROFILES[BOOK_PROFILE].chaptersRenderer (with fallbackChaptersRenderer
// as a safety net for profiles that haven't shipped a dedicated renderer).
export type {
  ChaptersRenderer,
  PartKey,
  VolatilityBadge,
  StatusBadge,
  FreshnessAffordance,
} from './lib/chapters-renderer.js';
export { toolsChaptersRenderer } from './profiles/renderers/tools-chapters.js';
export { academicChaptersRenderer } from './profiles/renderers/academic-chapters.js';
export { fallbackChaptersRenderer } from './profiles/renderers/fallback-chapters.js';

// v4.0.0 defineStyle API: typed, named, importable config bundles composed
// via `styles: [...]` in defineBookConfig. Replaces the v3 `preset:` shorthand.
// See recipes/15-defining-styles.md + MIGRATION-v3-to-v4.md.
export {
  defineStyle,
  composeStyles,
  normalizeFrontmatterConfig,
  type Style,
  type StyleInput,
  type PartialRouteToggles,
  type FrontmatterRouteConfig,
} from './lib/define-style.js';
export {
  academicStyle,
  toolsStyle,
  minimalStyle,
  courseNotesStyle,
  researchPortfolioStyle,
  BUILTIN_STYLES,
} from './styles/built-in.js';

// Schema enums + Zod schemas.
export {
  // Enum arrays
  academicParts,
  chapterStatus,
  toolSlugs,
  volatilityLevels,
  sourceTiers,
  changeKinds,
  patternCategories,
  // Raw Zod schemas (no defineCollection wrapper — safe for any context)
  academicChapterSchema,
  toolsChapterSchema,
  minimalChapterSchema,
  courseNotesChapterSchema,
  researchPortfolioChapterSchema,        // v3.5.0 (#6)
  sourceTiersResearch,                   // v3.5.0 — T1/T2/T3/T4 short form for research-portfolio sources
  sourcesSchema,
  changelogSchema,
  patternsSchema,
} from './schemas.js';

// Inferred chapter types per profile (v3.3.0). Type-only re-export from
// the registry — DTS bundler handles type re-exports cleanly as long as
// the Zod schemas they reference all live in a single file (schemas.ts).
export type {
  AcademicChapter,
  ToolsChapter,
  MinimalChapter,
  CourseNotesChapter,
  ResearchPortfolioChapter,    // v3.5.0 (#6)
  ChapterFor,
} from './profiles/index.js';
