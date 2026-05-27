/**
 * Zod schemas + enum constants for book content collections.
 *
 * All Zod schemas live in this single file (single `astro/zod` import) so
 * tsup's DTS bundler doesn't traverse Zod's dual CJS/ESM package multiple
 * times — rollup-plugin-dts can't resolve Zod v4's `default` export when
 * the same Zod import appears in multiple entry-graph files.
 *
 * Per-profile organization lives at src/profiles/<name>.ts which imports
 * these schemas as values + declares the inferred chapter type + the
 * route/style defaults. See ~/.claude/plans/address-and-finish-moonlit-shell.md.
 *
 * Imports `z` from `astro/zod` (a real module re-export) so schemas can
 * be constructed at package-load time outside an Astro runtime context.
 * `defineBookSchemas` in schemas-entry.ts wraps these into Astro
 * `defineCollection` calls at the consumer's content-config load time.
 */
import { z } from 'astro/zod';

// ===== Tools-profile enums =====

export const toolSlugs = [
  'claude-code',
  'gemini-cli',
  'codex-cli',
  'cross-tool',
] as const;

export const volatilityLevels = [
  'stable-principle',
  'architectural-pattern',
  'feature-surface',
] as const;

export const sourceTiers = [
  'T1-official',
  'T2-release-notes',
  'T3-practitioner',
  'T4-conjecture',
] as const;

export const changeKinds = ['added', 'removed', 'changed', 'deprecated'] as const;

export const patternCategories = [
  'safety',
  'scale',
  'context',
  'interaction',
  'extension',
  'other',
] as const;

// ===== Academic-profile enums =====

export const academicParts = [
  'foundations',
  'ssm-core',
  'beyond-ssm',
  'integration',
  'synthesis',
] as const;

export const chapterStatus = [
  'implemented',
  'chapter_only',
  'reading_only',
  'prose_only',
  'code_only',
  'scaffolded',
  'planned',
] as const;

// ===== Chapter schemas — one per profile =====

export const academicChapterSchema = z.object({
  week: z.number().int().min(1).max(99),
  part: z.enum(academicParts),
  title: z.string().min(1),
  status: z.enum(chapterStatus),
  roadmap_lines: z.tuple([z.number().int(), z.number().int()]).optional(),
  code_path: z.string().optional(),
  tests_path: z.string().optional(),
  notebook_path: z.string().optional(),
  description: z.string().optional(),
  draft: z.boolean().default(false),
  // v4.6.0: optional SEO / article:* fields consumed by Chapter.astro.
  // All optional; existing chapters without these continue to work.
  author: z.string().optional(),
  published: z.date().optional(),
  updated: z.date().optional(),
  tags: z.array(z.string()).default([]),
  image: z.string().optional(),
});

export const toolsChapterSchema = z.object({
  title: z.string().min(1),
  part: z.number().int().min(0).max(10),
  chapter: z.number().int().min(0).max(99),
  volatility: z.enum(volatilityLevels),
  tools_compared: z.array(z.enum(toolSlugs)).min(1),
  last_verified: z.date(),
  sources: z.array(z.string()).default([]),
  description: z.string().optional(),
  draft: z.boolean().default(false),
  updated: z.date().optional(),
  // v4.6.0: optional SEO / article:* fields consumed by Chapter.astro.
  // `updated` already existed; the rest are new.
  author: z.string().optional(),
  published: z.date().optional(),
  tags: z.array(z.string()).default([]),
  image: z.string().optional(),
});

/** Minimal profile currently aliases the tools schema. */
export const minimalChapterSchema = toolsChapterSchema;

/**
 * Research-portfolio source tiers (v3.5.0, closes issue #6).
 *
 * Lighter shape than the tools-profile `sourceTiers` enum (`'T1-official'` etc.)
 * — research portfolios cite primary sources inline per-chapter, so short
 * `'T1'`/`'T2'` is more compact and readable. Semantics overlap (T1 = official
 * primary, T2 = secondary, T3 = practitioner / community, T4 = conjecture).
 */
export const sourceTiersResearch = ['T1', 'T2', 'T3', 'T4'] as const;

/**
 * Course-notes profile schema (v3.3.0, closes issue #4). Designed for
 * course-derived study notes (DLAI, Coursera, Manning, ...). Key fields:
 * - `course`/`instructor`/`source_url` — attribution
 * - `learning_outcomes` — structured Bloom-tag-ready outcomes
 * - `tags` — freeform string array (NOT tools_compared enum)
 */
export const courseNotesChapterSchema = z.object({
  // Identity
  title: z.string().min(1),
  chapter: z.number().int().min(0).max(99),
  part: z.number().int().min(0).max(20).default(1),
  description: z.string().optional(),

  // Source attribution
  course: z.string().optional(),
  instructor: z.string().optional(),
  source_url: z.string().url().optional(),

  // Pedagogy
  learning_outcomes: z
    .array(
      z.object({
        id: z.string(),
        verb: z.string(),
        text: z.string(),
      }),
    )
    .default([]),
  tags: z.array(z.string()).default([]),

  // Provenance + status (shared shape with tools profile)
  last_verified: z.date(),
  volatility: z.enum(volatilityLevels).default('architectural-pattern'),
  sources: z.array(z.string()).default([]),
  draft: z.boolean().default(false),

  // v4.6.0: optional SEO / article:* fields consumed by Chapter.astro.
  // `tags` already existed; the rest are new. `instructor` (line 130) is
  // attribution metadata — distinct from `author` (the note-writer/curator).
  author: z.string().optional(),
  published: z.date().optional(),
  updated: z.date().optional(),
  image: z.string().optional(),
});

/**
 * Research-portfolio profile schema (v3.5.0, closes issue #6).
 *
 * Union of academic + tools field shapes, modernized: uses `tags` (freeform
 * string array) instead of `tools_compared` (CLI-enum, doesn't fit research
 * content). Designed for research-portfolio books that need BOTH academic-
 * style structure (week/part/status, math/BibTeX/Theorem support via the
 * `katex: true` profile flag) AND tools-style provenance (volatility class,
 * tier-tagged sources, last_verified freshness signal).
 *
 * Reference (forthcoming) consumer: prompt-injection-portfolio.
 *
 * Hierarchy fields are all optional — chapters can use academic-style
 * (`week` + part-enum string) OR tools-style (`chapter` + part-number) OR
 * minimal (just title). The route templates dispatch on which is set.
 *
 * Sources are STRUCTURED INLINE (each chapter cites primary sources directly)
 * rather than referencing a sources collection — saves cross-file lookup +
 * matches research-paper citation conventions. Tier shorthand T1/T2/T3/T4
 * (per sourceTiersResearch) over the tools-profile long form.
 */
export const researchPortfolioChapterSchema = z.object({
  // Identity
  title: z.string().min(1),
  slug: z.string().optional(),                 // explicit slug override (otherwise filename)
  description: z.string().optional(),

  // Hierarchy — accept either academic-style or tools-style; all optional.
  // The academic 'part' field is a string enum; tools 'part' is a number.
  // Use z.union to permit either type.
  part: z.union([z.number().int().min(0).max(20), z.string()]).optional(),
  week: z.number().int().min(0).max(99).optional(),
  chapter: z.number().int().min(0).max(99).optional(),

  // Academic-style status (optional for research-portfolio — books may track
  // chapters as 'prose_only' / 'experimental-result' / etc.).
  status: z
    .enum([
      'implemented',
      'chapter_only',
      'reading_only',
      'prose_only',
      'code_only',
      'scaffolded',
      'planned',
    ])
    .optional(),

  // Research-portfolio specific: nature of the chapter's content.
  // Distinct from academic's 'status' (which tracks authoring state) — this
  // describes the EVIDENCE TYPE the chapter rests on.
  freshness: z
    .enum([
      'experimental-result',   // primary data the author produced
      'literature-survey',     // synthesis of others' work
      'theoretical',           // analytical / mathematical argument
      'reference',             // canonical material (definitions, taxonomy)
    ])
    .optional(),

  // Provenance (tools-style — overlap with tools/course-notes profiles).
  volatility: z.enum(volatilityLevels).optional(),
  tags: z.array(z.string()).default([]),       // freeform; replaces tools_compared

  // Structured inline sources with T1-T4 tiers.
  sources: z
    .array(
      z.object({
        tier: z.enum(sourceTiersResearch),
        url: z.string().url(),
        label: z.string().min(1),
      }),
    )
    .default([]),

  // Status + dates.
  last_verified: z.date(),
  updated: z.date().optional(),
  draft: z.boolean().default(false),

  // v4.6.0: optional SEO / article:* fields consumed by Chapter.astro.
  // `tags` + `updated` already existed; `author` + `published` + `image` are new.
  author: z.string().optional(),
  published: z.date().optional(),
  image: z.string().optional(),
});

// ===== Inferred chapter types — one per schema =====
//
// Exported here so per-profile modules can re-export under a common name
// (AcademicChapter, ToolsChapter, etc.) without each touching `z.infer`
// in its own file (which would multiply the Zod import points and trip
// rollup-plugin-dts).

export type AcademicChapter = z.infer<typeof academicChapterSchema>;
export type ToolsChapter = z.infer<typeof toolsChapterSchema>;
export type MinimalChapter = z.infer<typeof minimalChapterSchema>;
export type CourseNotesChapter = z.infer<typeof courseNotesChapterSchema>;
export type ResearchPortfolioChapter = z.infer<typeof researchPortfolioChapterSchema>;

// ===== Collateral collection schemas (tools-profile; always-defined) =====

export const sourcesSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1),
  author: z.string().optional(),
  publish_date: z.date().optional(),
  captured_at: z.date(),
  content_hash: z
    .string()
    .regex(/^sha256:[a-f0-9]+$/)
    .optional(),
  tier: z.enum(sourceTiers),
  tool: z.enum(toolSlugs),
  perma_cc: z.string().url().nullable().optional(),
  local_cache: z.string().nullable().optional(),
});

export const changelogSchema = z.object({
  tool: z.enum(toolSlugs),
  versions: z
    .array(
      z.object({
        version: z.string().min(1),
        date: z.date(),
        changes: z
          .array(
            z.object({
              pattern: z.string(),
              kind: z.enum(changeKinds),
              note: z.string().min(1),
              source_key: z.string().optional(),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
});

export const patternsSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.enum(patternCategories).optional(),
  convergence_date: z.date().nullable().optional(),
});
