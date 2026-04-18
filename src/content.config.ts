/**
 * src/content.config.ts — Content Collections schema (Astro 6 Content Layer).
 *
 * Defines the shape that every chapter's frontmatter must satisfy. Astro
 * validates at build time; any chapter with invalid frontmatter fails the
 * build with a precise error pointing to the offending file.
 *
 * Frontmatter semantics:
 *   title           — chapter title as displayed
 *   part            — which book Part (1–5)
 *   chapter         — chapter number within the part (for ordering)
 *   volatility      — how likely the claims in this chapter are to date.
 *                     Drives freshness stamps and review cadence.
 *   tools_compared  — which tools' behavior is analyzed. Drives the Tool
 *                     Filter interactive feature (commit Stage 3).
 *   last_verified   — ISO date when this chapter's claims were last audited
 *                     against current tool docs. Surface stale chapters.
 *   sources         — slugs from sources/manifest.yaml. Resolved at build
 *                     time by the <Citation> component (commit 10) to render
 *                     tier badges + Perma.cc links.
 *   description     — optional meta description for search/social.
 *   draft           — if true, chapter is hidden from nav + search.
 *   updated         — optional ISO date of the last structural revision
 *                     (separate from last_verified, which is about claim
 *                     accuracy).
 */
import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

const toolSlugs = [
  'claude-code',
  'gemini-cli',
  'codex-cli',
  'cross-tool',
] as const;

const volatilityLevels = [
  'stable-principle',     // durable idea, rare change
  'architectural-pattern', // changes on major tool versions
  'feature-surface',      // changes on minor versions; highest drift risk
] as const;

const sourceTiers = [
  'T1-official',      // vendor-official docs or release notes
  'T2-release-notes', // release blog / changelog
  'T3-practitioner',  // respected community writing
  'T4-conjecture',    // blog / tweet / unverified
] as const;

// ===== chapters =====
const chapters = defineCollection({
  loader: glob({
    pattern: '**/*.{md,mdx}',
    base: './src/content/chapters',
  }),
  schema: z.object({
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
  }),
});

// ===== sources =====
// One entry per cited source. The file loader reads sources/manifest.yaml
// and keys each entry by its `id` field. Accessed from components via
// `await getEntry('sources', slug)`.
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

// ===== changelog (per-tool release timelines) =====
// One entry per tool. The glob loader picks up changelog/tools/*.yaml;
// the shared registry changelog/patterns.yaml sits one level up so it
// isn't swept into this collection.
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
        pattern: z.string(),        // references patterns collection by id
        kind: z.enum(changeKinds),
        note: z.string().min(1),
        source_key: z.string().optional(),  // references sources collection by id
      })).default([]),
    })).default([]),
  }),
});

// ===== patterns (shared registry across tools) =====
// Names the agentic-coding patterns that one or more tools may adopt.
// Feeds the convergence/divergence dashboard in Stage 3.
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

// Re-export enum arrays so components and tests can import the same
// canonical lists without redefining them.
export {
  toolSlugs,
  volatilityLevels,
  sourceTiers,
  changeKinds,
  patternCategories,
};
