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
  BookConfigOptions,
  BookSchemasOptions,
  BookScaffoldIntegrationOptions,
} from './types.js';
export { BOOK_PROFILES, BookConfigError, resolveProfile } from './types.js';
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
  sourcesSchema,
  changelogSchema,
  patternsSchema,
} from './schemas.js';
