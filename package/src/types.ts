/**
 * Shared types for @brandon_m_behring/book-scaffold-astro.
 *
 * Public types referenced from PACKAGE_DESIGN.md §4 / §5 / §6. Kept in
 * one place so consumer IntelliSense surfaces a coherent API.
 */
import type { AstroIntegration, AstroUserConfig } from 'astro';

export type BookProfile = 'academic' | 'tools' | 'minimal';

export const BOOK_PROFILES = ['academic', 'tools', 'minimal'] as const;

/**
 * Options for `defineBookConfig`. See PACKAGE_DESIGN.md §4.
 *
 * Note on the index signature: `AstroUserConfig` carries generic
 * parameters (`Locales`, `SessionDriverName`, fonts) that can't be
 * threaded cleanly through a wrapper. Instead we type the package-
 * specific fields strictly and allow arbitrary AstroUserConfig keys
 * via the index signature — consumer types will lint clean but lose
 * full IDE autocomplete on non-package fields. Acceptable trade.
 */
export interface BookConfigOptions {
  /** Required. Book's deployed origin (sitemap, canonical, Pagefind). */
  site: string;
  /**
   * Optional. Falls back to `process.env.BOOK_PROFILE`, then `'minimal'`.
   * Explicit param always wins over env.
   */
  profile?: BookProfile;
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
  extraStyles?: string[];
}

/** Raised when the resolved profile is not one of `BOOK_PROFILES`. */
export class BookConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BookConfigError';
  }
}

/** Resolve profile from explicit param → env → default. Throws on invalid. */
export function resolveProfile(explicit?: BookProfile): BookProfile {
  const candidate = explicit ?? process.env.BOOK_PROFILE ?? 'minimal';
  if (!BOOK_PROFILES.includes(candidate as BookProfile)) {
    throw new BookConfigError(
      `profile must be one of ${BOOK_PROFILES.join(' | ')} (got ${JSON.stringify(candidate)})`,
    );
  }
  if (!explicit && !process.env.BOOK_PROFILE) {
    // eslint-disable-next-line no-console
    console.warn("book-scaffold-astro: BOOK_PROFILE not set; falling back to 'minimal'.");
  }
  return candidate as BookProfile;
}
