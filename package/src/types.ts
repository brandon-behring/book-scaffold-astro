/**
 * Shared types for @brandon_m_behring/book-scaffold-astro.
 *
 * Public types referenced from PACKAGE_DESIGN.md §4 / §5 / §6. Kept in one
 * place so consumer IntelliSense surfaces a coherent API.
 *
 * v3.3.0: BookProfile is now derived from the profile registry
 * (src/profiles/index.ts) rather than hand-maintained — adding a profile
 * automatically extends the union.
 */
import type { AstroIntegration, AstroUserConfig } from 'astro';
import { BOOK_PROFILES, type BookProfile } from './profiles/index.js';
import type { RouteToggles } from './profile-kit.js';

// Re-export so the existing import paths
//   import type { BookProfile } from '@brandon_m_behring/book-scaffold-astro'
// keep working.
export type { BookProfile, RouteToggles };
export { BOOK_PROFILES };

/**
 * Options for `defineBookConfig`. See PACKAGE_DESIGN.md §4.
 *
 * Note on the index signature: `AstroUserConfig` carries generic parameters
 * (`Locales`, `SessionDriverName`, fonts) that can't be threaded cleanly
 * through a wrapper. Instead we type the package-specific fields strictly
 * and allow arbitrary AstroUserConfig keys via the index signature.
 */
export interface BookConfigOptions {
  /** Required. Book's deployed origin (sitemap, canonical, Pagefind). */
  site: string;
  /**
   * Optional. Falls back to `process.env.BOOK_PROFILE`, then `.env`, then
   * `'minimal'`. Explicit param always wins.
   */
  profile?: BookProfile;
  /**
   * Optional per-route override of the profile's defaults. Use to disable
   * an auto-injected route (e.g. multi-book consumer that ships its own
   * `[book]/[chapter]` routing instead of the flat `/chapters` listing),
   * or to enable a route the profile turns off by default.
   *
   *   defineBookConfig({ routes: { chapters: false, convergence: false } })
   *
   * Closes #3 (v3.3.0).
   */
  routes?: Partial<RouteToggles>;
  /**
   * Optional explicit path to the consumer's MDX-components map (relative
   * to project root). When omitted, the toolkit auto-detects one of
   *   src/mdx-components.ts
   *   src/mdx-components.js
   *   src/mdx-components.mjs
   * Auto-injected routes (`/print`, future `/pdf`, `/epub`) import the
   * default export of that file via a Vite virtual module so consumer
   * components render consistently across scaffold-shipped pages.
   *
   * Closes #2 (v3.3.0). See LATEX_TO_MDX_MAPPING.md for the conventional
   * shape and the defineMdxComponents helper.
   */
  mdxComponentsModule?: string;
  /** Optional. Appended to the package-provided integration list. */
  extraIntegrations?: AstroIntegration[];
  /**
   * Optional. CSS basenames to inject in addition to the profile-resolved
   * set. Cross-profile escape hatch (e.g. an academic book using
   * `<Convergence>`). Example: `['convergence.css']`.
   */
  extraStyles?: string[];
  /** Optional. Spread-merged into the package-provided markdown config. */
  markdown?: AstroUserConfig['markdown'];
  /** Escape hatch for any other AstroUserConfig field. */
  [key: string]: unknown;
}

/** Options for `defineBookSchemas`. See PACKAGE_DESIGN.md §5. */
export interface BookSchemasOptions {
  profile?: BookProfile;
  /** Defaults to `'./src/content/chapters'`. */
  chaptersBase?: string;
}

/** Options for the internal `bookScaffoldIntegration`. See PACKAGE_DESIGN.md §6. */
export interface BookScaffoldIntegrationOptions {
  profile: BookProfile;
  /** Per-route override; merged into the profile's defaults. */
  routes?: Partial<RouteToggles>;
  /**
   * Optional explicit path to the consumer's mdx-components file (relative
   * to consumer root). When omitted, the Integration auto-detects
   * `src/mdx-components.{ts,js,mjs}` via the resolver. Final resolution
   * happens inside the `astro:config:setup` hook where consumer root is
   * known.
   */
  mdxComponentsModule?: string;
  extraStyles?: string[];
}

/** Raised when the resolved profile is not one of `BOOK_PROFILES`. */
export class BookConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BookConfigError';
  }
}

import { existsSync, readFileSync } from 'node:fs';

/**
 * Best-effort .env reader. Astro's Node-context config loading (the
 * astro.config.mjs file) doesn't auto-populate process.env from .env —
 * Vite handles it client-side via import.meta.env, but server-side stays
 * empty. This tiny parser handles the BOOK_PROFILE case so consumers
 * who put `BOOK_PROFILE=…` in .env get it picked up without needing
 * `node --env-file=.env` or dotenv-cli.
 */
function readEnvFile(path = '.env'): Record<string, string> {
  try {
    if (!existsSync(path)) return {};
    const out: Record<string, string> = {};
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      let val = m[2] ?? '';
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      out[m[1]!] = val;
    }
    return out;
  } catch {
    return {};
  }
}

/** Resolve profile from explicit param → process.env → .env → default. Throws on invalid. */
export function resolveProfile(explicit?: BookProfile): BookProfile {
  let candidate: string | undefined = explicit ?? process.env.BOOK_PROFILE;
  let source: 'param' | 'env' | 'dotenv' | 'default' = 'default';
  if (explicit) source = 'param';
  else if (process.env.BOOK_PROFILE) source = 'env';

  if (!candidate) {
    const fromFile = readEnvFile().BOOK_PROFILE;
    if (fromFile) {
      candidate = fromFile;
      source = 'dotenv';
    }
  }

  candidate = candidate ?? 'minimal';

  if (!BOOK_PROFILES.includes(candidate as BookProfile)) {
    throw new BookConfigError(
      `profile must be one of ${BOOK_PROFILES.join(' | ')} (got ${JSON.stringify(candidate)})`,
    );
  }
  if (source === 'default') {
    // eslint-disable-next-line no-console
    console.warn("book-scaffold-astro: BOOK_PROFILE not set; falling back to 'minimal'.");
  }
  return candidate as BookProfile;
}
