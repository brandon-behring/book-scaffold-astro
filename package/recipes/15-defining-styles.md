# Recipe 15 — Defining and composing Styles (v4.0.0+)

A **Style** is a typed, named, importable config bundle. Define a style once; import it into many books; override per-book explicitly.

This recipe replaces the v3 `preset: 'X'` shorthand with explicit composition. See `MIGRATION-v3-to-v4.md` for the migration steps.

---

## TL;DR

```ts
// shared/styles/research-guide.ts
import { defineStyle, researchPortfolioStyle } from '@brandon_m_behring/book-scaffold-astro';

export const researchGuideStyle = defineStyle({
  name: 'research-guide',
  site: 'https://guides.brandon-behring.dev/',
  routes: { frontmatter: { enabled: true, prefix: '' } },
  // Composes naturally: styles: [researchPortfolioStyle, researchGuideStyle]
});

// guides/foo/astro.config.mjs
import { defineBookConfig, researchPortfolioStyle } from '@brandon_m_behring/book-scaffold-astro';
import { researchGuideStyle } from '../shared/styles/research-guide.js';

export default await defineBookConfig({
  styles: [researchPortfolioStyle, researchGuideStyle],
  // any per-book overrides here
});
```

---

## What is a Style

A Style is an object containing config values, branded for type safety. The full type is documented in JSDoc on `defineStyle()`. All fields are optional:

```ts
defineStyle({
  name?: string;                     // for debug/error messages; optional
  preset?: 'academic' | 'tools' | ...; // determines schema + default routes + styles
  site?: string;
  routes?: PartialRouteToggles;      // per-route override (frontmatter widened to object form)
  katexMacros?: Record<string, string>;
  extraStyles?: readonly string[];
  extraIntegrations?: readonly AstroIntegration[];
  mdxComponentsModule?: string;
  markdown?: AstroUserConfig['markdown'];
  extra?: Record<string, unknown>;   // scoped consumer-side metadata
});
```

---

## Pattern A: workspace-local style

Use when you have many books in a workspace + a style cluster you don't yet need to publish externally.

**File**: `shared/styles/research-guide.ts` (or any path in your workspace)

**Import**: relative path from each consuming book.

```ts
import { researchGuideStyle } from '../../shared/styles/research-guide.js';
```

**Versioning**: git. The style is just code in your repo; edit it and rebuild downstream books.

**Pros**: zero ceremony, co-located with the books that use it, no npm publish.

**Cons**: doesn't help OTHER consumers (outside your workspace) reuse the style.

---

## Pattern B: separate npm package

Use when a style stabilizes + has interest beyond your workspace.

**Package**: e.g., `@brandon_m_behring/style-research-guides` (any name).

**Publish**: standard `npm publish`. Versioning via semver; consumers pin to `^1.0.0`.

**Import**: package name in each consuming book.

```ts
import { researchGuideStyle } from '@brandon_m_behring/style-research-guides';
```

**Pros**: cleanest cross-consumer sharing; semver versioning out-of-the-box.

**Cons**: heavyweight for a workspace-internal style; publishing overhead per release.

**Promotion path**: start every style as workspace-local (Pattern A). When a style stabilizes + an external consumer asks for it, promote to npm — only the import path changes; the Style object itself is unchanged.

---

## Composition: `styles: [...]` array

Multiple styles compose left-to-right. Later styles override earlier ones for conflicts.

```ts
defineBookConfig({
  styles: [baseStyle, brandStyle, projectStyle],
  // top-level fields here override anything from the styles
});
```

**Precedence (highest last)**:
1. Built-in style's defaults (e.g., `academicStyle.routes`)
2. `styles[0]`
3. `styles[1]`
4. ...
5. `styles[N]`
6. Top-level `defineBookConfig` fields

---

## Per-key merge strategy

Different fields have different merge semantics. Documented:

| Field | Strategy |
|---|---|
| `name`, `preset`, `site`, `mdxComponentsModule` | Shallow override (last defined wins) |
| `releaseStatus` | Shallow override (last defined object replaces the whole earlier object); `false` suppresses an inherited banner |
| `routes` | Per-route spread (each route key independently overridable) |
| `routes.frontmatter` | Per-route spread; later value (boolean OR object) wholly replaces earlier |
| `katexMacros` | Object spread (per-macro override) |
| `extra` | Object spread (per-key consumer-metadata override) |
| `extraStyles` | Array concat (additive — no dedup) |
| `extraIntegrations` | Array concat (additive) |
| `markdown.remarkPlugins` | Array concat (additive) |
| `markdown.rehypePlugins` | Array concat (additive) |

**Why arrays concat (not dedupe)**: matches Tailwind plugin arrays + ESLint flat config rules — one mental model: "arrays concat, non-arrays last-wins." If you compose styles that both list the same CSS file, you get it twice (browser dedups at parse time; benign in practice). If real consumer pain surfaces, we'll add a `dedupe: true` opt-in.

---

## Built-in styles

The toolkit ships one style per preset. Import individually or via the registry:

```ts
import {
  academicStyle,
  toolsStyle,
  minimalStyle,
  courseNotesStyle,
  researchPortfolioStyle,
  BUILTIN_STYLES,
} from '@brandon_m_behring/book-scaffold-astro';

// Direct import:
defineBookConfig({ styles: [researchPortfolioStyle], ... });

// Or via registry (useful for dynamic dispatch):
defineBookConfig({ styles: [BUILTIN_STYLES['research-portfolio']], ... });
```

Each built-in style has a `name` matching its preset and a `preset` field. In
v5, a valid preset must resolve from a Style, corpus manifest, environment, or
`.env`; there is no implicit `minimal` fallback. `create-book --preset` still
selects the initial `wrangler.toml`, after which the consumer owns that file.

---

## Escape hatch: consumer-side metadata via `extra`

Fields the toolkit knows about must be typed. For workflow-specific metadata that should travel with the style but isn't toolkit config, use the scoped `extra` field:

```ts
defineStyle({
  name: 'guides-v0.2',
  preset: 'research-portfolio',
  extra: {
    pedagogyTier: 'experimental',
    team: 'engineering',
    docsVersion: '0.2',
  },
});
```

- `extra` survives composition as per-key spread (later entries override earlier per key).
- The toolkit ignores `extra` entirely — it's for YOUR tooling (style linters, CI scripts, custom Astro integrations that read `style.extra.X`, etc.).
- This pattern preserves typo protection on known fields: `defineStyle({ presset: 'academic' })` errors at compile time because `presset` isn't `preset` and isn't `extra`.

---

## Forward compatibility (`__styleVersion`)

Every Style carries a `__styleVersion: 1` marker (set automatically by `defineStyle()`). Future API-shape changes can detect old Style objects and apply version-appropriate handling.

**You don't set it.** It's auto-applied. Don't read it in consumer code.

When v5 ships (whenever that is), `__styleVersion: 1` styles continue to work via internal adaptation. New Style features in v5+ may bump this marker.

---

## Feedback loop

v4 is fresh. The `defineStyle` API will evolve based on real friction reports.

**If you hit a wall** — composition pattern that doesn't compose, merge semantic that surprises you, type that won't infer, missing field — **file an issue at https://github.com/brandon-behring/book-scaffold-astro/issues** with:

- The `consumer:<your-workspace>` label (so we can batch reports from the same consumer)
- A minimal reproduction showing what you were trying to express
- What got in the way

The v4.x release line is explicitly the iteration window for this API. Use it.

---

## See also

- `MIGRATION-v3-to-v4.md` — step-by-step migration from v3 `preset:` shorthand
- `MIGRATION-v4-to-v5.md` — explicit preset and removed `deploy` migration
- `PACKAGE_DESIGN.md §4` — `defineBookConfig` API reference
- `PACKAGE_DESIGN.md §4a` — `defineStyle` API reference
- `recipes/12-where-to-file-issues.md` — the broader consumer-driven evolution loop this fits into
