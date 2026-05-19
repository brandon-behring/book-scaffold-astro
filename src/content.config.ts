/**
 * src/content.config.ts — Content Collections schema (Astro 6 Content Layer).
 *
 * Profile-aware chapter schema dispatch via BOOK_PROFILE env var (Q4 locked).
 *
 *   BOOK_PROFILE=academic — 7-state status + week + part enum (5 academic parts) +
 *                           code_path / tests_path / notebook_path companion paths
 *   BOOK_PROFILE=tools    — volatility classes + T1-T4 source tiers + tools_compared
 *   BOOK_PROFILE=minimal  — falls back to tools schema (the v1 default; works for
 *                           generic books, just don't add 'volatility' etc. to your
 *                           frontmatter and Zod won't complain because fields
 *                           are required — minimal profile users should pick one
 *                           profile to commit to)
 *
 * Other collections (sources, changelog, patterns) are tools-profile data
 * but stay defined unconditionally — they read empty if the underlying
 * files are absent. ToolFilter / VersionSelector / convergence dashboard
 * render no-op under academic profile.
 *
 * Schema details:
 *   Academic profile fields (per post_transformers/guides/web reference):
 *     week           — week number in roadmap (1–N)
 *     part           — enum of academic parts
 *     title          — chapter title as displayed
 *     status         — internal 7-state taxonomy (docs/STATUS.md)
 *     roadmap_lines  — optional [start, end] line refs into roadmap.md
 *     code_path      — optional path to chapter's source code
 *     tests_path     — optional path to chapter's tests
 *     notebook_path  — optional path to Jupyter notebook companion
 *     description    — optional meta description
 *     draft          — hidden from nav + search if true
 *
 *   Tools profile fields (per book-template-astro reference):
 *     title, part, chapter, volatility, tools_compared, last_verified,
 *     sources, description, draft, updated
 */
import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

const profile = process.env.BOOK_PROFILE ?? 'minimal';

// ===== Shared tools-profile enums =====
const toolSlugs = [
  'claude-code',
  'gemini-cli',
  'codex-cli',
  'cross-tool',
] as const;

const volatilityLevels = [
  'stable-principle',
  'architectural-pattern',
  'feature-surface',
] as const;

const sourceTiers = [
  'T1-official',
  'T2-release-notes',
  'T3-practitioner',
  'T4-conjecture',
] as const;

// ===== Academic-profile enums =====
const academicParts = [
  'foundations',
  'ssm-core',
  'beyond-ssm',
  'integration',
  'synthesis',
] as const;

const chapterStatus = [
  'implemented',
  'chapter_only',
  'reading_only',
  'prose_only',
  'code_only',
  'scaffolded',
  'planned',
] as const;

// ===== Chapter schema — profile-dispatched =====
const academicChapterSchema = z.object({
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
});

const toolsChapterSchema = z.object({
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
});

const chapters = defineCollection({
  loader: glob({
    // Exclude underscore-prefixed files (e.g. _example-chapter.mdx) — the
    // standard "hidden" convention for content collections. Lets us keep
    // tools-profile example content in the scaffold without breaking
    // academic-profile builds.
    pattern: ['**/*.{md,mdx}', '!**/_*'],
    base: './src/content/chapters',
  }),
  schema: profile === 'academic' ? academicChapterSchema : toolsChapterSchema,
});

// ===== Tools-profile-only collections (always defined; empty under academic) =====
const sources = defineCollection({
  loader: file('sources/manifest.yaml'),
  schema: z.object({
    url: z.string().url(),
    title: z.string().min(1),
    author: z.string().optional(),
    publish_date: z.date().optional(),
    captured_at: z.date(),
    content_hash: z.string().regex(/^sha256:[a-f0-9]+$/).optional(),
    tier: z.enum(sourceTiers),
    tool: z.enum(toolSlugs),
    perma_cc: z.string().url().nullable().optional(),
    local_cache: z.string().nullable().optional(),
  }),
});

const changeKinds = ['added', 'removed', 'changed', 'deprecated'] as const;

const changelog = defineCollection({
  loader: glob({
    pattern: '*.yaml',
    base: './changelog/tools',
  }),
  schema: z.object({
    tool: z.enum(toolSlugs),
    versions: z.array(z.object({
      version: z.string().min(1),
      date: z.date(),
      changes: z.array(z.object({
        pattern: z.string(),
        kind: z.enum(changeKinds),
        note: z.string().min(1),
        source_key: z.string().optional(),
      })).default([]),
    })).default([]),
  }),
});

const patternCategories = [
  'safety',
  'scale',
  'context',
  'interaction',
  'extension',
  'other',
] as const;

const patterns = defineCollection({
  loader: file('changelog/patterns.yaml'),
  schema: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    category: z.enum(patternCategories).optional(),
    convergence_date: z.date().nullable().optional(),
  }),
});

export const collections = { chapters, sources, changelog, patterns };

// Re-export enum arrays for components and tests.
export {
  toolSlugs,
  volatilityLevels,
  sourceTiers,
  changeKinds,
  patternCategories,
  academicParts,
  chapterStatus,
};
