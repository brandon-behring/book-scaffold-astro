/**
 * profile-kit — internal helper for declaring book profiles.
 *
 * Each profile (academic, tools, minimal, course-notes, future paper-review,
 * etc.) lives in its own self-contained module under src/profiles/ and uses
 * defineProfile() to declare its schema + auto-injected routes + auto-loaded
 * styles. The PROFILES registry in src/profiles/index.ts wires them together;
 * bookScaffoldIntegration consumes the registry.
 *
 * defineProfile() is an identity function — same pattern as Vite's
 * defineConfig, Astro's defineConfig, Zod's z.object. Currently no generic
 * constraint on the schema parameter: per-profile inferred chapter types
 * are exported separately (AcademicChapter, ToolsChapter, etc.) via
 * `z.infer<typeof schema>`, so the registry doesn't need to track each
 * schema's exact shape. Keeping the schema typed as `unknown` here also
 * avoids tsup's DTS bundler dragging deep Zod internals into the .d.ts
 * (rollup-plugin-dts can't always resolve Zod's `default` export shape).
 *
 * Adding a new profile is a single-file change:
 *   1. Create src/profiles/<name>.ts (define schema + type + profile config).
 *   2. Register it in src/profiles/index.ts (one line in PROFILES + one line
 *      in ChapterFor<P>).
 *   3. (Optional) ship a default chapter route page under package/pages/.
 */

/**
 * The set of routes the toolkit can auto-inject. Per-profile defaults are
 * declared in each profile module; consumers override via
 * defineBookConfig({ routes: { … } }).
 *
 * The shape is fixed — adding a new auto-injected route requires updating
 * this type AND adding a default to every profile module. The trade-off is
 * worth it: consumers get TS autocomplete on the route names and TS errors
 * on typos like `convergance: false`.
 */
export interface RouteToggles {
  references: boolean;
  search: boolean;
  print: boolean;
  chapters: boolean;
  convergence: boolean;
}

/** Profile definition — declarative shape for one book profile. */
export interface ProfileDefinition {
  /** Stable name; must match the key in PROFILES + the BOOK_PROFILE env value. */
  name: string;
  /**
   * The Zod schema used as the chapter collection schema. Typed as
   * `unknown` here on purpose — per-profile inferred chapter types
   * (AcademicChapter, ToolsChapter, …) are exported separately and give
   * consumers the narrow typing where it matters. defineCollection
   * (in src/schemas-entry.ts) accepts the schema runtime-style.
   */
  schema: unknown;
  /** Auto-injected routes; consumers override via defineBookConfig({ routes }). */
  routes: RouteToggles;
  /** CSS basenames loaded for this profile (resolved from package/styles/). */
  styles: string[];
  /** Whether KaTeX should be wired in (academic profile only currently). */
  katex?: boolean;
}

/**
 * Identity helper for declaring a profile module.
 *
 *   export const courseNotesProfile = defineProfile({
 *     name: 'course-notes',
 *     schema: courseNotesChapterSchema,
 *     routes: { references: true, search: true, print: true, chapters: false, convergence: false },
 *     styles: ['tokens.css', ...],
 *   });
 *
 * No runtime work; the value goes through unchanged. Useful as a typed
 * "this is a profile" marker that catches missing required fields at
 * authoring time.
 */
export function defineProfile(p: ProfileDefinition): ProfileDefinition {
  return p;
}
