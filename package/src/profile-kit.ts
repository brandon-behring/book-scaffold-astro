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

import type { ChaptersRenderer } from './lib/chapters-renderer.js';

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
  /**
   * v4.5.0: auto-inject a minimal `/` landing page that reads the book's
   * `title`, `description`, and `portfolio` from defineBookConfig and
   * renders a route list (filtered to enabled routes). Defaults to `true`
   * on every profile. Consumers with their own `src/pages/index.astro` keep
   * their custom landing (file-system routes win over `injectRoute`). Set
   * to `false` to suppress the auto-injection entirely without writing
   * a custom landing.
   */
  landing: boolean;
  /**
   * v3.4.0 (closes #7): auto-inject `/frontmatter/[slug]/` rendering a
   * consumer-defined `frontmatter` content collection. Default `false` per
   * profile — opt in via defineBookConfig({ routes: { frontmatter: true } })
   * AND define the collection via `frontmatterCollection()` in content.config.ts.
   * If enabled without defining the collection, Astro errors clearly at build.
   */
  frontmatter: boolean;
  /**
   * v4.3.0 (closes #70): auto-inject `/tips` route listing all numbered
   * `<Tip>` instances from chapter MDX. Requires running
   * `book-scaffold build-tips` (via prebuild) which emits src/data/tips.json.
   * Default `false` per profile — opt in via
   * defineBookConfig({ routes: { tips: true } }).
   */
  tips: boolean;
  /**
   * v4.4.0: auto-inject `/exercises` route listing all `<Exercise id="...">`
   * instances from chapter MDX, grouped by chapter with deep links into
   * the chapter routes. Requires running `book-scaffold build-exercises`
   * (via prebuild) which emits src/data/exercises.json. Default `false` per
   * profile — opt in via defineBookConfig({ routes: { exercises: true } }).
   */
  exercises: boolean;
  /**
   * v4.17.0 (Tier 3, #112): auto-inject `/practice-exam` — a static practice
   * question-bank reading the `questions` content collection (src/content/
   * questions/**), grouped by domain with collapsible answers/rationale. Each
   * question's `domain` is validated against defineBookConfig({ examDomains })
   * at build (fail-loud). Default `false` per profile — opt in via
   * defineBookConfig({ routes: { practiceExam: true } }) AND add a
   * src/content/questions/ directory.
   */
  practiceExam: boolean;
  /**
   * v4.19.0 (#115): auto-inject `/glossary` — a searchable key-terms glossary
   * reading the `glossary` content collection (src/content/glossary/**), listed
   * alphabetically with id anchors the inline `<Term id>` links to. Default
   * `false` per profile — opt in via defineBookConfig({ routes: { glossary: true } })
   * AND add a src/content/glossary/ directory.
   */
  glossary: boolean;
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
  /**
   * v3.7.0 (closes #35): per-profile renderer for the /chapters route.
   * Owns the chapter-card meta-row composition, numbering format, sort key,
   * and ToolFilter wiring for this profile's data shape. Pure-function
   * strategy (no Astro imports — see src/lib/chapters-renderer.ts header).
   *
   * Optional: profiles that don't ship a dedicated renderer get the
   * fallbackChaptersRenderer (field-presence dispatch) at route render time.
   */
  chaptersRenderer?: ChaptersRenderer;
  /**
   * v4.6.0 (issue #76 Secondary): per-profile default sitemap filter.
   * Predicate run against every page URL by `@astrojs/sitemap` — return
   * true to include in sitemap, false to exclude.
   *
   * Defaults:
   *   academic + course-notes  → excludes `/print/` (print-friendly view,
   *                              crawl-redundant)
   *   tools + minimal + research-portfolio → omitted (include everything)
   *
   * Per D7 of the v4.6.0 plan: when a consumer sets
   * `defineBookConfig({ seo: { sitemap: { filter } } })`, the consumer's
   * filter REPLACES this profile default (not composed). Consumers wanting
   * to also exclude /print/ on top of additional exclusions copy the
   * profile-default predicate's behavior into their own filter.
   */
  sitemapFilter?: (page: string) => boolean;
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
