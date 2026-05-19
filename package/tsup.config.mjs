import { defineConfig } from 'tsup';

export default defineConfig({
  // Two entries (named for predictable dist layout): the public root and
  // the lib subpath exposed via package.json#exports.
  entry: {
    index: 'src/index.ts',
    schemas: 'src/schemas-entry.ts',
    'lib/katex-macros': 'src/lib/katex-macros.ts',
  },
  format: ['esm'],
  dts: true,
  outDir: 'dist',
  // Match the exports map (`./dist/index.mjs`, `./dist/lib/katex-macros.mjs`).
  outExtension: () => ({ js: '.mjs' }),
  clean: true,
  splitting: false,
  sourcemap: false,
  target: 'node22',
  // astro:* are virtual modules resolved by Astro's Vite layer at the
  // consumer's runtime; everything else here is a peer or peer-optional
  // dep the consumer installs themselves. Keeping these external is
  // what holds the bundle to ~5 KB instead of ~1 MB.
  external: [
    /^astro:/,
    'astro',
    'astro/zod',
    'astro/loaders',
    'astro/config',
    '@astrojs/mdx',
    '@astrojs/preact',
    'preact',
    'remark-math',
    'rehype-katex',
    'katex',
  ],
});
