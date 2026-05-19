/**
 * @brandon_m_behring/book-scaffold-astro — public entry.
 *
 * See PACKAGE_DESIGN.md for the full API contract. Stable surface:
 *   - defineBookConfig({ site, profile?, extraIntegrations?, extraStyles?, markdown? })
 *   - defineBookSchemas({ profile?, chaptersBase? })
 *   - bookScaffoldIntegration (used internally; exposed for advanced override)
 *   - BookProfile, BOOK_PROFILES, BookConfigError, resolveProfile
 *   - schema enum constants (academicParts, chapterStatus, toolSlugs, …)
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

// ----- Public re-exports -----

export { defineBookConfig } from './config.js';
export { bookScaffoldIntegration } from './integration.js';
export type {
  BookProfile,
  BookConfigOptions,
  BookSchemasOptions,
  BookScaffoldIntegrationOptions,
} from './types.js';
export { BOOK_PROFILES, BookConfigError, resolveProfile } from './types.js';
export {
  academicParts,
  chapterStatus,
  toolSlugs,
  volatilityLevels,
  sourceTiers,
  changeKinds,
  patternCategories,
} from './schemas.js';

// ----- defineBookSchemas (closed surface — Q5) -----

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
