// @ts-check
import { defineConfig } from 'astro/config';

import mdx from '@astrojs/mdx';

import preact from '@astrojs/preact';

// https://astro.build/config
export default defineConfig({
  integrations: [mdx(), preact()],
  markdown: {
    shikiConfig: {
      // css-variables mode: Shiki emits CSS custom properties
      // (--astro-code-*) which are mapped to the Warm Tol palette in
      // src/styles/tokens.css. Lets the same code block use different
      // colors in light vs dark mode without rebuilding the site.
      theme: 'css-variables',
      wrap: false,
    },
  },
});