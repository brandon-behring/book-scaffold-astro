import { defineConfig } from 'tsup';

export default defineConfig({
  // Two entries (named for predictable dist layout): the public root and
  // the lib subpath exposed via package.json#exports.
  entry: {
    index: 'src/index.ts',
    'lib/katex-macros': 'src/lib/katex-macros.ts',
  },
  format: ['esm'],
  dts: true,
  outDir: 'dist',
  clean: true,
  splitting: false,
  sourcemap: false,
  target: 'node22',
  // astro:* are virtual modules resolved by Astro's Vite layer at the
  // consumer's runtime; tsup must NOT try to bundle them.
  external: [/^astro:/, 'astro', 'astro/zod', 'astro/loaders', 'astro/config'],
});
