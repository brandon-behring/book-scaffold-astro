// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

// The gallery is a STANDALONE style-guide app: it imports the package's
// components + design CSS directly and renders them with representative
// props, profile-agnostically. It deliberately does NOT use
// bookScaffoldIntegration (which needs the `virtual:book-scaffold/book-config`
// module + a `chapters` collection via Base.astro/Sidebar) — that machinery
// is for consumer *books*, not a component gallery.
export default defineConfig({
  integrations: [preact()],
  // #102: @fontsource-variable/* are .css entrypoints Vite externalizes for
  // SSR → `astro dev` 500s ("Unknown file extension .css"). Keep them in the
  // SSR bundle. (The scaffold's defineBookConfig does this for consumer books;
  // the gallery configures Astro directly, so it needs the same line.)
  vite: {
    ssr: {
      noExternal: ['@fontsource-variable/roboto', '@fontsource-variable/source-code-pro'],
    },
  },
});
