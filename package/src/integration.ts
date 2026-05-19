/**
 * bookScaffoldIntegration — the dual-purpose Astro Integration.
 *
 * 1. Injects profile-conditional CSS via `injectScript('page-ssr', …)`.
 *    Vite resolves the npm-package CSS specifiers inside the import
 *    statements at consumer build time. Confirmed by Phase A.5 spike
 *    (see ~/.claude/plans/poc-archive/v3-poc-outcome.md).
 * 2. Injects default routes via `injectRoute`. Astro's routing resolver
 *    expects an absolute filesystem path (or file: URL); npm-package
 *    specifiers do NOT work here, so we compute the path via
 *    `import.meta.url`.
 *
 * See PACKAGE_DESIGN.md §6.
 */
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import type { BookScaffoldIntegrationOptions } from './types.js';

const PACKAGE_NAME = '@brandon_m_behring/book-scaffold-astro';

const ALWAYS_ON_STYLES = [
  'tokens.css',
  'layout.css',
  'callouts.css',
  'chapter.css',
  'typography.css',
  'print.css',
] as const;

const TOOLS_ONLY_STYLES = ['convergence.css', 'tool-filter.css'] as const;

// Default routes that work for any profile:
//   /references  — bibliography renders from src/data/references.json
//                  (built by `book-scaffold build-bib`; empty if missing)
//   /search      — Pagefind UI; works for any content
//   /print       — Paged.js entrypoint; ChapterHeader is schema-agnostic since alpha.5
const DEFAULT_ROUTES_ALL = [
  { pattern: '/references', file: 'references.astro' },
  { pattern: '/search', file: 'search.astro' },
  { pattern: '/print', file: 'print.astro' },
] as const;

// Tools-profile-only routes. The shipped chapters + convergence pages read
// tools-specific fields (volatility, tools_compared) at the page level —
// ChapterHeader fix alone doesn't help. Academic books that want these
// pages provide their own (the v2.0 convention — see
// post_transformers/guides/web/). Promotion to DEFAULT_ROUTES_ALL needs
// academic-flavored versions of those pages, not just the header.
const DEFAULT_ROUTES_TOOLS = [
  { pattern: '/chapters', file: 'chapters.astro' },
  { pattern: '/convergence', file: 'convergence.astro' },
] as const;

/**
 * Resolve a page filename to an absolute filesystem path inside the
 * package. tsup bundles this module into dist/index.mjs, so the pages
 * live at `../pages/<file>` relative to the compiled output.
 */
function resolvePage(file: string): string {
  return fileURLToPath(new URL(`../pages/${file}`, import.meta.url));
}

export function bookScaffoldIntegration(
  opts: BookScaffoldIntegrationOptions,
): AstroIntegration {
  const { profile, extraStyles = [] } = opts;

  return {
    name: 'book-scaffold-astro',
    hooks: {
      'astro:config:setup': ({ injectScript, injectRoute }) => {
        // 1. Style injection (Option α — Phase A.5 spike). Vite resolves
        //    `@brandon_m_behring/book-scaffold-astro/styles/<X>.css` from
        //    the consumer's node_modules at build time.
        const styles =
          profile === 'tools'
            ? [...ALWAYS_ON_STYLES, ...TOOLS_ONLY_STYLES, ...extraStyles]
            : [...ALWAYS_ON_STYLES, ...extraStyles];

        for (const sheet of styles) {
          injectScript('page-ssr', `import '${PACKAGE_NAME}/styles/${sheet}';`);
        }

        // 2. Route injection (profile-conditional per D10). Absolute file
        //    paths required — see resolvePage().
        const routes =
          profile === 'tools'
            ? [...DEFAULT_ROUTES_ALL, ...DEFAULT_ROUTES_TOOLS]
            : [...DEFAULT_ROUTES_ALL];

        for (const route of routes) {
          injectRoute({
            pattern: route.pattern,
            entrypoint: resolvePage(route.file),
          });
        }
      },
    },
  };
}
