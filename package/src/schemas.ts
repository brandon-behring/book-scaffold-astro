/**
 * Zod schemas + enum constants for book content collections.
 *
 * Imports `z` from `astro/zod` (a real module re-export) so schemas can
 * be constructed at package-load time outside an Astro runtime context.
 * `defineBookSchemas` in index.ts wraps these into Astro `defineCollection`
 * calls at the consumer's content-config load time.
 *
 * Schemas ported verbatim from v2.0 src/content.config.ts. See
 * PACKAGE_DESIGN.md §5 for the public reproduction.
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

// ===== Chapter schemas — profile-dispatched =====

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
});

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
