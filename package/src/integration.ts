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
import type { AstroIntegration } from 'astro';
import type { BookScaffoldIntegrationOptions } from './types.js';
import { PROFILES } from './profiles/index.js';
import { normalizeFrontmatterConfig } from './lib/define-style.js';
import {
  resolveMdxComponentsPath,
  makeMdxComponentsVitePlugin,
} from './mdx-components-resolver.js';

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
    routes: userOverrides = {},
    extraStyles = [],
    mdxComponentsModule,
    // v4.5.0: landing-page data, propagated via vite.define to /index.astro.
    title,
    description,
    portfolio,
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

  return {
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

        // 4. v3.4.0 (#9): propagate the resolved preset to runtime via
        //    vite.define. Consumer components reading import.meta.env.BOOK_PRESET
        //    or import.meta.env.BOOK_PROFILE (alias, back-compat) get the value
        //    defineBookConfig resolved, regardless of whether the env was set.
        //    Single source of truth across the Astro config + runtime components
        //    + CLI (validate.mjs accepts --preset for its own resolution).
        const presetLiteral = JSON.stringify(profile);
        // v4.5.0: serialize the landing-page data so /index.astro can read it.
        // BOOK_ROUTES_ENABLED is the list of route names (e.g. ['chapters', 'search', ...])
        // that the integration ACTUALLY injected — derived from enabledRoutes
        // post-merge of profile defaults + consumer overrides. The landing page
        // uses this to render only links to routes that exist at runtime, so
        // consumers like dlai-study-notes (routes.chapters: false) don't get
        // a broken /chapters/ link in their landing.
        const enabledRouteNames = Object.entries(enabledRoutes)
          .filter(([, on]) => on)
          .map(([name]) => name);
        updateConfig({
          vite: {
            plugins: [makeMdxComponentsVitePlugin(resolvedMdxPath)],
            define: {
              'import.meta.env.BOOK_PRESET': presetLiteral,
              'import.meta.env.BOOK_PROFILE': presetLiteral,
              // v4.5.0: landing-page data. JSON.stringify on undefined → 'undefined'
              // (which evaluates to JavaScript undefined at use site); on object →
              // the JSON literal; on false → 'false'.
              'import.meta.env.BOOK_TITLE': JSON.stringify(title ?? null),
              'import.meta.env.BOOK_DESCRIPTION': JSON.stringify(description ?? null),
              'import.meta.env.BOOK_PORTFOLIO': JSON.stringify(portfolio ?? null),
              'import.meta.env.BOOK_ROUTES_ENABLED': JSON.stringify(enabledRouteNames),
            },
          },
        });
      },
    },
  };
}
