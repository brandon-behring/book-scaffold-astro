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
});
