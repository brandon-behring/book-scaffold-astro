import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfigFromFile } from 'vite';

export const DEFAULT_TOOLING_CONFIG = Object.freeze({
  preset: null,
  numberStyle: 'shared',
  siblingBooks: Object.freeze({}),
  chapterRoute: '/chapters/:id/',
  bookField: 'book',
  integrationFound: false,
});

const ASTRO_CONFIG_NAMES = [
  'astro.config.mjs',
  'astro.config.ts',
  'astro.config.js',
  'astro.config.cjs',
];
const PRESETS = ['academic', 'tools', 'minimal', 'course-notes', 'research-portfolio'];

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
  const integration = integrations.find((candidate) => candidate?.name === 'book-scaffold-astro');
  if (!integration) return { ...DEFAULT_TOOLING_CONFIG };

  const metadata = integration.__bookScaffoldResolvedConfig;
  if (!metadata) {
    // A config can contain an older scaffold integration with no metadata.
    // Preserve the historical numbering default rather than treating upgrade
    // sequencing as a config error.
    return { ...DEFAULT_TOOLING_CONFIG, integrationFound: true };
  }

  const numberStyle = metadata.numberStyle ?? 'shared';
  assertNumberStyle(numberStyle, configPath);
  assertPreset(metadata.preset, configPath);
  return {
    preset: metadata.preset ?? null,
    numberStyle,
    siblingBooks: resolveSiblingBooks(metadata.siblingBooks, configPath),
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
    integrationFound: true,
  };
}
