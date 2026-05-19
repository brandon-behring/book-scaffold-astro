/**
 * @brandon_m_behring/book-scaffold-astro/schemas — content-collection entry.
 *
 * This module imports `defineCollection` from the virtual `astro:content`
 * module, so it MUST be imported from a file that Astro processes through
 * Vite — i.e. the consumer's `src/content.config.ts`. Importing from the
 * main entry (`astro.config.mjs`, which Node loads directly) fails because
 * Node's ESM loader cannot resolve the `astro:` scheme.
 *
 * See PACKAGE_DESIGN.md §5. Schemas themselves live in ./schemas.ts and
 * use the real `astro/zod` module, so they can be safely re-exported from
 * the main entry.
 *
 * Tools-profile collateral collections (sources / changelog / patterns)
 * are registered only when their backing files exist on disk. This keeps
 * academic-profile consumers from seeing `File not found` errors for
 * collections they don't use.
 */
import { existsSync } from 'node:fs';
import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';

import type { BookSchemasOptions } from './types.js';
import { resolveProfile } from './types.js';
import {
  academicChapterSchema,
  toolsChapterSchema,
  minimalChapterSchema,
  courseNotesChapterSchema,
  sourcesSchema,
  changelogSchema,
  patternsSchema,
} from './schemas.js';

/**
 * Returns the package's default content collections. Closed shape per Q5;
 * consumer extends via object spread and Zod `.extend()` (see PACKAGE_DESIGN.md §5).
 */
export function defineBookSchemas(opts: BookSchemasOptions = {}) {
  const profile = resolveProfile(opts.profile);
  const chaptersBase = opts.chaptersBase ?? './src/content/chapters';

  // v3.3.0: schemas are owned by per-profile modules under src/profiles/,
  // re-exported via schemas.ts. Schema dispatch lives here (rather than
  // pulling PROFILES[profile].schema) because tsup's DTS bundler + Zod v4's
  // dual CJS/ESM types don't play well when the registry's value-typed
  // object flows through this entry's .d.ts emission. Adding a new profile
  // = add a new branch here AND extend src/profiles/index.ts.
  const schemaForProfile =
    profile === 'academic' ? academicChapterSchema
    : profile === 'course-notes' ? courseNotesChapterSchema
    : profile === 'minimal' ? minimalChapterSchema
    : toolsChapterSchema;

  const chapters = defineCollection({
    loader: glob({
      // Exclude underscore-prefixed files (standard "hidden" convention).
      pattern: ['**/*.{md,mdx}', '!**/_*'],
      base: chaptersBase,
    }),
    schema: schemaForProfile,
  });

  // Tools-collateral collections: register only if the consumer has the
  // backing files. Academic-only books don't need them; without this guard
  // Astro's file-loader logs noisy "File not found" errors at content sync.
  const collections: Record<string, ReturnType<typeof defineCollection>> = {
    chapters,
  };

  if (existsSync('./sources/manifest.yaml')) {
    collections.sources = defineCollection({
      loader: file('sources/manifest.yaml'),
      schema: sourcesSchema,
    });
  }

  if (existsSync('./changelog/tools')) {
    collections.changelog = defineCollection({
      loader: glob({ pattern: '*.yaml', base: './changelog/tools' }),
      schema: changelogSchema,
    });
  }

  if (existsSync('./changelog/patterns.yaml')) {
    collections.patterns = defineCollection({
      loader: file('changelog/patterns.yaml'),
      schema: patternsSchema,
    });
  }

  return { collections };
}
