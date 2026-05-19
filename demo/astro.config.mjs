// @ts-check
/**
 * astro.config.mjs — profile-aware Astro configuration for book-scaffold-astro.
 *
 * BOOK_PROFILE env var (Q1 locked, see PROFILES_DESIGN.md §2) wires
 * profile-specific integrations and markdown plugins:
 *   academic — KaTeX math (remark-math + rehype-katex) with strict mode
 *   tools    — no math; default config
 *   minimal  — no math; default config (fallback when env var unset)
 *
 * Authors can override per-book in their fork's astro.config.mjs.
 */
import { defineConfig } from 'astro/config';

import mdx from '@astrojs/mdx';
import preact from '@astrojs/preact';

const profile = process.env.BOOK_PROFILE ?? 'minimal';

const remarkPlugins = [];
const rehypePlugins = [];

if (profile === 'academic') {
  // Dynamic imports + ssmMacros assignment at top-level — keeps the
  // minimal/tools profiles from materialising KaTeX in the dep graph
  // unnecessarily. (Astro still bundles based on imports actually used.)
  const { default: remarkMath } = await import('remark-math');
  const { default: rehypeKatex } = await import('rehype-katex');
  const { ssmMacros } = await import('./src/lib/katex-macros.ts');
  remarkPlugins.push(remarkMath);
  rehypePlugins.push([
    rehypeKatex,
    {
      // Strict mode: build fails on undefined macros, malformed
      // expressions, unsupported AMS environments. Trades developer
      // pain at write-time for catching errors before deploy.
      strict: 'error',
      trust: true,
      macros: ssmMacros,
    },
  ]);
}

// https://astro.build/config
export default defineConfig({
  integrations: [mdx(), preact()],
  markdown: {
    shikiConfig: {
      // css-variables mode: Shiki emits CSS custom properties
      // (--astro-code-*) which map to the Warm Tol palette in
      // src/styles/tokens.css. Lets code blocks use different colors
      // in light vs dark mode without rebuilding the site.
      theme: 'css-variables',
      wrap: false,
    },
    remarkPlugins,
    rehypePlugins,
  },
});
