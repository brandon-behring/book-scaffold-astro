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
import type { Style, PartialRouteToggles } from './lib/define-style.js';

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

/** Theorem-family numbering strategy used by build-labels and validate. */
export type NumberStyle = 'shared' | 'per-kind';
export const NUMBER_STYLES = ['shared', 'per-kind'] as const satisfies readonly NumberStyle[];

/**
 * A sibling book with an optional vendored label index for cross-book
 * `<BookLink>` validation (#147).
 *
 * `url` is the deployed book base, including any path prefix. `labels` is a
 * path to that sibling's vendored `labels.json`, resolved from the consumer
 * project root by `book-scaffold validate`.
 */
export interface SiblingBookDescriptor {
  url: string;
  labels?: string;
}

/** Backward-compatible sibling-book registry entry. */
export type SiblingBookEntry = string | SiblingBookDescriptor;

/** Registry consumed by `<BookLink>` and the pre-flight validator. */
export type SiblingBooks = Record<string, SiblingBookEntry>;

/**
 * v4.26.2 (#149): book-level release state rendered by
 * `<PreReleaseBanner>` across every page.
 *
 * Style inheritance and explicit suppression were fixed in v4.26.3.
 */
export interface ReleaseStatusConfig {
  state: 'alpha' | 'beta' | 'rc' | 'locked';
  dismissAt?: string;
  message?: string;
}

/**
 * v4.27.0 (#188): build-time security-header customization.
 *
 * The integration emits a Cloudflare-compatible `dist/_headers` file by
 * default. Consumers that need a different CSP can replace that one header
 * while retaining the scaffold's other audited defaults.
 */
export interface SecurityHeadersConfig {
  contentSecurityPolicy?: string;
}

/**
 * v4.26.2 (#149): book-level release state rendered by
 * `<PreReleaseBanner>` across every page.
 *
 * Style inheritance and explicit suppression were fixed in v4.26.3.
 */
export interface ReleaseStatusConfig {
  state: 'alpha' | 'beta' | 'rc' | 'locked';
  dismissAt?: string;
  message?: string;
}

/**
 * Options for `defineBookConfig`. See PACKAGE_DESIGN.md §4.
 *
 * Note on the index signature: `AstroUserConfig` carries generic parameters
 * (`Locales`, `SessionDriverName`, fonts) that can't be threaded cleanly
 * through a wrapper. Instead we type the package-specific fields strictly
 * and allow arbitrary AstroUserConfig keys via the index signature.
 *
 * v4.0.0 (BREAKING): `preset` and `profile` fields removed — replaced by
 * the `styles: Style[]` composition (see `defineStyle` API). Existing v3
 * consumers receive an auto-suggested migration error at runtime pointing
 * at MIGRATION-v3-to-v4.md.
 */
export interface BookConfigOptions {
  /**
   * Optional. Book's deployed origin (sitemap, canonical, Pagefind).
   *
   * v4.0.0 (BREAKING): now OPTIONAL at the type level — a Style in the
   * `styles` chain can provide it (the `guides`-family pattern: shared
   * style sets the site, per-book config inherits). Runtime validation
   * still requires `site` to be set after style composition.
   */
  site?: string;
  /**
   * v4.0.0 (NEW): typed config bundles composed left-to-right. Earlier
   * styles set defaults; later styles override per the merge strategy
   * table (see `composeStyles` JSDoc + recipes/15-defining-styles.md).
   * Top-level `BookConfigOptions` fields beat any style's value.
   *
   * @example
   *   import { defineBookConfig, researchPortfolioStyle } from '@brandon_m_behring/book-scaffold-astro';
   *   import { guidesFamilyStyle } from '../shared/styles/guides-family';
   *   export default await defineBookConfig({
   *     styles: [researchPortfolioStyle, guidesFamilyStyle],
   *     site: 'https://foo.guides.example/',
   *   });
   */
  styles?: readonly Style[];
  /**
   * v4.27.0 (#175): theorem-family counter strategy. `shared` preserves the
   * amsthm-style sequence used through v4.26; `per-kind` gives theorem,
   * proposition, lemma, and each other theorem kind an independent sequence.
   * May also be supplied by a Style; top-level config wins.
   */
  numberStyle?: NumberStyle;
  /**
   * Optional per-route override of the composed profile's defaults. Use to
   * disable an auto-injected route (e.g. multi-book consumer that ships
   * its own `[book]/[chapter]` routing instead of the flat `/chapters`
   * listing), or to enable a route the profile turns off by default.
   *
   * v4.0.0: `routes.frontmatter` widened to support `{ enabled, prefix? }`
   * object form (closes #49) — sets the route URL prefix. `boolean` form
   * still accepted.
   *
   * Closes #3 (v3.3.0).
   */
  routes?: PartialRouteToggles;
  /**
   * v4.0.0 (#50): RESERVED — accepted and style-chain-merged, but currently
   * has NO runtime effect (#180). The wrangler.toml shape is decided once, at
   * scaffold time, by `create-book` from the profile name (academic/tools/
   * minimal → Workers; course-notes/research-portfolio → Pages); setting this
   * field changes nothing afterward. Wire-or-remove is a v5 decision.
   * @deprecated Inert in v4; remove this option before v5. Deployment shape
   * is chosen by create-book or by the consumer's own deployment files.
   */
  deploy?: 'pages' | 'workers';
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
  /**
   * Optional. Consumer-defined KaTeX macros, shallow-merged onto the
   * profile's defaults (`ssmMacros` for academic). Closes #22.
   *
   * Used to add domain-specific macros the scaffold doesn't ship by default
   * — e.g. causal-inference notation (`\ate`, `\propensity`), RL/optimal-
   * control notation, or any per-book extension. Strict KaTeX mode means
   * the build fails on unknown commands; this option is the supported way
   * to teach KaTeX about a consumer's commands without rewriting math.
   *
   * Shape matches the `macros` option of `rehype-katex`: a plain object
   * mapping macro name (with leading backslash) to its LaTeX-style
   * expansion.
   *
   * @example
   *   defineBookConfig({
   *     site: '...',
   *     katexMacros: {
   *       '\\Var': '\\mathrm{Var}',
   *       '\\Cov': '\\mathrm{Cov}',
   *       '\\ate': '\\tau',
   *       '\\propensity': 'e(X)',
   *     },
   *   });
   */
  katexMacros?: Record<string, string>;
  /**
   * v4.5.0: Book title. Read by the auto-injected `/` landing page (heading + <title>).
   * Optional; landing falls back to `'book-scaffold-astro'` if unset.
   *
   * Distinct from per-page `Astro.props.title` (which sets the per-page <title>):
   * this is the book-level identity, used as the H1 on the landing and as the
   * default <title> when no per-page title is supplied.
   */
  title?: string;
  /**
   * v4.23.0 (#135): Sidebar brand subtitle — the second line under the brand
   * title in the left chapter-nav. Optional; defaults to the scaffold's
   * placeholder ('A scaffold-astro book') for backward compatibility. The
   * brand TITLE is the existing `title` field above (previously the sidebar
   * hardcoded both strings, so every consumer shipped the placeholder).
   */
  subtitle?: string;
  /**
   * v4.26.2 (#149; style inheritance fixed in v4.26.3): book-level release
   * state. When set, Base.astro renders the existing <PreReleaseBanner>
   * site-wide (top of <body>) with these props. Omit to inherit from the
   * composed style chain; set `false` to suppress an inherited banner.
   */
  releaseStatus?: ReleaseStatusConfig | false;
  /**
   * v4.27.0 (#188): security headers emitted to `dist/_headers` after an
   * Astro build. Omit for the scaffold defaults; set `false` to emit no
   * scaffold-owned file; provide `contentSecurityPolicy` to replace only the
   * default CSP while retaining HSTS, XCTO, Referrer-Policy, and
   * Permissions-Policy. A consumer-owned `public/_headers` always wins.
   */
  securityHeaders?: SecurityHeadersConfig | false;
  /**
   * v4.5.0: Book description. Read by the auto-injected `/` landing page (lead paragraph + <meta description>).
   * Optional; landing renders no description paragraph if unset.
   */
  description?: string;
  /**
   * v4.5.0: Portfolio backlink rendered in the auto-injected `/` landing footer.
   * Defaults to `{ url: 'https://brandon-behring.dev', label: 'brandon-behring.dev' }` —
   * baked into the scaffold as `BRANDON_PORTFOLIO_DEFAULT` in `config.ts`. Single
   * source of truth for the portfolio URL across all Brandon-owned consumers.
   *
   * Set explicitly to `false` to disable the footer link entirely. Set to a
   * different `{ url, label }` to override (e.g., for consumers outside the
   * brandon-behring.dev ecosystem).
   */
  portfolio?: { url: string; label: string } | false;
  /**
   * v4.6.0: Book-level author. Used as the default
   * `<meta property="article:author">` value on chapter pages when no
   * per-chapter `author` is set in frontmatter. Most books have one author
   * across all chapters; this avoids repeating the value in every chapter
   * file. Per-chapter `author` frontmatter overrides this.
   */
  author?: string;
  /**
   * v4.6.0: SEO + sitemap configuration. All fields optional.
   *
   * `ogImage` — default Open Graph image URL (relative to the site root, or
   * absolute). When omitted, no `<meta property="og:image">` is emitted by
   * default; per-page `Astro.props.ogImage` can still set one. Consumers
   * opt-in to OG cards by adding e.g. `/og-default.png` to their `public/`
   * AND setting `seo: { ogImage: '/og-default.png' }`. Avoids broken-link
   * meta tags on consumers who haven't authored an OG image yet.
   *
   * `twitterHandle` — adds `<meta name="twitter:site" content="@handle">`
   * when set. Omitted by default.
   *
   * `sitemap.filter` — predicate applied to every page URL before inclusion
   * in `/sitemap-index.xml`. When set, REPLACES the profile-default filter
   * (academic/course-notes default-exclude `/print/`). When omitted, the
   * profile default applies.
   *
   * `sitemap.customPages` — additional URLs to include in the sitemap that
   * Astro's filesystem scan won't discover (passthrough to
   * `@astrojs/sitemap`'s `customPages` option).
   */
  seo?: {
    ogImage?: string;
    twitterHandle?: string;
    sitemap?: {
      filter?: (page: string) => boolean;
      customPages?: string[];
    };
  };
  /**
   * v4.15.0 (#109): GitHub `owner/repo` for `<CodeRef>` / `<CodeBlock>` source
   * links. Optional — when omitted, the scaffold auto-detects it from this
   * project's own `package.json` `repository` field (or the `origin` git
   * remote). Set it explicitly to override the auto-detection, or when neither
   * is present. With nothing resolvable, `<CodeRef>`/`<CodeBlock>` throw at
   * build rather than linking to the wrong repo.
   */
  githubRepo?: string;
  /** v4.15.0 (#109): branch for CodeRef/CodeBlock links. Defaults to `main`. */
  githubBranch?: string;
  /**
   * v4.16.0 (#96), extended in #147: registry for cross-book
   * `<BookLink book="…" to="…" />`. A string value remains supported. The
   * descriptor form adds a vendored sibling labels index so literal fragment
   * targets can be checked by `book-scaffold validate`.
   *
   * `url` may include a deployment path prefix. Relative `labels` paths are
   * resolved from the consumer project root.
   * @example
   * siblingBooks: {
   *   legacy: 'https://legacy.example',
   *   design: { url: 'https://hub.example/books/design/', labels: './vendor/design-labels.json' },
   * }
   */
  siblingBooks?: SiblingBooks;
  /**
   * v4.17.0 (Tier 3, #112): closed exam-domain taxonomy for the study-guide
   * `questions` collection. A question whose `domain` is not in this list
   * throws at build (`assertKnownDomain`) rather than silently mis-weighting a
   * blueprint or dropping an objective-map row — the per-book analogue of
   * `siblingBooks`. Domains are per-book, so they can't be a hardcoded enum.
   * @example examDomains: ['secure-network-architecture', 'identity-and-access']
   */
  examDomains?: readonly string[];
  /**
   * v4.26.0 (#80): URL pattern for a chapter entry, consumed by the book-aware
   * Sidebar / ChapterNav / NavContent so they emit correct links on a multi-book
   * consumer. Base-relative token string — `:id` (entry.id), `:book` (the
   * entry's book, see `bookField`), `:slug` (id minus the leading `<book>/`).
   * Default `'/chapters/:id/'` reproduces the single-book behavior byte-for-byte;
   * a multi-book consumer whose chapters render at `/<book>/<slug>/` (entry.id =
   * `'<book>/<slug>'`) sets `'/:id/'`. Resolved by the pure `chapterHref` helper.
   */
  chapterRoute?: string;
  /**
   * v4.26.0 (#80): frontmatter field naming a chapter's book (multi-book book
   * scoping). Default `'book'`. Absent on single-book schemas → the sidebar shows
   * every chapter (today's behavior); present → the sidebar filters to the
   * current book and the `:book` / `:slug` route tokens resolve.
   */
  bookField?: string;
  /**
   * v4.26.0 (#80): URL pattern for a per-book apparatus route (practice-exam /
   * glossary / flashcards / answers) surfaced in the nav. Tokens `:book` +
   * `:route`. Default `'/:route/'` (single-book, flat); a multi-book consumer
   * sets `'/:book/:route/'`. Resolved by the pure `apparatusHref` helper.
   */
  apparatusRoute?: string;
  /**
   * v4.26.0 (#80): the apparatus route slugs to surface in the nav (sidebar +
   * drawer) — a subset of `practice-exam | glossary | flashcards | answers`.
   * Default `[]` (no apparatus links in nav — existing single-book books render
   * unchanged). A multi-book consumer that owns per-book apparatus routes sets
   * e.g. `['practice-exam','glossary','flashcards','answers']`; each is rendered
   * via `apparatusHref(slug, currentBook, apparatusRoute, base)`.
   */
  apparatusRoutes?: readonly string[];
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
  /** Resolved theorem-family counter strategy exposed to package CLI tooling. */
  numberStyle?: NumberStyle;
  /**
   * Per-route override; merged into the profile's defaults.
   * v4.0.0: `routes.frontmatter` widened to `boolean | { enabled, prefix? }`
   * (closes #49). Pattern URL computed from `prefix` (default 'frontmatter').
   */
  routes?: PartialRouteToggles;
  /**
   * Optional explicit path to the consumer's mdx-components file (relative
   * to consumer root). When omitted, the Integration auto-detects
   * `src/mdx-components.{ts,js,mjs}` via the resolver. Final resolution
   * happens inside the `astro:config:setup` hook where consumer root is
   * known.
   */
  mdxComponentsModule?: string;
  extraStyles?: readonly string[];
  /** v4.5.0: book title, propagated to `/` landing via vite.define. */
  title?: string;
  /** v4.23.0 (#135): sidebar brand subtitle, propagated via the book-config
   *  virtual module to Sidebar.astro. */
  subtitle?: string;
  /** v4.26.2 (#149; style inheritance fixed in v4.26.3): resolved
   *  release-state banner propagated via the book-config virtual module. */
  releaseStatus?: ReleaseStatusConfig;
  /** v4.27.0 (#188): resolved security-header emission policy. */
  securityHeaders?: SecurityHeadersConfig | false;
  /** v4.5.0: book description, propagated to `/` landing via vite.define. */
  description?: string;
  /**
   * v4.5.0: resolved portfolio backlink (after defineBookConfig applied
   * BRANDON_PORTFOLIO_DEFAULT). `false` means the landing renders no link.
   */
  portfolio?: { url: string; label: string } | false;
  /**
   * v4.6.0: book-level author, propagated through the book-config virtual
   * module to Chapter.astro's `<meta property="article:author">` fallback.
   */
  author?: string;
  /**
   * v4.6.0: SEO payload propagated through the book-config virtual module
   * to Base.astro. Only `ogImage` + `twitterHandle` are exposed at runtime
   * — the `sitemap` sub-block is consumed at config-time in defineBookConfig
   * (it never reaches the integration / virtual module).
   */
  seo?: {
    ogImage?: string;
    twitterHandle?: string;
  };
  /**
   * v4.15.0 (#109): GitHub repo/branch override for CodeRef/CodeBlock,
   * propagated through the book-config virtual module. When `githubRepo` is
   * undefined the integration auto-detects from the consumer's package.json /
   * git remote at config-setup time.
   */
  githubRepo?: string;
  githubBranch?: string;
  /** v4.16.0 (#96), extended in #147: sibling-book registry for <BookLink>. */
  siblingBooks?: SiblingBooks;
  /** v4.17.0 (#112): closed exam-domain taxonomy for the questions collection. */
  examDomains?: readonly string[];
  /** v4.26.0 (#80): chapter-route token pattern, propagated via the book-config
   *  virtual module to the book-aware nav. Default '/chapters/:id/'. */
  chapterRoute?: string;
  /** v4.26.0 (#80): frontmatter field naming a chapter's book. Default 'book'. */
  bookField?: string;
  /** v4.26.0 (#80): apparatus-route token pattern. Default '/:route/'. */
  apparatusRoute?: string;
  /** v4.26.0 (#80): apparatus route slugs to surface in the nav. Default []. */
  apparatusRoutes?: readonly string[];
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
 * Resolve preset from explicit args → env → .env → the v4 compatibility
 * default. Throws on invalid values.
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
 *   7. 'minimal' (v4 compatibility bridge; warns once per process)
 */
const PRESET_FALLBACK_WARNING = Symbol.for('book-scaffold-astro:preset-fallback-warning');

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
    const warningState = globalThis as unknown as Record<symbol, boolean | undefined>;
    if (!warningState[PRESET_FALLBACK_WARNING]) {
      warningState[PRESET_FALLBACK_WARNING] = true;
      // eslint-disable-next-line no-console
      console.warn(
        "book-scaffold-astro: no preset resolved; falling back to 'minimal' for v4 " +
          'compatibility. This fallback will be removed in v5. Add a built-in style to ' +
          'defineBookConfig and pass the same preset to defineBookSchemas, or set BOOK_PRESET.',
      );
    }
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
