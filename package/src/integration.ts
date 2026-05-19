/**
 * bookScaffoldIntegration — the dual-purpose Astro Integration.
 *
 * 1. Injects profile-conditional CSS via `injectScript('page-ssr', …)`
 *    — confirmed by Phase A.5 spike (see
 *    `~/.claude/plans/poc-archive/v3-poc-outcome.md`).
 * 2. Injects default routes via `injectRoute` so the consumer's
 *    `src/pages/` can stay empty. Consumer wins by precedence if they
 *    create their own `src/pages/<route>.astro`.
 *
 * See PACKAGE_DESIGN.md §6.
 */
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

const DEFAULT_ROUTES_ALL = [
  { pattern: '/chapters', entrypoint: `${PACKAGE_NAME}/pages/chapters.astro` },
  { pattern: '/references', entrypoint: `${PACKAGE_NAME}/pages/references.astro` },
  { pattern: '/print', entrypoint: `${PACKAGE_NAME}/pages/print.astro` },
  { pattern: '/search', entrypoint: `${PACKAGE_NAME}/pages/search.astro` },
] as const;

const DEFAULT_ROUTES_TOOLS = [
  { pattern: '/convergence', entrypoint: `${PACKAGE_NAME}/pages/convergence.astro` },
] as const;

export function bookScaffoldIntegration(
  opts: BookScaffoldIntegrationOptions,
): AstroIntegration {
  const { profile, extraStyles = [] } = opts;

  return {
    name: 'book-scaffold-astro',
    hooks: {
      'astro:config:setup': ({ injectScript, injectRoute }) => {
        // 1. Style injection (Option α — Phase A.5 spike)
        const styles =
          profile === 'tools'
            ? [...ALWAYS_ON_STYLES, ...TOOLS_ONLY_STYLES, ...extraStyles]
            : [...ALWAYS_ON_STYLES, ...extraStyles];

        for (const sheet of styles) {
          injectScript('page-ssr', `import '${PACKAGE_NAME}/styles/${sheet}';`);
        }

        // 2. Route injection (profile-conditional per D10)
        const routes =
          profile === 'tools'
            ? [...DEFAULT_ROUTES_ALL, ...DEFAULT_ROUTES_TOOLS]
            : [...DEFAULT_ROUTES_ALL];

        for (const route of routes) {
          injectRoute({ pattern: route.pattern, entrypoint: route.entrypoint });
        }
      },
    },
  };
}
