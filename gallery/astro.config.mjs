// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

// The gallery is a STANDALONE style-guide app: it imports the package's
// components + design CSS directly and renders them with representative
// props, profile-agnostically. It deliberately does NOT use
// bookScaffoldIntegration (which needs the `virtual:book-scaffold/book-config`
// module + a `chapters` collection via Base.astro/Sidebar) — that machinery
// is for consumer *books*, not a component gallery.

// #109: CodeRef/CodeBlock now read `virtual:book-scaffold/book-config` for the
// resolved GitHub repo. The integration provides it for consumer books; the
// gallery supplies a minimal stub so those two components are galleryable
// (they were skipped before #109). Only githubRepo/githubBranch are consumed.
function galleryBookConfigPlugin() {
  const virtualId = 'virtual:book-scaffold/book-config';
  const resolvedId = '\0' + virtualId;
  const config = {
    title: 'Gallery',
    subtitle: null,
    description: null,
    portfolio: false,
    enabledRoutes: [],
    author: null,
    seo: { ogImage: null, twitterHandle: null },
    githubRepo: 'brandon-behring/book-scaffold-astro',
    githubBranch: 'main',
    // #96: sibling-book registry so <BookLink> is galleryable.
    siblingBooks: { design: 'https://design.example' },
  };
  return {
    name: 'gallery:book-config',
    enforce: /** @type {const} */ ('pre'),
    resolveId(/** @type {string} */ id) {
      return id === virtualId ? resolvedId : null;
    },
    load(/** @type {string} */ id) {
      return id === resolvedId ? `export default ${JSON.stringify(config)};` : null;
    },
  };
}

export default defineConfig({
  integrations: [preact()],
  // #102: @fontsource-variable/* are .css entrypoints Vite externalizes for
  // SSR → `astro dev` 500s ("Unknown file extension .css"). Keep them in the
  // SSR bundle. (The scaffold's defineBookConfig does this for consumer books;
  // the gallery configures Astro directly, so it needs the same line.)
  vite: {
    plugins: [galleryBookConfigPlugin()],
    ssr: {
      noExternal: ['@fontsource-variable/roboto', '@fontsource-variable/source-code-pro'],
    },
  },
});
