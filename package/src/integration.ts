/**
 * bookScaffoldIntegration — the dual-purpose Astro Integration.
 *
 * 1. Injects profile-resolved CSS via `injectScript('page-ssr', …)`. Vite
 *    resolves the npm-package CSS specifiers from the consumer's
 *    node_modules at build time. Confirmed by Phase A.5 spike (see
 *    ~/.claude/plans/poc-archive/v3-poc-outcome.md).
 * 2. Injects default routes via `injectRoute`. Astro's routing resolver
 *    expects an absolute filesystem path; npm-package specifiers do NOT
 *    work here, so we compute the path via `import.meta.url`.
 * 3. (v3.3.0) Mounts a Vite plugin exposing the consumer's mdx-components
 *    map at the virtual module `virtual:book-scaffold/mdx-components`, so
 *    scaffold-injected routes can render consumer-defined MDX components
 *    consistently. Closes issue #2.
 *
 * Profile/route logic is driven by the PROFILES registry
 * (src/profiles/index.ts). Each profile module owns its schema + routes +
 * styles. Adding a new profile is a single-file change. See
 * ~/.claude/plans/address-and-finish-moonlit-shell.md §Architecture.
 *
 * See PACKAGE_DESIGN.md §6.
 */
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AstroIntegration } from 'astro';
import type { BookScaffoldIntegrationOptions, SiblingBooks } from './types.js';
import { PROFILES } from './profiles/index.js';
import { normalizeFrontmatterConfig } from './lib/define-style.js';
import { resolveGithubRepo, DEFAULT_GITHUB_BRANCH } from './lib/repo-url.js';
import {
  resolveMdxComponentsPath,
  makeMdxComponentsVitePlugin,
} from './mdx-components-resolver.js';

/**
 * v4.6.0: Book-config virtual module plugin (renamed from
 * `landing-config` in v4.5.1). Exposes book-level identity + SEO config to
 * every page that needs it — the auto-injected landing AND `Base.astro` on
 * every page AND `Chapter.astro` (article:author fallback) via
 * `virtual:book-scaffold/book-config`.
 *
 * Previously named `landing-config` (v4.5.1) when only the landing page
 * consumed it. v4.6.0 added SEO meta tags to Base.astro (Primary item of
 * issue #76), which means every page now imports this module, and the
 * "landing" name became misleading. Same plugin shape, broader payload.
 *
 * The virtual-module pattern (rather than env-var injection) is preserved
 * from v4.5.1 — it isolates config values from consumer `.env` collisions
 * (the DML `BOOK_TITLE=web` bug from the v4.5.0→v4.5.1 dogfood loop).
 *
 * See ~/.claude/plans/i-want-to-look-streamed-pebble.md (v4.5.x history)
 * + ~/.claude/plans/next-session-pickup-silly-tiger.md (v4.6.0 plan).
 */
const BOOK_CONFIG_VIRTUAL_ID = 'virtual:book-scaffold/book-config';
const BOOK_CONFIG_RESOLVED_ID = '\0' + BOOK_CONFIG_VIRTUAL_ID;

/**
 * #187: Fontsource publishes Roboto with `font-display: swap`. A delayed
 * body-font response therefore reflows the complete prose column after first
 * paint (the field report recorded CLS 0.274). Keep Fontsource's generated
 * unicode ranges and asset graph intact, but make its one package-owned CSS
 * entry optional so a slow first visit stays on the fallback instead of
 * swapping late. Consumer-authored font CSS is deliberately untouched.
 */
function makeRobotoFontDisplayVitePlugin() {
  return {
    name: 'book-scaffold:roboto-font-display',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      const [path = id] = id.split('?');
      const normalizedPath = path.replaceAll('\\', '/');
      if (!normalizedPath.endsWith('/@fontsource-variable/roboto/index.css')) {
        return null;
      }

      const transformed = code.replace(/font-display:\s*swap/g, 'font-display: optional');
      return transformed === code ? null : { code: transformed, map: null };
    },
  };
}

function makeBookConfigVitePlugin(config: {
  title: string | null;
  // v4.23.0 (#135): sidebar brand subtitle.
  subtitle: string | null;
  // v4.26.2 (#149; style inheritance fixed in v4.26.3): release-state banner;
  // Base.astro renders <PreReleaseBanner> when non-null.
  releaseStatus: { state: 'alpha' | 'beta' | 'rc' | 'locked'; dismissAt?: string; message?: string } | null;
  description: string | null;
  portfolio: { url: string; label: string } | false;
  enabledRoutes: readonly string[];
  author: string | null;
  seo: {
    ogImage: string | null;
    twitterHandle: string | null;
  };
  // v4.15.0 (#109): resolved GitHub repo for CodeRef/CodeBlock — override,
  // else auto-detected, else null (the components fail loud rather than link
  // to the wrong repo).
  githubRepo: string | null;
  githubBranch: string;
  // v4.16.0 (#96), extended in #147: sibling-book registry for <BookLink>.
  siblingBooks: SiblingBooks;
  // v4.17.0 (#112): per-book exam-domain taxonomy for the questions collection.
  examDomains: readonly string[];
  // v4.26.0 (#80): book-aware nav route patterns (token strings). Defaults
  // reproduce single-book behavior; multi-book consumers opt in via defineBookConfig.
  chapterRoute: string;
  bookField: string;
  apparatusRoute: string;
  apparatusRoutes: readonly string[];
}) {
  // Serialize once at plugin-creation time so subsequent load() calls are O(1).
  const serialized = `export default ${JSON.stringify(config)};`;
  return {
    name: 'book-scaffold:book-config',
    enforce: 'pre' as const,
    resolveId(id: string) {
      if (id === BOOK_CONFIG_VIRTUAL_ID) return BOOK_CONFIG_RESOLVED_ID;
      return null;
    },
    load(id: string) {
      if (id !== BOOK_CONFIG_RESOLVED_ID) return null;
      return serialized;
    },
  };
}

/**
 * v4.15.0 (#109): resolve the consumer's GitHub `owner/repo` at build time so
 * CodeRef/CodeBlock link to the book's own repo with zero config. Reads the
 * consumer's `package.json` `repository` and `.git/config` from the project
 * root (never the package's own dir) and delegates the precedence — override →
 * package.json → git origin → null — to the unit-tested `resolveGithubRepo`.
 */
function resolveBookGithubRepo(
  override: string | undefined,
  consumerRoot: string,
): string | null {
  let packageJsonRepository: unknown = null;
  let gitConfigText: string | null = null;
  try {
    packageJsonRepository =
      JSON.parse(readFileSync(join(consumerRoot, 'package.json'), 'utf8')).repository ?? null;
  } catch {
    /* no package.json / unreadable — fall through */
  }
  try {
    gitConfigText = readFileSync(join(consumerRoot, '.git', 'config'), 'utf8');
  } catch {
    /* no .git/config (e.g. tarball consumer) — fall through */
  }
  return resolveGithubRepo({
    override,
    packageJsonRepository: packageJsonRepository as string | { url?: string } | null,
    gitConfigText,
  });
}

const PACKAGE_NAME = '@brandon_m_behring/book-scaffold-astro';

/** Mapping from route toggle name → injected route metadata.
 *  v4.0.0: `frontmatter.pattern` is computed at runtime from the route config's
 *  `prefix` field (closes #49); the value below is the default when no
 *  prefix is specified. */
const ROUTE_REGISTRY = {
  references:  { pattern: '/references',          file: 'references.astro' },
  search:      { pattern: '/search',              file: 'search.astro' },
  print:       { pattern: '/print',               file: 'print.astro' },
  chapters:    { pattern: '/chapters',            file: 'chapters.astro' },
  // v4.3.0 (#69): per-chapter dynamic route auto-injected when
  // routes.chapters: true. Mirrors the frontmatter pattern — toolkit ships
  // BOTH the /chapters/ index AND the /chapters/<slug>/ dynamic route.
  // Pre-v4.3.0 each consumer wrote this file by hand; all instances were
  // mechanical copies of the same boilerplate.
  chaptersSlug:{ pattern: '/chapters/[...slug]',  file: 'chapters/[...slug].astro' },
  convergence: { pattern: '/convergence',         file: 'convergence.astro' },
  // v4.3.0 (#70): cross-volume numbered-tips index. Opt-in via
  // routes.tips: true; pairs with build-tips script + <Tip> component.
  tips:        { pattern: '/tips',                file: 'tips.astro' },
  // v4.4.0: exercises index by chapter. Opt-in via routes.exercises: true;
  // pairs with build-exercises script + <ExerciseSolutions auto /> mode.
  exercises:   { pattern: '/exercises',           file: 'exercises.astro' },
  // v4.17.0 (Tier 3, #112): static practice question-bank. Opt-in via
  // routes.practiceExam: true; reads the `questions` collection + examDomains.
  practiceExam:{ pattern: '/practice-exam',       file: 'practice-exam.astro' },
  // v4.19.0 (#115): searchable key-terms glossary. Opt-in via routes.glossary:
  // true; reads the `glossary` collection (src/content/glossary/).
  glossary:    { pattern: '/glossary',            file: 'glossary.astro' },
  // v4.21.0 (#114): answer-rationale back-appendix. Opt-in via routes.answers:
  // true; reads the `questions` collection with everything revealed.
  answers:     { pattern: '/answers',             file: 'answers.astro' },
  // v4.22.0 (#116): glossary flashcards deck. Opt-in via routes.flashcards:
  // true; reads the `glossary` collection (src/content/glossary/).
  flashcards:  { pattern: '/flashcards',          file: 'flashcards.astro' },
  // v4.5.0: minimal root landing page. Reads title/description/portfolio/routes
  // from vite.define-injected import.meta.env vars. Default-on per profile;
  // consumers with their own src/pages/index.astro override (file-system route
  // wins over injectRoute).
  landing:     { pattern: '/',                    file: 'index.astro' },
  // v3.4.0 (#7): consumer-collection-backed frontmatter route. Opt-in via
  // routes: { frontmatter: true } AND content.config.ts defining the
  // collection (use frontmatterCollection() helper from /schemas subpath).
  // v4.0.0 (#49): widened to object form `{ enabled, prefix? }`; pattern
  // computed from `prefix` (default 'frontmatter' → '/frontmatter/[slug]';
  // empty string → '/[slug]'; arbitrary string → '/<prefix>/[slug]').
  frontmatter: { pattern: '/frontmatter/[slug]',  file: 'frontmatter/[...slug].astro' },
} as const;

/**
 * #188: scaffold-adapted CSP for the Cloudflare `_headers` format. Each
 * allowance corresponds to behavior shipped by the toolkit:
 *
 * - `unsafe-inline`: the theme/drawer scripts and Astro component styles
 * - `wasm-unsafe-eval`: Pagefind's WebAssembly search index
 * - `static.cloudflareinsights.com` / `cloudflareinsights.com`: optional
 *   Cloudflare Web Analytics used by deployed consumer books
 * - `img-src ... data: https:`: inline assets plus consumer-hosted figures
 *
 * Fonts, KaTeX assets, and the search index otherwise remain self-hosted.
 */
const DEFAULT_CONTENT_SECURITY_POLICY =
  "default-src 'self'; " +
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://static.cloudflareinsights.com; " +
  "style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: https:; " +
  "font-src 'self'; " +
  "connect-src 'self' https://cloudflareinsights.com; " +
  "object-src 'none'; " +
  "base-uri 'self'; " +
  "frame-ancestors 'self'; " +
  "form-action 'self'";

/** Render the five audited defaults, replacing only CSP when requested. */
function renderSecurityHeaders(contentSecurityPolicy?: string): string {
  const csp = contentSecurityPolicy ?? DEFAULT_CONTENT_SECURITY_POLICY;
  return `/*
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: ${csp}
`;
}

/** Compute the frontmatter route URL pattern from the prefix.
 *  Empty string → root mount `/[slug]`. Any other string → `/<prefix>/[slug]`.
 *  Undefined → uses the default ROUTE_REGISTRY pattern. */
function frontmatterPatternFromPrefix(prefix: string | undefined): string {
  if (prefix === undefined) return ROUTE_REGISTRY.frontmatter.pattern;
  if (prefix === '') return '/[slug]';
  return `/${prefix}/[slug]`;
}

/**
 * Resolve a page filename to an absolute filesystem path inside the package.
 * tsup bundles this module into dist/index.mjs, so the pages live at
 * `../pages/<file>` relative to the compiled output.
 */
function resolvePage(file: string): string {
  return fileURLToPath(new URL(`../pages/${file}`, import.meta.url));
}

export function bookScaffoldIntegration(
  opts: BookScaffoldIntegrationOptions,
): AstroIntegration {
  const {
    profile,
    numberStyle = 'shared',
    routes: userOverrides = {},
    extraStyles = [],
    mdxComponentsModule,
    // v4.5.0: landing-page data, propagated via virtual module to /index.astro.
    title,
    subtitle,
    releaseStatus,
    securityHeaders,
    description,
    portfolio,
    // v4.6.0: book-level author + SEO config, propagated through the
    // (renamed) book-config virtual module to Base.astro + Chapter.astro.
    author,
    seo,
    // v4.15.0 (#109): optional GitHub repo/branch override for CodeRef/CodeBlock.
    githubRepo,
    githubBranch,
    // v4.16.0 (#96): sibling-book registry for cross-book <BookLink>.
    siblingBooks,
    // v4.17.0 (#112): exam-domain taxonomy for the questions collection.
    examDomains,
    // v4.26.0 (#80): book-aware nav route patterns.
    chapterRoute,
    bookField,
    apparatusRoute,
    apparatusRoutes,
  } = opts;
  const def = PROFILES[profile];

  // Merge per-profile route defaults with user overrides. Last-wins object
  // spread; consumer can flip any route on/off.
  // v4.0.0 (#49): `userOverrides.frontmatter` may be `boolean | { enabled, prefix? }`.
  // Normalize to extract the `enabled` boolean for the enabledRoutes map AND
  // capture the prefix for downstream pattern computation.
  const fmNormalized = normalizeFrontmatterConfig(userOverrides.frontmatter);
  const fmEnabled = fmNormalized?.enabled ?? def.routes.frontmatter;
  const fmPrefix = (fmNormalized && 'prefix' in fmNormalized) ? fmNormalized.prefix : undefined;

  const enabledRoutes: Record<string, boolean> = {
    ...def.routes,
    ...Object.fromEntries(
      Object.entries(userOverrides).filter(([k]) => k !== 'frontmatter'),
    ),
    frontmatter: fmEnabled,
  };

  const integration: AstroIntegration = {
    name: 'book-scaffold-astro',
    hooks: {
      'astro:config:setup': ({ injectScript, injectRoute, updateConfig, config }) => {
        // 1. Style injection. Profile owns its style list; consumer can append
        //    via extraStyles (cross-profile escape hatch).
        const styles = [...def.styles, ...extraStyles];
        for (const sheet of styles) {
          injectScript('page-ssr', `import '${PACKAGE_NAME}/styles/${sheet}';`);
        }

        // KaTeX CSS only when the profile flags katex: true. The remark/rehype
        // plugins are wired in defineBookConfig (config.ts); this injection
        // covers the runtime CSS.
        if (def.katex) {
          injectScript('page-ssr', "import 'katex/dist/katex.min.css';");
        }

        // 2. Route injection — driven by enabledRoutes map.
        //    v4.0.0 (#49): frontmatter route uses prefix-computed pattern.
        //    v4.3.0 (#69): when routes.chapters is true, ALSO inject the
        //    per-chapter dynamic route (chaptersSlug). The two routes ship
        //    together: index lists chapters, dynamic route renders each one.
        const routesToInject: string[] = [];
        for (const [name, on] of Object.entries(enabledRoutes)) {
          if (!on) continue;
          routesToInject.push(name);
          if (name === 'chapters') routesToInject.push('chaptersSlug');
        }
        for (const name of routesToInject) {
          const route = ROUTE_REGISTRY[name as keyof typeof ROUTE_REGISTRY];
          if (!route) continue;   // unknown key from a stale override (defensive)
          const pattern =
            name === 'frontmatter' ? frontmatterPatternFromPrefix(fmPrefix) : route.pattern;
          injectRoute({
            pattern,
            entrypoint: resolvePage(route.file),
          });
        }

        // 3. mdx-components virtual module (issue #2).
        //    config.root is a URL; fileURLToPath gives the consumer's project root.
        const consumerRoot = fileURLToPath(config.root);
        const resolvedMdxPath = resolveMdxComponentsPath(consumerRoot, mdxComponentsModule);

        // v4.15.0 (#109): resolve the GitHub repo once — explicit override wins,
        // else auto-detect from the consumer's package.json / git remote, else
        // null (CodeRef/CodeBlock then fail loud rather than link the wrong repo).
        const resolvedGithubRepo = resolveBookGithubRepo(githubRepo, consumerRoot);
        const resolvedGithubBranch = githubBranch ?? DEFAULT_GITHUB_BRANCH;

        // 4. v3.4.0 (#9): propagate the resolved preset to runtime via
        //    vite.define. Consumer components reading import.meta.env.BOOK_PRESET
        //    or import.meta.env.BOOK_PROFILE (alias, back-compat) get the value
        //    defineBookConfig resolved, regardless of whether the env was set.
        //    Single source of truth across the Astro config + runtime components
        //    + CLI (validate.mjs accepts --preset for its own resolution).
        const presetLiteral = JSON.stringify(profile);
        // v4.5.1: landing-page data via virtual module (was env vars in
        // v4.5.0; refactored after the DML dogfood deploy surfaced a
        // collision with stale `.env` BOOK_TITLE entries). enabledRouteNames
        // is the post-merge list — consumers like dlai (routes.chapters:
        // false) get a landing with no broken /chapters/ link.
        const enabledRouteNames = Object.entries(enabledRoutes)
          .filter(([, on]) => on)
          .map(([name]) => name);
        updateConfig({
          vite: {
            plugins: [
              makeRobotoFontDisplayVitePlugin(),
              makeMdxComponentsVitePlugin(resolvedMdxPath),
              makeBookConfigVitePlugin({
                title: title ?? null,
                subtitle: subtitle ?? null,
                releaseStatus: releaseStatus ?? null,
                description: description ?? null,
                portfolio: portfolio ?? false,
                enabledRoutes: enabledRouteNames,
                author: author ?? null,
                seo: {
                  ogImage: seo?.ogImage ?? null,
                  twitterHandle: seo?.twitterHandle ?? null,
                },
                githubRepo: resolvedGithubRepo,
                githubBranch: resolvedGithubBranch,
                siblingBooks: siblingBooks ?? {},
                examDomains: examDomains ?? [],
                // v4.26.0 (#80): book-aware nav route patterns; defaults
                // reproduce the single-book `/chapters/<id>/` behavior exactly.
                chapterRoute: chapterRoute ?? '/chapters/:id/',
                bookField: bookField ?? 'book',
                apparatusRoute: apparatusRoute ?? '/:route/',
                apparatusRoutes: apparatusRoutes ?? [],
              }),
            ],
            define: {
              // Preset/profile stay as env vars — preference-flag pattern where
              // env-based override IS the convention (resolvePreset reads from
              // process.env / .env explicitly). Config values (title, etc.) now
              // route through the virtual module above to avoid that override.
              'import.meta.env.BOOK_PRESET': presetLiteral,
              'import.meta.env.BOOK_PROFILE': presetLiteral,
            },
          },
        });
      },

      // v4.27.0 (#188): emit defaults for every build, not only newly
      // scaffolded projects, so existing consumers become protected on their
      // next package upgrade. Astro copies public/_headers into the output
      // before build:done; an existing target therefore means the consumer
      // owns the complete file and must win byte-for-byte.
      'astro:build:done': ({ dir, logger }) => {
        if (securityHeaders === false) {
          logger.info('security-header emission disabled by defineBookConfig (#188)');
          return;
        }

        const target = join(fileURLToPath(dir), '_headers');
        if (existsSync(target)) {
          logger.info('consumer public/_headers present; scaffold defaults skipped (#188)');
          return;
        }

        writeFileSync(
          target,
          renderSecurityHeaders(securityHeaders?.contentSecurityPolicy),
          'utf8',
        );
        logger.info('emitted default security headers; public/_headers overrides them (#188)');
      },
    },
  };

  // Internal bridge for package CLI tools. Vite's loadConfigFromFile evaluates
  // the consumer's real Astro config; build-labels and validate then find this
  // metadata on the resolved integration instead of re-parsing style source.
  // Non-enumerable keeps it out of Astro's own config serialization/debugging.
  Object.defineProperty(integration, '__bookScaffoldResolvedConfig', {
    value: Object.freeze({
      preset: profile,
      numberStyle,
      siblingBooks: siblingBooks ?? {},
      chapterRoute: chapterRoute ?? '/chapters/:id/',
      bookField: bookField ?? 'book',
    }),
    enumerable: false,
    configurable: false,
    writable: false,
  });

  return integration;
}
