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

export { defineBookConfig, BRANDON_PORTFOLIO_DEFAULT } from './config.js';
export { bookScaffoldIntegration } from './integration.js';
export type {
  BookProfile,
  BookPreset,         // v3.4.0 — canonical name (alias of BookProfile, closes #9)
  BookConfigOptions,
  ReleaseStatusConfig,
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
export { researchPortfolioChaptersRenderer } from './profiles/renderers/research-portfolio-chapters.js';

// v4.14.0 (#95): single source of truth for academic-profile part labels,
// shared by the /chapters renderer, Sidebar, and ChapterHeader.
export {
  ACADEMIC_PART_NAMES,
  academicPartName,
  academicPartHeading,
  academicPartOrdinal,
  UNKNOWN_PART_ORDINAL,
} from './lib/academic-parts.js';

// v4.14.3 (#121): fail-loud Theorem label resolver. Accepts legacy
// `type=`/`title=`/`label=` aliases so existing books render, and THROWS on an
// unresolvable kind instead of the old silent empty label. Shared by
// Theorem.astro and unit-tested in tests/theorem-label.test.mjs.
export {
  theoremLabel,
  resolveTheoremNumber,
  THEOREM_KINDS,
  KIND_LABEL,
  type TheoremKind,
  type TheoremLabelProps,
  type ResolvedTheoremLabel,
} from './lib/theorem-label.js';

// v4.15.0 (#109): configurable GitHub repo for CodeRef/CodeBlock. parseRepoSlug
// derives owner/repo from the consumer's package.json repository / git remote;
// buildGithubUrl takes an explicit repo+branch (no hardcoded post_transformers).
export {
  parseRepoSlug,
  resolveGithubRepo,
  originUrlFromGitConfig,
  buildGithubUrl,
  DEFAULT_GITHUB_BRANCH,
} from './lib/repo-url.js';

// v4.15.0: assertEnumProp — shared fail-loud validator for closed-union props
// (PocLayout/StatusBadge/Practice). Throws an actionable error instead of a
// silent broken render. Unit-tested in tests/assert-prop.test.mjs.
export { assertEnumProp } from './lib/assert-prop.js';

// v4.27.0 (#177): the scaffold's KaTeX macro library (37 macros — SSM notation,
// general math, the \bm→\boldsymbol alias), re-exported from the main entry so
// consumers can read or spread it without knowing the ./lib subpath. Per-book
// EXTENSION still goes through defineBookConfig({ katexMacros }) (#22), which
// shallow-merges on top of this set.
export { ssmMacros } from './lib/katex-macros.js';

// v4.16.0 (#96): cross-book link resolution. resolveBookHref maps a sibling
// book key → its base URL from the consumer's siblingBooks registry, throwing
// on an unknown book instead of emitting a dead cross-origin link.
export { resolveBookHref } from './lib/book-link.js';

// v4.26.0 (#80): pure route-href resolver for the book-aware navigation.
// chapterHref/apparatusHref turn declarative token patterns (chapterRoute /
// apparatusRoute from defineBookConfig) into base-prefixed links, so the
// Sidebar / ChapterNav / NavContent serve both single-book (default pattern)
// and multi-book consumers. No astro:content import → safe for the DTS bundle.
// Unit-tested in tests/nav-href.test.mjs.
export {
  chapterHref,
  apparatusHref,
  bookOf,
  slugOf,
  isCurrentChapter,
  type ChapterLike,
} from './lib/nav-href.js';

// v4.27.0 (#182): the shared BASE_URL trailing-slash normalizers — previously
// inlined in three regex idioms across 18 .astro files. normalizeBase for
// `${base}route/` composition; baseNoSlash for `${base}/route` composition.
// Param-taking by design: src/lib ships pre-compiled where Vite's
// import.meta.env replacement cannot reach.
export { normalizeBase, baseNoSlash } from './lib/nav-href.js';

// v4.17.0 (Tier 3, #112): exam-domain membership check. assertKnownDomain
// throws when a question's `domain` is not in the consumer's examDomains
// registry — the per-book analogue of resolveBookHref's unknown-book throw.
// Unit-tested in tests/exam-domains.test.mjs.
export { assertKnownDomain } from './lib/exam-domains.js';

// v4.17.0 (Tier 3, #112/#117): pure questions helpers — grouping + the
// objective-map coverage derivation. No astro:content dependency (the
// getCollection wrapper getAllQuestions lives in lib/questions.ts), so these
// are unit-tested from dist/ in tests/questions.test.mjs.
export {
  chapterLabel,
  sortQuestions,
  groupByDomain,
  groupByChapter,
  deriveObjectiveMap,
  distinctChaptersSorted,
} from './lib/questions-derive.js';

// v4.19.0 (#112): pure practice-exam engine — sampling (per-domain blueprint) +
// scoring (per-domain rollup + weak-domain routing). No DOM/Preact; the
// PracticeExam / AssessmentTest islands are thin UI over these. Unit-tested in
// tests/exam-engine.test.mjs.
export {
  shuffle,
  sampleExam,
  scoreExam,
  type ExamQuestion,
  type ExamBlueprint,
  type ExamResult,
  type DomainScore,
} from './lib/exam-engine.js';

// v4.21.0 (#112-UI/#113): pure manifest/routing bridge between the questions
// collection and the ExamRunner island — scoreable-MCQ filtering, weak-domain →
// chapter routing (string chapters link, numeric chapters label — no fabricated
// URLs), and the cross-domain assessment blueprint. Unit-tested in
// tests/exam-manifest.test.mjs.
export {
  buildExamManifest,
  deriveDomainRouting,
  spreadBlueprint,
  type RoutingChapter,
} from './lib/exam-manifest.js';

// v4.22.0 (#116): pure flashcard-deck manifest from the glossary collection —
// the island receives id+front only (backs are server-rendered MDX). Unit-
// tested in tests/flashcards.test.mjs.
export { buildFlashcardDeck, type FlashcardRef } from './lib/flashcards.js';

// (#section-map): pure section-map logic — the shared h2/h3 TOC filter
// (tocHeadings, used by both ChapterTOC.astro and the SectionMap island) and
// the scrollspy active-pick (pickActive, fed IntersectionObserver state by the
// island). No DOM/Preact; unit-tested in tests/section-map.test.mjs.
export {
  tocHeadings,
  pickActive,
  type VisibleHeading,
} from './lib/section-map.js';

// v4.19.0 (#111): pure PartReview selection — filter chapters by `part` (String-
// coerced), sort to book order (chapterSortKey), join the build-exercises index.
// No DOM; PartReview.astro renders it. Unit-tested in tests/part-review.test.mjs.
export {
  selectPartExercises,
  type ReviewExercise,
  type ReviewChapter,
  type PartReviewGroup,
  type PartReviewSelection,
} from './lib/part-review.js';

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

// v4.3.0 defineTips API: cross-volume numbered-tips registry per Pragmatic
// Programmer precedent (closes #70). Paired with <Tip>, <TipsCard>, /tips
// auto-route, and book-scaffold build-tips script.
export {
  defineTips,
  type TipsConfig,
  type TipsConfigInput,
} from './lib/define-tips.js';

// Schema enums + Zod schemas.
export {
  // Enum arrays
  academicParts,
  chapterStatus,
  layoutModes,                           // 1d: per-page width knob ('default'|'wide')
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
  // v4.8.0: provenance (process-as-artifact audit trail)
  citationBackstops,
  provenanceObject,
  provenanceSchema,
  // v4.17.0 (Tier 3, #112): study-guide questions collection — enums + schema +
  // per-type refine. Registered as a collection in schemas-entry.ts; consumed by
  // /practice-exam + <ObjectiveMap>. Unit-tested in tests/questions-schema.test.mjs.
  questionTypes,
  bloomLevels,
  questionDifficulties,
  questionSchema,
  refineQuestion,
  refinedQuestionSchema,
  // v4.19.0 (#115): study-guide glossary collection schema. Registered in
  // schemas-entry.ts; consumed by /glossary + <Term>. Tested in tests/glossary.test.mjs.
  glossarySchema,
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

// v4.8.0: inferred provenance type (consumed by components/Provenance.astro).
export type { Provenance } from './schemas.js';

// v4.17.0 (Tier 3, #112): inferred question types for consumers building custom
// study-guide surfaces over getCollection('questions').
export type { Question, QuestionType, BloomLevel } from './schemas.js';

// v4.19.0 (#115): inferred glossary-term type for consumers building custom
// surfaces over getCollection('glossary').
export type { GlossaryTerm } from './schemas.js';
