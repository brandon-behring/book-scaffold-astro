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
import {
  resolveMdxComponentsPath,
  makeMdxComponentsVitePlugin,
} from './mdx-components-resolver.js';

const PACKAGE_NAME = '@brandon_m_behring/book-scaffold-astro';

/** Mapping from route toggle name → injected route metadata. */
const ROUTE_REGISTRY = {
  references: { pattern: '/references', file: 'references.astro' },
  search:     { pattern: '/search',     file: 'search.astro' },
  print:      { pattern: '/print',      file: 'print.astro' },
  chapters:   { pattern: '/chapters',   file: 'chapters.astro' },
  convergence:{ pattern: '/convergence',file: 'convergence.astro' },
} as const;

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
  const { profile, routes: userOverrides = {}, extraStyles = [], mdxComponentsModule } = opts;
  const def = PROFILES[profile];

  // Merge per-profile route defaults with user overrides. Last-wins object
  // spread; consumer can flip any route on/off.
  const enabledRoutes = { ...def.routes, ...userOverrides };

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
        for (const [name, on] of Object.entries(enabledRoutes)) {
          if (!on) continue;
          const route = ROUTE_REGISTRY[name as keyof typeof ROUTE_REGISTRY];
          if (!route) continue;   // unknown key from a stale override (defensive)
          injectRoute({
            pattern: route.pattern,
            entrypoint: resolvePage(route.file),
          });
        }

        // 3. mdx-components virtual module (issue #2).
        //    config.root is a URL; fileURLToPath gives the consumer's project root.
        const consumerRoot = fileURLToPath(config.root);
        const resolvedMdxPath = resolveMdxComponentsPath(consumerRoot, mdxComponentsModule);
        updateConfig({
          vite: {
            plugins: [makeMdxComponentsVitePlugin(resolvedMdxPath)],
          },
        });
      },
    },
  };
}
