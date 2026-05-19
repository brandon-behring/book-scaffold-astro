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

// v3.4.0 (closes #9): `preset` is the forward-looking canonical name; `profile`
// stays as a backward-compat alias forever. Same union type, same set of values
// — the rename is purely vocabulary, positioning the toolkit for future
// composable-preset features (e.g. issue #6 research-portfolio).
export type BookPreset = BookProfile;
export const BOOK_PRESETS = BOOK_PROFILES;

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
   * Optional. Canonical forward-looking name (v3.4.0+). Resolution order:
   * `preset` > `profile` > `BOOK_PRESET` env > `BOOK_PROFILE` env > `.env`
   * `BOOK_PRESET` > `.env` `BOOK_PROFILE` > `'minimal'`.
   *
   * Closes #9: existing consumers using `profile:` keep working; new docs
   * + recipes recommend `preset:`. Same value set.
   */
  preset?: BookPreset;
  /** Backward-compat alias for `preset`. */
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
  /** Canonical name (v3.4.0+). */
  preset?: BookPreset;
  /** Backward-compat alias for `preset`. */
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

/**
 * Resolve preset from explicit args → env → .env → default. Throws on invalid.
 *
 * v3.4.0 (closes #9): canonical resolver. Accepts both `preset` and `profile`
 * (back-compat) explicit args; reads both `BOOK_PRESET` (preferred) and
 * `BOOK_PROFILE` (alias) env vars; same for .env file lookups.
 *
 * Resolution order:
 *   1. explicitPreset (from defineBookConfig({ preset: ... }))
 *   2. explicitProfile (from defineBookConfig({ profile: ... }))
 *   3. process.env.BOOK_PRESET
 *   4. process.env.BOOK_PROFILE
 *   5. .env BOOK_PRESET
 *   6. .env BOOK_PROFILE
 *   7. 'minimal' (with console.warn)
 */
export function resolvePreset(
  explicitPreset?: BookPreset,
  explicitProfile?: BookProfile,
): BookPreset {
  let candidate: string | undefined =
    explicitPreset ?? explicitProfile ?? process.env.BOOK_PRESET ?? process.env.BOOK_PROFILE;
  let source: 'param' | 'env' | 'dotenv' | 'default' = 'default';
  if (explicitPreset || explicitProfile) source = 'param';
  else if (process.env.BOOK_PRESET || process.env.BOOK_PROFILE) source = 'env';

  if (!candidate) {
    const env = readEnvFile();
    const fromFile = env.BOOK_PRESET ?? env.BOOK_PROFILE;
    if (fromFile) {
      candidate = fromFile;
      source = 'dotenv';
    }
  }

  candidate = candidate ?? 'minimal';

  if (!BOOK_PRESETS.includes(candidate as BookPreset)) {
    throw new BookConfigError(
      `preset must be one of ${BOOK_PRESETS.join(' | ')} (got ${JSON.stringify(candidate)})`,
    );
  }
  if (source === 'default') {
    // eslint-disable-next-line no-console
    console.warn("book-scaffold-astro: BOOK_PRESET not set; falling back to 'minimal'.");
  }
  return candidate as BookPreset;
}

/**
 * Backward-compat alias. New code should use `resolvePreset()`.
 * v3.4.0+: kept for any consumer that imported `resolveProfile` directly
 * (none we know of, but the export was public in the v3.x main entry).
 */
export function resolveProfile(explicit?: BookProfile): BookProfile {
  return resolvePreset(undefined, explicit);
}
