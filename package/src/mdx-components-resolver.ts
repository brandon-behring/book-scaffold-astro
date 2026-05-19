/**
 * MDX-components resolver — auto-detects consumer's mdx-components file +
 * exposes it to scaffold-injected routes via a Vite virtual module.
 *
 * Closes issue #2 (v3.3.0). Consumer convention:
 *
 *   // consumer's src/mdx-components.ts
 *   import { defineMdxComponents } from '@brandon_m_behring/book-scaffold-astro';
 *   import AnkiCard from './components/AnkiCard.astro';
 *   import NarrativeBox from './components/NarrativeBox.astro';
 *
 *   export default defineMdxComponents({ AnkiCard, NarrativeBox });
 *
 * Then any scaffold-injected route (currently /print; future /pdf, /epub)
 * imports the map via the virtual module:
 *
 *   import mdxComponents from 'virtual:book-scaffold/mdx-components';
 *   <Content components={mdxComponents} />
 *
 * Auto-detection looks for src/mdx-components.{ts,js,mjs} in the consumer's
 * project root. defineBookConfig({ mdxComponentsModule: '...' }) overrides.
 *
 * Why this design (vs eager values in config, or per-route slot helpers):
 * see ~/.claude/plans/address-and-finish-moonlit-shell.md §Decisions §Issue #2.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const CANDIDATE_FILES = [
  'src/mdx-components.ts',
  'src/mdx-components.js',
  'src/mdx-components.mjs',
];

const VIRTUAL_ID = 'virtual:book-scaffold/mdx-components';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

/**
 * Resolve the consumer's mdx-components file path.
 *
 * @param consumerRoot - Absolute path to the consumer's project root.
 * @param explicit - Optional path from defineBookConfig({ mdxComponentsModule }).
 *                   Resolved relative to consumerRoot; absent files return null
 *                   (rather than throwing — auto-detect is best-effort).
 * @returns Absolute path to the resolved file, or null if not found.
 */
export function resolveMdxComponentsPath(
  consumerRoot: string,
  explicit?: string,
): string | null {
  if (explicit) {
    const p = resolve(consumerRoot, explicit);
    return existsSync(p) ? p : null;
  }
  for (const candidate of CANDIDATE_FILES) {
    const p = resolve(consumerRoot, candidate);
    if (existsSync(p)) return p;
  }
  return null;
}

/**
 * Vite plugin that maps `virtual:book-scaffold/mdx-components` to a module
 * that re-exports the consumer's mdx-components default export. If no
 * consumer file is detected, the virtual module exports `{}` so the
 * import never throws.
 */
export function makeMdxComponentsVitePlugin(consumerPath: string | null) {
  return {
    name: 'book-scaffold:mdx-components',
    enforce: 'pre' as const,
    resolveId(id: string) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
      return null;
    },
    load(id: string) {
      if (id !== RESOLVED_ID) return null;
      if (consumerPath === null) {
        return 'export default {};';
      }
      // Re-export the default. Vite resolves consumerPath as an absolute
      // filesystem path; .astro files are processed by Astro's Vite plugin.
      return `export { default } from ${JSON.stringify(consumerPath)};`;
    },
  };
}

/**
 * Identity helper — consumers wrap their mdx-components map for TS inference.
 * Same pattern as Vite/Astro defineConfig: a generic identity function that
 * preserves the exact shape (vs widening to Record<string, …>).
 *
 *   export default defineMdxComponents({ AnkiCard, NarrativeBox });
 *
 * The generic constraint Record<string, unknown> is intentionally loose:
 * consumer components are `.astro` files whose runtime type
 * (AstroComponentFactory) lives in `astro/runtime/server/index.js` — not a
 * public Astro export, and importing from internals creates fragility. The
 * looser constraint lets the helper compile cleanly across Astro versions;
 * IntelliSense still surfaces exact keys.
 */
export function defineMdxComponents<T extends Record<string, unknown>>(
  components: T,
): T {
  return components;
}
