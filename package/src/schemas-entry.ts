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
import { existsSync, readFileSync } from 'node:fs';
import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';

/**
 * v4.1.0 (#60): detect whether a YAML file holds at least one entry.
 *
 * `sources/manifest.yaml` is registered as a content collection via Astro's
 * `file()` loader. If the file exists but parses to an empty list (valid
 * pre-bibliography state — a book in early Phase 1 has no citations yet),
 * Astro's loader emits a noisy WARN that consumers learn to ignore — exactly
 * the wrong calibration, since a *malformed* manifest deserves a real warning.
 *
 * Strategy: skip registering the collection when the manifest is empty.
 * Astro never sees the empty file → no spurious WARN. Genuine emptiness is
 * silent (the consumer's bibliography isn't started yet); malformed YAML
 * still trips Astro's loader and produces a real ERROR (preserved behavior).
 *
 * Definition of "empty": after stripping `#`-comment lines and whitespace,
 * the remaining content is either empty or `[]`. Conservative — anything
 * with structure (even a single placeholder entry) registers normally.
 */
function isYamlEmpty(path: string): boolean {
  try {
    const raw = readFileSync(path, 'utf8');
    const stripped = raw
      .split(/\r?\n/)
      .map((line) => line.replace(/#.*$/, '').trim())
      .filter((line) => line.length > 0)
      .join('');
    return stripped === '' || stripped === '[]';
  } catch {
    // If we can't read it, fall back to "not empty" so the loader can
    // surface its own error if appropriate.
    return false;
  }
}

import type { BookSchemasOptions } from './types.js';
import { resolvePreset } from './types.js';
import { assertBookCorpus } from './lib/corpus.js';
import {
  academicChapterSchema,
  toolsChapterSchema,
  minimalChapterSchema,
  courseNotesChapterSchema,
  researchPortfolioChapterSchema,
  sourcesSchema,
  changelogSchema,
  patternsSchema,
  refinedQuestionSchema,
  glossarySchema,
} from './schemas.js';

/**
 * v3.4.0 (closes #7): consumer-facing helper to define a `frontmatter`
 * content collection that the scaffold's auto-injected
 * `/frontmatter/[slug]` route can render.
 *
 * Usage in consumer's content.config.ts:
 *
 *   import { defineBookSchemas, frontmatterCollection } from
 *     '@brandon_m_behring/book-scaffold-astro/schemas';
 *   import { z } from 'astro:content';
 *
 *   export const { collections } = {
 *     collections: {
 *       ...defineBookSchemas().collections,
 *       frontmatter: frontmatterCollection(z.object({
 *         slug: z.string(),
 *         title: z.string(),
 *         order: z.number(),
 *         description: z.string().optional(),
 *       })),
 *     },
 *   };
 *
 * Then enable the route via `defineBookConfig({ routes: { frontmatter: true } })`
 * and drop MDX files under `src/content/frontmatter/`. The scaffold-injected
 * route renders each entry with the consumer's mdx-components in scope (issue #2
 * plumbing applies).
 *
 * Default loader: `**\/*.{md,mdx}` under `./src/content/frontmatter` (excluding
 * underscore-prefixed files). Override `base` via the second arg.
 */
export function frontmatterCollection(
  schema: Parameters<typeof defineCollection>[0]['schema'],
  base = './src/content/frontmatter',
) {
  return defineCollection({
    loader: glob({
      pattern: ['**/*.{md,mdx}', '!**/_*'],
      base,
    }),
    schema,
  });
}

/**
 * Returns the package's default content collections. Closed shape per Q5;
 * consumer extends via object spread and Zod `.extend()` (see PACKAGE_DESIGN.md §5).
 */
export function defineBookSchemas(opts: BookSchemasOptions = {}) {
  // v5.0.0 (#80): a corpus manifest is the one preset/identity source shared
  // with Astro config. Single-book callers keep the existing resolver path.
  const corpus = opts.corpus;
  if (corpus !== undefined) assertBookCorpus(corpus);
  const explicitProfile = opts.preset ?? opts.profile;
  if (corpus && explicitProfile !== undefined && explicitProfile !== corpus.preset) {
    throw new Error(
      `defineBookSchemas preset ${JSON.stringify(explicitProfile)} does not match ` +
        `corpus preset ${JSON.stringify(corpus.preset)}.`,
    );
  }
  const profile = corpus?.preset ?? resolvePreset(opts.preset, opts.profile);
  const chaptersBase = opts.chaptersBase ?? (corpus ? './src/content' : './src/content/chapters');

  // v3.3.0: schemas are owned by per-profile modules under src/profiles/,
  // re-exported via schemas.ts. Schema dispatch lives here (rather than
  // pulling PROFILES[profile].schema) because tsup's DTS bundler + Zod v4's
  // dual CJS/ESM types don't play well when the registry's value-typed
  // object flows through this entry's .d.ts emission. Adding a new profile
  // = add a new branch here AND extend src/profiles/index.ts.
  const schemaForProfile =
    profile === 'academic' ? academicChapterSchema
    : profile === 'course-notes' ? courseNotesChapterSchema
    : profile === 'research-portfolio' ? researchPortfolioChapterSchema
    : profile === 'minimal' ? minimalChapterSchema
    : toolsChapterSchema;

  const chapters = defineCollection({
    loader: glob({
      // Exclude underscore-prefixed files (standard "hidden" convention).
      pattern: corpus
        ? [
            ...corpus.books.map((book) => `${book.id}/**/*.{md,mdx}`),
            '!**/_*',
          ]
        : ['**/*.{md,mdx}', '!**/_*'],
      base: chaptersBase,
      ...(corpus
        ? {
            generateId: ({ entry, data }: { entry: string; data: Record<string, unknown> }) => {
              const normalized = entry.replaceAll('\\', '/');
              const [book, ...localParts] = normalized.split('/');
              if (!corpus.books.some((candidate) => candidate.id === book)) {
                throw new Error(
                  `Chapter ${JSON.stringify(entry)} is outside the registered corpus books.`,
                );
              }
              const fileSlug = localParts.join('/').replace(/\.(?:md|mdx)$/i, '');
              const slug = typeof data.slug === 'string' ? data.slug : fileSlug;
              if (
                slug.length === 0 ||
                slug.startsWith('/') ||
                slug.endsWith('/') ||
                slug.split('/').some((part) => part === '.' || part === '..' || part.length === 0)
              ) {
                throw new Error(
                  `Chapter ${JSON.stringify(entry)} resolved invalid corpus slug ${JSON.stringify(slug)}.`,
                );
              }
              return `${book}/${slug}`;
            },
          }
        : {}),
    }),
    schema: schemaForProfile,
  });

  // Tools-collateral collections: register only if the consumer has the
  // backing files. Academic-only books don't need them; without this guard
  // Astro's file-loader logs noisy "File not found" errors at content sync.
  const collections: Record<string, ReturnType<typeof defineCollection>> = {
    chapters,
  };

  // v4.1.0 (#60): also skip registration when manifest is empty to suppress
  // the misleading "No items found" WARN that fires for valid pre-bibliography
  // state. See isYamlEmpty() docstring above.
  if (existsSync('./sources/manifest.yaml') && !isYamlEmpty('./sources/manifest.yaml')) {
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

  // v4.17.0 (Tier 3, #112): study-guide `questions` collection. Registered only
  // when the consumer has a src/content/questions/ directory (same existsSync
  // gate as the tools-collateral collections above) so books that never adopt
  // the study-guide don't see a "collection does not exist" content-sync error.
  //
  // refinedQuestionSchema is `questionSchema.superRefine(refineQuestion)`,
  // composed in schemas.ts. The bare `questionSchema` stays a ZodObject Astro
  // (image()/id augmentation) and consumers (.extend()) can use; this canonical
  // composed form carries the per-type invariants.
  if (existsSync('./src/content/questions')) {
    collections.questions = defineCollection({
      loader: glob({
        pattern: ['**/*.{md,mdx}', '!**/_*'],
        base: './src/content/questions',
      }),
      schema: refinedQuestionSchema,
    });
  }

  // v4.19.0 (#115): study-guide `glossary` collection — searchable key-terms.
  // Same existsSync gate as questions: registered only when the consumer has a
  // src/content/glossary/ directory, so books that don't use it see no error.
  if (existsSync('./src/content/glossary')) {
    collections.glossary = defineCollection({
      loader: glob({
        pattern: ['**/*.{md,mdx}', '!**/_*'],
        base: './src/content/glossary',
      }),
      schema: glossarySchema,
    });
  }

  return { collections };
}
