/**
 * Ambient type declarations for Astro virtual modules that the package
 * imports but does not resolve until the consumer's Astro runtime.
 *
 * tsup keeps these imports external (see tsup.config.mjs); at consumer
 * build time, Astro's Vite layer resolves them. Without these
 * declarations, tsup's DTS generation cannot compile the imports.
 */

declare module 'astro:content' {
  /** Loose surface — real types live in `.astro/content.d.ts` (consumer-side). */
  export function defineCollection<S = unknown>(config: {
    loader?: unknown;
    schema?: S;
  }): unknown;
}

/**
 * v4.6.0: Book-config virtual module surface (renamed from
 * `virtual:book-scaffold/landing-config` in v4.5.1). Resolved at consumer
 * build time by `makeBookConfigVitePlugin` (see integration.ts).
 *
 * Originally carried only landing-page data (title/description/portfolio/
 * enabledRoutes), but v4.6.0's SEO work added `seo` + `author` fields
 * consumed by `Base.astro` on every page — the name was renamed to reflect
 * the data's general book-level scope rather than landing-specific.
 *
 * Imported by `package/pages/index.astro` (landing) AND
 * `package/layouts/Base.astro` (every page) AND
 * `package/layouts/Chapter.astro` (article:author fallback).
 */
declare module 'virtual:book-scaffold/book-config' {
  const bookConfig: {
    title: string | null;
    description: string | null;
    portfolio: { url: string; label: string } | false;
    enabledRoutes: readonly string[];
    author: string | null;
    seo: {
      ogImage: string | null;
      twitterHandle: string | null;
    };
    /** v4.15.0 (#109): resolved GitHub repo for CodeRef/CodeBlock, or null. */
    githubRepo: string | null;
    githubBranch: string;
    /** v4.16.0 (#96): sibling-book base-URL registry for <BookLink>. */
    siblingBooks: Record<string, string>;
    /** v4.17.0 (#112): per-book exam-domain taxonomy for the questions collection. */
    examDomains: readonly string[];
  };
  export default bookConfig;
}
