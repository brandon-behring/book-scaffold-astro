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
 */
import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';

import type { BookSchemasOptions } from './types.js';
import { resolveProfile } from './types.js';
import {
  academicChapterSchema,
  toolsChapterSchema,
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

  const chapters = defineCollection({
    loader: glob({
      // Exclude underscore-prefixed files (standard "hidden" convention).
      pattern: ['**/*.{md,mdx}', '!**/_*'],
      base: chaptersBase,
    }),
    schema: profile === 'academic' ? academicChapterSchema : toolsChapterSchema,
  });

  const sources = defineCollection({
    loader: file('sources/manifest.yaml'),
    schema: sourcesSchema,
  });

  const changelog = defineCollection({
    loader: glob({ pattern: '*.yaml', base: './changelog/tools' }),
    schema: changelogSchema,
  });

  const patterns = defineCollection({
    loader: file('changelog/patterns.yaml'),
    schema: patternsSchema,
  });

  return {
    collections: { chapters, sources, changelog, patterns },
  };
}
