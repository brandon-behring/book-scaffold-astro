import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfigFromFile } from 'vite';

export const DEFAULT_TOOLING_CONFIG = Object.freeze({
  preset: null,
  numberStyle: 'shared',
  siblingBooks: Object.freeze({}),
  corpus: null,
  chapterRoute: '/chapters/:id/',
  bookField: 'book',
  apparatusRoute: '/:route/',
  apparatusRoutes: Object.freeze([]),
  enabledRoutes: Object.freeze([]),
  frontmatterRoute: '/frontmatter/[slug]',
  base: '/',
  integrationFound: false,
});

const ASTRO_CONFIG_NAMES = [
  'astro.config.mjs',
  'astro.config.ts',
  'astro.config.js',
  'astro.config.cjs',
];
const PRESETS = ['academic', 'tools', 'minimal', 'course-notes', 'research-portfolio'];
const APPARATUS_ROUTES = [
  'references',
  'print',
  'convergence',
  'tips',
  'exercises',
  'glossary',
  'practice-exam',
  'flashcards',
  'answers',
];
const ROUTE_TOGGLES = [
  'references',
  'search',
  'print',
  'chapters',
  'convergence',
  'frontmatter',
  'tips',
  'exercises',
  'practiceExam',
  'glossary',
  'answers',
  'flashcards',
  'landing',
];

function findAstroConfig(projectRoot) {
  for (const name of ASTRO_CONFIG_NAMES) {
    const path = resolve(projectRoot, name);
    if (existsSync(path)) return path;
  }
  return null;
}

function assertNumberStyle(value, configPath) {
  if (value !== 'shared' && value !== 'per-kind') {
    throw new Error(
      `book-scaffold tooling: ${configPath} resolved invalid numberStyle ` +
        `${JSON.stringify(value)}; expected shared | per-kind.`,
    );
  }
}

function assertPreset(value, configPath) {
  if (value != null && !PRESETS.includes(value)) {
    throw new Error(
      `book-scaffold tooling: ${configPath} resolved invalid preset ` +
        `${JSON.stringify(value)}; expected ${PRESETS.join(' | ')}.`,
    );
  }
}

function resolveNonEmptyString(value, fallback, field, configPath) {
  if (value == null) return fallback;
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(
      `book-scaffold tooling: ${configPath} resolved invalid ${field} ` +
        `${JSON.stringify(value)}; expected a non-empty string.`,
    );
  }
  return value;
}

function resolveBase(value, configPath) {
  if (value == null || value === '') return '/';
  if (typeof value !== 'string') {
    throw new Error(
      `book-scaffold tooling: ${configPath} resolved invalid Astro base ` +
        `${JSON.stringify(value)}; expected a string.`,
    );
  }
  return value;
}

function resolveSiblingBooks(value, configPath) {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(
      `book-scaffold tooling: ${configPath} resolved invalid siblingBooks ` +
        `${JSON.stringify(value)}; expected an object registry.`,
    );
  }

  const resolved = [];
  for (const [book, entry] of Object.entries(value)) {
    if (typeof entry === 'string') {
      if (entry.length === 0) {
        throw new Error(
          `book-scaffold tooling: ${configPath} resolved invalid siblingBooks.${book}; ` +
            'URL strings must not be empty.',
        );
      }
      resolved.push([book, entry]);
      continue;
    }

    if (
      entry === null ||
      typeof entry !== 'object' ||
      Array.isArray(entry) ||
      typeof entry.url !== 'string' ||
      entry.url.length === 0 ||
      (entry.labels !== undefined &&
        (typeof entry.labels !== 'string' || entry.labels.length === 0))
    ) {
      throw new Error(
        `book-scaffold tooling: ${configPath} resolved invalid siblingBooks.${book}; ` +
          'expected a URL string or { url: string, labels?: string }.',
      );
    }
    resolved.push([
      book,
      {
        url: entry.url,
        ...(entry.labels === undefined ? {} : { labels: entry.labels }),
      },
    ]);
  }
  return Object.fromEntries(resolved);
}

function resolveApparatusRoutes(value, configPath) {
  if (value == null) return [];
  if (
    !Array.isArray(value) ||
    value.some((route) => typeof route !== 'string' || !APPARATUS_ROUTES.includes(route)) ||
    new Set(value).size !== value.length
  ) {
    throw new Error(
      `book-scaffold tooling: ${configPath} resolved invalid apparatusRoutes; ` +
        `expected unique values from ${APPARATUS_ROUTES.join(' | ')}.`,
    );
  }
  return Object.freeze([...value]);
}

function resolveEnabledRoutes(value, configPath) {
  if (value == null) return [];
  if (
    !Array.isArray(value) ||
    value.some((route) => typeof route !== 'string' || !ROUTE_TOGGLES.includes(route)) ||
    new Set(value).size !== value.length
  ) {
    throw new Error(
      `book-scaffold tooling: ${configPath} resolved invalid enabledRoutes; ` +
        `expected unique values from ${ROUTE_TOGGLES.join(' | ')}.`,
    );
  }
  return Object.freeze([...value]);
}

function resolveCorpus(value, preset, configPath) {
  if (value == null) return null;
  if (
    typeof value !== 'object' ||
    Array.isArray(value) ||
    value.__bookCorpusVersion !== 1 ||
    !PRESETS.includes(value.preset) ||
    !Array.isArray(value.books) ||
    value.books.length === 0
  ) {
    throw new Error(
      `book-scaffold tooling: ${configPath} resolved invalid corpus metadata; ` +
        'expected defineBookCorpus() v1 output.',
    );
  }
  if (preset != null && value.preset !== preset) {
    throw new Error(
      `book-scaffold tooling: ${configPath} resolved corpus preset ` +
        `${JSON.stringify(value.preset)} but integration preset is ${JSON.stringify(preset)}.`,
    );
  }

  const seen = new Set();
  const books = value.books.map((book, index) => {
    if (
      book === null ||
      typeof book !== 'object' ||
      Array.isArray(book) ||
      typeof book.id !== 'string' ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(book.id) ||
      typeof book.title !== 'string' ||
      book.title.trim().length === 0
    ) {
      throw new Error(
        `book-scaffold tooling: ${configPath} resolved invalid corpus.books[${index}].`,
      );
    }
    if (seen.has(book.id)) {
      throw new Error(
        `book-scaffold tooling: ${configPath} resolved duplicate corpus book ` +
          `${JSON.stringify(book.id)}.`,
      );
    }
    seen.add(book.id);
    const apparatus = book.apparatus === undefined
      ? undefined
      : resolveApparatusRoutes(book.apparatus, configPath);
    return Object.freeze({
      ...book,
      ...(apparatus === undefined ? {} : { apparatus }),
    });
  });

  return Object.freeze({
    __bookCorpusVersion: 1,
    preset: value.preset,
    books: Object.freeze(books),
  });
}

/**
 * Evaluate the consumer's actual Astro config and read the scaffold
 * integration's internal resolved metadata. Absence of a config/integration is
 * a supported legacy shape and preserves shared numbering. Evaluation errors
 * are deliberately not swallowed: tooling must not silently use wrong config.
 */
export async function loadResolvedBookConfig(projectRoot = process.cwd()) {
  const configPath = findAstroConfig(projectRoot);
  if (!configPath) return { ...DEFAULT_TOOLING_CONFIG };

  let loaded;
  try {
    loaded = await loadConfigFromFile(
      { command: 'build', mode: 'production', isSsrBuild: true, isPreview: false },
      configPath,
      projectRoot,
      'silent',
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`book-scaffold tooling: failed to evaluate ${configPath}: ${detail}`, {
      cause: error,
    });
  }

  if (!loaded) {
    throw new Error(`book-scaffold tooling: Vite did not return config for ${configPath}.`);
  }

  const integrations = Array.isArray(loaded.config?.integrations)
    ? loaded.config.integrations.flat(Infinity)
    : [];
  const base = resolveBase(loaded.config?.base, configPath);
  const integration = integrations.find((candidate) => candidate?.name === 'book-scaffold-astro');
  if (!integration) return { ...DEFAULT_TOOLING_CONFIG, base };

  const metadata = integration.__bookScaffoldResolvedConfig;
  if (!metadata) {
    // A config can contain an older scaffold integration with no metadata.
    // Preserve the historical numbering default rather than treating upgrade
    // sequencing as a config error.
    return { ...DEFAULT_TOOLING_CONFIG, base, integrationFound: true };
  }

  const numberStyle = metadata.numberStyle ?? 'shared';
  assertNumberStyle(numberStyle, configPath);
  assertPreset(metadata.preset, configPath);
  const preset = metadata.preset ?? null;
  return {
    preset,
    numberStyle,
    siblingBooks: resolveSiblingBooks(metadata.siblingBooks, configPath),
    corpus: resolveCorpus(metadata.corpus, preset, configPath),
    chapterRoute: resolveNonEmptyString(
      metadata.chapterRoute,
      DEFAULT_TOOLING_CONFIG.chapterRoute,
      'chapterRoute',
      configPath,
    ),
    bookField: resolveNonEmptyString(
      metadata.bookField,
      DEFAULT_TOOLING_CONFIG.bookField,
      'bookField',
      configPath,
    ),
    apparatusRoute: resolveNonEmptyString(
      metadata.apparatusRoute,
      DEFAULT_TOOLING_CONFIG.apparatusRoute,
      'apparatusRoute',
      configPath,
    ),
    apparatusRoutes: resolveApparatusRoutes(metadata.apparatusRoutes, configPath),
    enabledRoutes: resolveEnabledRoutes(metadata.enabledRoutes, configPath),
    frontmatterRoute: resolveNonEmptyString(
      metadata.frontmatterRoute,
      DEFAULT_TOOLING_CONFIG.frontmatterRoute,
      'frontmatterRoute',
      configPath,
    ),
    base,
    integrationFound: true,
  };
}
