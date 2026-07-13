# Migrating from v3.x to v4.0.0

**Audience**: anyone using `@brandon_m_behring/book-scaffold-astro@^3.x`.

**TL;DR**: replace `preset: 'X'` with `styles: [XStyle]` in every `defineBookConfig` call. ~2 lines per book. Hard break — no shim.

---

## Why v4

The v3.x API accumulated through 7 consumer-pilot releases. Each release added one or two top-level `BookConfigOptions` fields to address a specific consumer ask (`routes`, `katexMacros`, `extraStyles`, `extraIntegrations`, ...). v4 unifies that surface around a typed `Style` composition: define a style once, import it across many books, override per-book explicitly.

Architectural principles (from the v4.0.0 design session):
- **Explicit over silent** — no profile-level magic defaults; every config decision visible in the call site or the imported style.
- **Extensible while brainstorming** — every Style field is optional; consumer-side metadata lives in the scoped `extra` field; new fields default to shallow override.
- **No legacy debt** — hard break at v4; sunset of v3 API is immediate.

Full v4.0.0 release notes: https://github.com/brandon-behring/book-scaffold-astro/releases/tag/v4.0.0

---

## What changed (BREAKING)

### 1. `preset:` / `profile:` removed from `defineBookConfig`

The v3 shorthand:

```ts
// ❌ v3 — no longer works
import { defineBookConfig } from '@brandon_m_behring/book-scaffold-astro';
export default await defineBookConfig({
  preset: 'research-portfolio',
  site: 'https://my-book.example/',
});
```

becomes the v4 explicit:

```ts
// ✅ v4
import { defineBookConfig, researchPortfolioStyle } from '@brandon_m_behring/book-scaffold-astro';
export default await defineBookConfig({
  styles: [researchPortfolioStyle],
  site: 'https://my-book.example/',
});
```

Calling `defineBookConfig` with the v3 fields throws a `BookConfigError` at runtime with an auto-suggested replacement showing the exact line to change + the import to add.

### 2. `routes.frontmatter` widened to `boolean | { enabled, prefix? }`

The boolean form keeps working. The object form (new in v4, closes #49) lets consumers control the route URL prefix:

```ts
// boolean form (v3-compatible, default prefix 'frontmatter')
defineBookConfig({ styles: [researchPortfolioStyle], routes: { frontmatter: true } })
// → routes mount at /frontmatter/<slug>

// object form (v4 new)
defineBookConfig({
  styles: [researchPortfolioStyle],
  routes: { frontmatter: { enabled: true, prefix: '' } },
})
// → routes mount at /<slug> (root, useful for /methodology, /about)
```

### 3. `deploy: 'pages' | 'workers'` field (reserved; deprecated)

The field was introduced as reserved metadata but was incorrectly documented
as driving `create-book`. It never did: the CLI writes `wrangler.toml` from the
`--preset` selected before the generated book's configuration exists. In v4 an
explicit top-level field prints a deprecation warning and changes nothing; remove
it before v5. Choose or edit the deployment file directly instead (#180).

### 4. `site` field is now optional at the type level

A Style in the `styles` chain can supply `site` (e.g., a shared `guides-family` style sets the workspace's common domain). Runtime validation still requires `site` to be set after composition.

### 5. `book-scaffold build-bib` defensive comment-stripping (#54)

`%`-comment lines containing `@TYPE` tokens (e.g., `% @article{...}`) are now stripped before being passed to `@citation-js/plugin-bibtex`. Closes the parse-error class that caused the v3.6.1 → v3.6.4 hotfix chain. **No consumer action needed**.

---

## Mechanical migration (one book at a time)

For each of your books using v3:

1. **Find the `defineBookConfig` call** in your `astro.config.mjs` (or `astro.config.ts`).
2. **Identify the preset value** — likely one of `academic`, `tools`, `minimal`, `course-notes`, `research-portfolio`.
3. **Update imports**: add the matching style export.
4. **Replace the field**: `preset: 'X'` → `styles: [XStyle]`.

| v3 `preset:` value | v4 style import | v4 styles array |
|---|---|---|
| `'academic'` | `academicStyle` | `styles: [academicStyle]` |
| `'tools'` | `toolsStyle` | `styles: [toolsStyle]` |
| `'minimal'` | `minimalStyle` | `styles: [minimalStyle]` |
| `'course-notes'` | `courseNotesStyle` | `styles: [courseNotesStyle]` |
| `'research-portfolio'` | `researchPortfolioStyle` | `styles: [researchPortfolioStyle]` |

Same table applies to the v3.4.0 `profile:` backward-compat alias — it's also removed in v4.

---

## Examples for each preset

### Academic

```diff
- import { defineBookConfig } from '@brandon_m_behring/book-scaffold-astro';
+ import { defineBookConfig, academicStyle } from '@brandon_m_behring/book-scaffold-astro';

  export default await defineBookConfig({
-   preset: 'academic',
+   styles: [academicStyle],
    site: 'https://my-book.example/',
  });
```

### Research-portfolio (with frontmatter prefix override)

```diff
- import { defineBookConfig } from '@brandon_m_behring/book-scaffold-astro';
+ import { defineBookConfig, researchPortfolioStyle } from '@brandon_m_behring/book-scaffold-astro';

  export default await defineBookConfig({
-   preset: 'research-portfolio',
+   styles: [researchPortfolioStyle],
    site: 'https://my-portfolio.example/',
+   // NEW: mount frontmatter pages at root (/methodology, /about, etc.)
+   routes: { frontmatter: { enabled: true, prefix: '' } },
  });
```

### Cross-book reuse (workspace pattern)

The biggest win in v4: define a shared style ONCE, import it across many books.

```ts
// shared/styles/guides-family.ts
import { defineStyle, researchPortfolioStyle } from '@brandon_m_behring/book-scaffold-astro';

export const guidesFamilyStyle = defineStyle({
  name: 'guides-family',
  // Composes on top of researchPortfolioStyle when used as
  // styles: [researchPortfolioStyle, guidesFamilyStyle]
  site: 'https://guides.brandon-behring.dev/',
  routes: { frontmatter: { enabled: true, prefix: '' } },
});
```

```ts
// guides/foo-guide/astro.config.mjs
import { defineBookConfig, researchPortfolioStyle } from '@brandon_m_behring/book-scaffold-astro';
import { guidesFamilyStyle } from '../shared/styles/guides-family.js';

export default await defineBookConfig({
  styles: [researchPortfolioStyle, guidesFamilyStyle],
  // No per-book site needed — guidesFamilyStyle provides it
  // (override here if this book needs a different domain)
});
```

See `recipes/15-defining-styles.md` for the full pattern catalog (workspace files vs npm packages, merge semantics, composition tips).

---

## Why no compatibility shim

Three reasons:

1. **Consumers are in early pilot phase.** All known consumers (`double-ml-time-series`, `claude-books`, `guides`, `guides-experimentation`, `book-template-astro`, `post-transformers`) are workspace siblings owned by the same maintainer; migration is ~2 lines per book.
2. **Avoid two-API-window debt.** Keeping the v3 `preset:` field functional through v4.x would mean every v4 release ships both APIs; consumers learn the wrong one if docs aren't perfect.
3. **Explicit principle.** v4's foundational design choice is "explicit over silent." A silent shim for v3 fields contradicts that principle.

If you can't migrate yet, **pin to `^3.7.1`**:

```json
{
  "dependencies": {
    "@brandon_m_behring/book-scaffold-astro": "^3.7.1"
  }
}
```

The v3.x line stays installable indefinitely; npm doesn't unpublish.

---

## Got friction?

v4 is fresh. The API will evolve based on real friction reports.

**File an issue** at https://github.com/brandon-behring/book-scaffold-astro/issues with:
- `consumer:<your-workspace>` label (so we can batch issues from the same consumer)
- The pattern you were trying to express
- What got in the way (cryptic error, missing field, awkward composition, etc.)

The v4.x release line is explicitly the iteration window for the `defineStyle` API. Use it.
