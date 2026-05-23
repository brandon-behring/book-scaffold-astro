/**
 * src/lib/define-style.ts — `defineStyle` API + composition (v4.0.0).
 *
 * Closes #35 followup architecture work. A `Style` is a typed, named,
 * importable config bundle that consumers can compose across many books
 * in the same cluster. Replaces the v3.x `preset` field as the primary
 * way to configure a book.
 *
 * Design principles (D6 + D12 from the v4.0.0 plan):
 *   - Pure data (no Astro virtual modules) — safe for tsup's DTS bundle,
 *     same constraint as src/lib/chapter-sort.ts (v3.5.2).
 *   - Every field optional — composition fills gaps; no required fields
 *     means new fields are always additive.
 *   - Branded type — prevents confusion with plain Partial<BookConfigOptions>
 *     even though they're structurally close.
 *   - Closed shape for known fields (no `[key: string]: unknown` index
 *     signature) — catches typos at compile time (the v3 `convergance`
 *     lesson, see PR #9 v3.4.0).
 *   - Scoped escape hatch via `extra?: Record<string, unknown>` — consumer-
 *     side metadata can travel with the style without breaking typo
 *     protection on toolkit-known fields.
 *   - Readonly throughout — Style objects are immutable DTOs.
 *   - Version marker (`__styleVersion`) — future API-shape changes can
 *     be detected at composition time without breaking existing styles.
 *
 * See `recipes/15-defining-styles.md` for usage patterns + MIGRATION-v3-to-v4.md
 * for migration from the v3 `preset:` shorthand.
 */
import type { AstroIntegration, AstroUserConfig } from 'astro';
import type { BookPreset, RouteToggles } from '../types.js';

// ===== Branded nominal type =====

/** Internal brand symbol — prevents confusion between Style and plain config objects.
 *  TYPE-ONLY: `declare const` means there's no runtime value. The brand exists
 *  purely at compile time as a structural guard: TypeScript will reject a plain
 *  `Partial<BookConfigOptions>` where a `Style` is expected, because the brand
 *  key isn't present in the plain object's type. At runtime, Style is just an
 *  object with `__styleVersion: 1` — no Symbol keys to enumerate or test for. */
declare const StyleBrand: unique symbol;

// ===== Widened route toggles =====

/**
 * Widened form of the frontmatter route config (closes #49).
 * Pre-v4 was just `boolean`; v4 supports an object form with `prefix` so
 * consumers can mount frontmatter pages at root (`prefix: ''` → `/[slug]`)
 * or under a custom prefix (`prefix: 'pages'` → `/pages/[slug]`).
 *
 * Default prefix (when unset OR when boolean `true` is used): `'frontmatter'`,
 * matching the v3 behavior.
 */
export type FrontmatterRouteConfig =
  | boolean
  | {
      readonly enabled: boolean;
      readonly prefix?: string;
    };

/**
 * Partial route toggles for use inside Style. Same shape as `Partial<RouteToggles>`
 * except `frontmatter` is widened to `FrontmatterRouteConfig` (closes #49).
 */
export type PartialRouteToggles = Partial<Omit<RouteToggles, 'frontmatter'>> & {
  readonly frontmatter?: FrontmatterRouteConfig;
};

// ===== Style type =====

/**
 * A typed config bundle. Composed via `styles: [...]` in `defineBookConfig`.
 *
 * All fields are optional and immutable. Use `defineStyle()` to create a
 * Style with proper branding + version marker.
 *
 * For consumer-side metadata that should travel with the style but isn't
 * toolkit configuration, use the scoped `extra` field rather than adding
 * unknown top-level fields (which the closed shape rejects).
 */
export interface Style {
  /** @internal Brand for nominal typing. Set by defineStyle(); not observable. */
  readonly [StyleBrand]: true;
  /** @internal Version marker for future API-shape evolution. Set by defineStyle(). */
  readonly __styleVersion: 1;

  /** Optional human-readable name; surfaces in debug output and error messages.
   *  Anonymous styles fall back to their index in the composition chain. */
  readonly name?: string;

  /** Profile that backs this style — determines schema + default routes + styles + KaTeX wiring. */
  readonly preset?: BookPreset;

  /** Book's deployed origin (sitemap, canonical, Pagefind). Required at composition end;
   *  optional inside a Style (so styles can omit it and consumers can provide per-book). */
  readonly site?: string;

  /** Per-route override; merges per-key across the style chain. */
  readonly routes?: PartialRouteToggles;

  /** Consumer-defined KaTeX macros, shallow-merged per macro across the style chain.
   *  Closes #22 (v3.6.0); same merge semantics. */
  readonly katexMacros?: Readonly<Record<string, string>>;

  /** CSS basenames injected in addition to the profile-resolved set.
   *  Composed via array concat (additive). */
  readonly extraStyles?: readonly string[];

  /** Appended to the package-provided integration list.
   *  Composed via array concat (additive). */
  readonly extraIntegrations?: readonly AstroIntegration[];

  /** Explicit path to consumer's mdx-components map (relative to project root).
   *  Last non-undefined value wins across the chain. */
  readonly mdxComponentsModule?: string;

  /** Spread-merged into the package-provided markdown config.
   *  `remarkPlugins` and `rehypePlugins` arrays concat across the chain;
   *  scalar fields override. */
  readonly markdown?: AstroUserConfig['markdown'];

  /** Deploy target — drives create-book's wrangler.toml shape.
   *  - `'workers'`: Cloudflare Workers + Static Assets (default for academic/tools/minimal)
   *  - `'pages'`: Cloudflare Pages (default for research-portfolio/course-notes)
   *  Closes #50. */
  readonly deploy?: 'pages' | 'workers';

  /**
   * Scoped consumer-side metadata. Ignored by the toolkit; survives composition
   * as per-key spread (last wins per key). Use this for workflow data that
   * should travel with the style but isn't toolkit config.
   *
   * @example
   *   defineStyle({
   *     name: 'guides-family',
   *     preset: 'research-portfolio',
   *     extra: { pedagogyTier: 'experimental', team: 'engineering' },
   *   })
   */
  readonly extra?: Readonly<Record<string, unknown>>;
}

/** Input type for `defineStyle()`: same as Style, minus the internal brand + version fields. */
export type StyleInput = Omit<Style, typeof StyleBrand | '__styleVersion'>;

// ===== defineStyle helper =====

/**
 * Create a Style — a typed, named, importable config bundle.
 *
 * Identity function with auto-applied brand + version marker. Zero runtime
 * overhead beyond object spread.
 *
 * @example workspace-local style
 *   // shared/styles/guides-family.ts
 *   import { defineStyle } from '@brandon_m_behring/book-scaffold-astro';
 *   export const guidesFamilyStyle = defineStyle({
 *     name: 'guides-family',
 *     preset: 'research-portfolio',
 *     site: 'https://guides.brandon-behring.dev/',
 *     routes: { frontmatter: { enabled: true, prefix: '' } },
 *     deploy: 'pages',
 *   });
 *
 *   // guides/foo/astro.config.mjs
 *   import { defineBookConfig } from '@brandon_m_behring/book-scaffold-astro';
 *   import { guidesFamilyStyle } from '../shared/styles/guides-family';
 *   export default await defineBookConfig({
 *     styles: [guidesFamilyStyle],
 *     site: 'https://foo.guides.brandon-behring.dev/',  // overrides style's site
 *   });
 *
 * @example built-in style composition
 *   import { defineBookConfig, researchPortfolioStyle } from '@brandon_m_behring/book-scaffold-astro';
 *   export default await defineBookConfig({
 *     styles: [researchPortfolioStyle],
 *     site: 'https://my-book.example/',
 *   });
 *
 * See `recipes/15-defining-styles.md` for the full pattern catalog.
 */
export function defineStyle(opts: StyleInput): Style {
  return { __styleVersion: 1, ...opts } as Style;
}

// ===== composeStyles =====

/**
 * Merge an array of Styles into a single resolved Style.
 *
 * Composition order (precedence ascending — last wins for conflicts):
 *   - Earlier styles in the array set defaults
 *   - Later styles override earlier
 *   - Top-level `defineBookConfig` fields beat any style (handled in config.ts)
 *
 * Per-key merge strategy:
 *   - `preset`, `site`, `deploy`, `mdxComponentsModule`, `name` → shallow override (last wins)
 *   - `routes` → per-route spread (each route key independently overridable)
 *   - `katexMacros` → per-macro spread (each macro key independently overridable)
 *   - `extra` → per-key spread (consumer metadata accumulates across the chain)
 *   - `extraStyles`, `extraIntegrations` → array concat (additive; no dedup)
 *   - `markdown` → spread, with `remarkPlugins` and `rehypePlugins` arrays concat
 *
 * @returns a fully-typed Style representing the composed configuration.
 *   Empty input returns an empty Style with no fields set (all undefined).
 */
export function composeStyles(styles: readonly Style[]): Style {
  if (styles.length === 0) {
    return defineStyle({});
  }

  const merged: Record<string, unknown> = {};

  for (const style of styles) {
    // Shallow override for primitives + readonly-scalar fields.
    if (style.name !== undefined) merged.name = style.name;
    if (style.preset !== undefined) merged.preset = style.preset;
    if (style.site !== undefined) merged.site = style.site;
    if (style.deploy !== undefined) merged.deploy = style.deploy;
    if (style.mdxComponentsModule !== undefined) {
      merged.mdxComponentsModule = style.mdxComponentsModule;
    }

    // Per-route spread.
    if (style.routes !== undefined) {
      merged.routes = {
        ...((merged.routes as PartialRouteToggles | undefined) ?? {}),
        ...style.routes,
      };
    }

    // Per-macro spread.
    if (style.katexMacros !== undefined) {
      merged.katexMacros = {
        ...((merged.katexMacros as Record<string, string> | undefined) ?? {}),
        ...style.katexMacros,
      };
    }

    // Per-key spread for consumer metadata.
    if (style.extra !== undefined) {
      merged.extra = {
        ...((merged.extra as Record<string, unknown> | undefined) ?? {}),
        ...style.extra,
      };
    }

    // Array concat for additive fields.
    if (style.extraStyles !== undefined) {
      const prev = (merged.extraStyles as readonly string[] | undefined) ?? [];
      merged.extraStyles = [...prev, ...style.extraStyles];
    }
    if (style.extraIntegrations !== undefined) {
      const prev =
        (merged.extraIntegrations as readonly AstroIntegration[] | undefined) ?? [];
      merged.extraIntegrations = [...prev, ...style.extraIntegrations];
    }

    // markdown: spread with array-concat for the two plugin arrays.
    if (style.markdown !== undefined) {
      const prev = (merged.markdown as AstroUserConfig['markdown'] | undefined) ?? undefined;
      merged.markdown = mergeMarkdown(prev, style.markdown);
    }
  }

  return defineStyle(merged as StyleInput);
}

/**
 * Merge two `markdown` config blocks. Scalar fields override (last wins);
 * `remarkPlugins` and `rehypePlugins` arrays concat (additive — same
 * semantics as `extraStyles` / `extraIntegrations`).
 */
function mergeMarkdown(
  a: AstroUserConfig['markdown'] | undefined,
  b: AstroUserConfig['markdown'] | undefined,
): AstroUserConfig['markdown'] {
  if (!a) return b;
  if (!b) return a;
  return {
    ...a,
    ...b,
    remarkPlugins: [...(a.remarkPlugins ?? []), ...(b.remarkPlugins ?? [])],
    rehypePlugins: [...(a.rehypePlugins ?? []), ...(b.rehypePlugins ?? [])],
  };
}

// ===== Normalization helpers =====

/**
 * Normalize the widened `routes.frontmatter` value to its object form for
 * downstream use. `true` → `{ enabled: true }`, `false` → `{ enabled: false }`,
 * object → returned as-is.
 *
 * Used by the integration when computing the route URL pattern from the prefix.
 */
export function normalizeFrontmatterConfig(
  v: FrontmatterRouteConfig | undefined,
): { enabled: boolean; prefix?: string } | undefined {
  if (v === undefined) return undefined;
  if (typeof v === 'boolean') return { enabled: v };
  return v;
}
