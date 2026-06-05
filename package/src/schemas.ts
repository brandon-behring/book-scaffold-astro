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

// ===== Provenance (v4.8.0) — process-as-artifact audit trail =====
//
// Optional per-chapter block attached to EVERY profile schema below.
// components/Provenance.astro renders it as a collapsible "How this was made"
// disclosure (opt-out: absent → fallback). Distinct from AICollaborationDisclosure
// (book-level, manual). Paths are repo-relative, so prompts_archive / decisions_log
// use plain z.string() — NOT .url() (which would reject "DECISIONS.md#anchor").
// audit_history.type is a free string (real audit types vary: 'routine',
// 'independent', 'first-deploy', ...); citation_backstop is a controlled vocabulary.
export const citationBackstops = ['research-kb', 'manual', 'unverified'] as const;

export const provenanceObject = z
  .object({
    ai_tools: z.array(z.string()).default([]),
    prompts_archive: z.string().optional(),
    decisions_log: z.string().optional(),
    audit_history: z
      .array(z.object({ date: z.date(), type: z.string(), file: z.string() }))
      .default([]),
    citation_backstop: z.enum(citationBackstops).optional(),
  })
  // .strict(): a misspelled key (e.g. `desisions_log`) must fail loud at build,
  // not be silently stripped — silent data loss is the opposite of an audit trail.
  .strict();

// Attached to every chapter schema as an optional field. The `.refine` makes
// "present ⇒ non-empty": a bare `provenance: {}` is author error (omit the key
// to opt out instead), so it fails fast rather than rendering a meaningless block.
export const provenanceSchema = provenanceObject
  .refine(
    (p) =>
      p.ai_tools.length > 0 ||
      p.audit_history.length > 0 ||
      Boolean(p.citation_backstop) ||
      Boolean(p.prompts_archive) ||
      Boolean(p.decisions_log),
    { message: 'provenance is present but empty — omit the key, or set at least one field' },
  )
  .optional();

// ===== Chapter schemas — one per profile =====

export const academicChapterSchema = z.object({
  week: z.number().int().min(1).max(99),
  part: z.enum(academicParts),
  title: z.string().min(1),
  slug: z.string().optional(),                 // v4.9.0: explicit URL slug override (else filename → entry.id)
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
  // v4.8.0: optional process-as-artifact audit trail (Provenance.astro).
  provenance: provenanceSchema,
});

export const toolsChapterSchema = z.object({
  title: z.string().min(1),
  slug: z.string().optional(),                 // v4.9.0: explicit URL slug override (else filename → entry.id)
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
  // v4.8.0: optional process-as-artifact audit trail (Provenance.astro).
  provenance: provenanceSchema,
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
  slug: z.string().optional(),                 // v4.9.0: explicit URL slug override (else filename → entry.id)
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
  // v4.8.0: optional process-as-artifact audit trail (Provenance.astro).
  provenance: provenanceSchema,
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
  // v4.8.0: optional process-as-artifact audit trail (Provenance.astro).
  provenance: provenanceSchema,
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
export type Provenance = z.infer<typeof provenanceObject>;

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

// ===== Study-guide: questions collection (Tier 3, #112 lynchpin) =====
//
// The schema-validated question bank that the study-guide surfaces query via
// getCollection('questions') — /practice-exam (#112) + the auto-derived
// objective-map (#117) in this increment; #110/#113/#114/#116 downstream.
//
// SHAPE: a FLAT ENVELOPE z.object (NOT a top-level z.discriminatedUnion).
// Astro's content layer augments a collection schema with ZodObject methods
// (image() injection, id/slug merge), so the top-level schema must be a plain
// object — like every other schema in this file. `type` discriminates; the
// per-type invariants live in refineQuestion(), attached via .superRefine AT
// REGISTRATION (schemas-entry.ts) so this exported base stays a bare,
// .extend()-able ZodObject (consumers + Astro can extend it).
//
// Stem + rationale live in the MDX BODY (render(entry).Content), NOT in
// frontmatter — same body-render contract as chapters; a <Rationale> body
// marker lets #114's appendix hoist rationales later. `domain` is validated
// for membership at the route/build layer (assertKnownDomain, lib/exam-domains)
// — NOT here — because the per-book examDomains registry isn't visible when
// this schema is constructed (same constraint that put siblingBooks validation
// in lib/book-link.ts).

export const questionTypes = ['mcq', 'free', 'cloze'] as const;
//   mcq   — multiple choice, exactly one correct option (renders in v1)
//   free  — free-response, prose model answer (renders in v1)
//   cloze — fill-in-the-blank (RESERVED; schema-accepted, render-deferred to a
//           later increment so books can author ahead without a migration)

export const bloomLevels = [
  'remember',
  'understand',
  'apply',
  'analyze',
  'evaluate',
  'create',
] as const;

// Reuse the Practice.astro difficulty scale (1–4) verbatim for consistency.
export const questionDifficulties = ['1', '2', '3', '4'] as const;

// One MCQ option. `correct` defaults false; exactly one must be true (enforced
// in refineQuestion). `.strict()` so a misspelled option key fails loud rather
// than being silently dropped.
const mcqOptionObject = z
  .object({
    id: z.string().min(1), // stable per-option key (e.g. 'a') — anchors + future scoring
    correct: z.boolean().default(false),
    text: z.string().optional(), // short option prose inline; long ones via body
  })
  .strict();

export const questionSchema = z
  .object({
    // ----- identity -----
    id: z.string().min(1), // EXPLICIT cross-ref key (#114 appendix / #116 cards); distinct from file-derived entry.id
    type: z.enum(questionTypes),
    // ----- placement (every surface keys on these) -----
    chapter: z.union([z.number().int().min(0).max(99), z.string()]), // number OR academic-style string
    part: z.union([z.number().int().min(0).max(20), z.string()]).optional(),
    domain: z.string().min(1), // value validated at route/build (assertKnownDomain), NOT here
    // ----- pedagogy metadata (used-when-present) -----
    bloom_level: z.enum(bloomLevels).optional(), // #112/#113/#116
    objective_id: z.string().min(1).optional(), // #117 objective-map rows + #116 cards
    difficulty: z.enum(questionDifficulties).optional(), // #112 blueprint, #113 routing
    // ----- type-specific payloads (validated per-type in refineQuestion) -----
    options: z.array(mcqOptionObject).optional(), // MCQ only
    answer: z.string().optional(), // free-response model answer (prose)
    // ----- lifecycle (mirrors chapter schemas) -----
    draft: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
  })
  .strict(); // typo'd frontmatter key fails the build (matches provenanceObject)

/**
 * Per-type invariants for a question. Attached as `.superRefine(refineQuestion)`
 * at collection-registration time (schemas-entry.ts) so `questionSchema` itself
 * stays a bare ZodObject Astro + consumers can `.extend()`. Exported so the unit
 * test can exercise the refined form directly.
 */
export function refineQuestion(
  q: z.infer<typeof questionSchema>,
  ctx: z.RefinementCtx,
): void {
  if (q.type === 'mcq') {
    if (!q.options || q.options.length < 2) {
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: `MCQ "${q.id}" needs ≥2 options (got ${q.options?.length ?? 0}).`,
      });
      return;
    }
    const correct = q.options.filter((o) => o.correct).length;
    if (correct !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: `MCQ "${q.id}" must have EXACTLY ONE option with correct: true (got ${correct}).`,
      });
    }
    const ids = q.options.map((o) => o.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: `MCQ "${q.id}" has duplicate option ids (${ids.join(', ')}).`,
      });
    }
  } else if (q.type === 'free') {
    if (q.options) {
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: `Free-response "${q.id}" must not define MCQ options.`,
      });
    }
    if (!q.answer || q.answer.trim() === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['answer'],
        message: `Free-response "${q.id}" needs an "answer" (model answer) for the appendix.`,
      });
    }
  }
  // cloze: reserved — schema-accepted, no invariants until its renderer ships.
}

export type Question = z.infer<typeof questionSchema>;
export type QuestionType = (typeof questionTypes)[number];
export type BloomLevel = (typeof bloomLevels)[number];
