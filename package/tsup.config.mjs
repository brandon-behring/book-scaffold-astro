import { defineConfig } from 'tsup';

export default defineConfig({
  // Two entries (named for predictable dist layout): the public root and
  // the lib subpath exposed via package.json#exports.
  entry: {
    index: 'src/index.ts',
    schemas: 'src/schemas-entry.ts',
    'lib/katex-macros': 'src/lib/katex-macros.ts',
    // Standalone lean entry: scripts/build-labels.mjs imports the kind
    // vocabulary from here (theorem-label.ts has zero deps), so the build
    // script reuses the ONE KIND_LABEL source without pulling the whole
    // barrel (citation-js/yaml) into a plain-node process. (#126)
    'lib/theorem-label': 'src/lib/theorem-label.ts',
    // Pre-compile the .tsx islands so consumers don't have to depend on
    // Vite's JSX transform reaching into node_modules. Without this,
    // SSR breaks with `ReferenceError: React is not defined`.
    'components/ToolFilter': 'components/ToolFilter.tsx',
    'components/VersionSelector': 'components/VersionSelector.tsx',
  },
  esbuildOptions(options) {
    options.jsx = 'automatic';
    options.jsxImportSource = 'preact';
  },
  format: ['esm'],
  // dts.resolve inlines cross-entry types into each entry's .d.ts so tsup
  // doesn't emit a shared `types-<hash>.d.ts` file that leaks into the
  // published tarball.
  dts: { resolve: true },
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
