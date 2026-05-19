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
