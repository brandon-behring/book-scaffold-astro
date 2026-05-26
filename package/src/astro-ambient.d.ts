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
 * v4.5.1: Landing-config virtual module surface. Resolved at consumer build
 * time by `makeLandingConfigVitePlugin` (see integration.ts). Replaces the
 * v4.5.0 env-var pattern (`import.meta.env.BOOK_TITLE` etc.) which was
 * vulnerable to silent override by consumer `.env` files.
 *
 * Imported by `package/pages/index.astro`.
 */
declare module 'virtual:book-scaffold/landing-config' {
  const bookConfig: {
    title: string | null;
    description: string | null;
    portfolio: { url: string; label: string } | false;
    enabledRoutes: readonly string[];
  };
  export default bookConfig;
}
