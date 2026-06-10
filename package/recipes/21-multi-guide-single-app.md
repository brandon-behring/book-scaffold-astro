# Recipe 21 — Multiple guides in one app (v4.20.0, #132)

**Profile**: any (proven on research-portfolio).

**TL;DR**: To host more than one guide/book in a single Astro app, keep ONE `chapters` collection rooted at `src/content/` and namespace every entry id by its guide folder via a `generateId` in the glob loader. The scaffold's existing rest-param route (`/chapters/[...slug]/`) then serves `/chapters/<guide>/<slug>/` for every guide with **no scaffold changes**. This is the blessed interim pattern until multibook (#15) ships first-class support.

## The pattern

Author each guide under its own folder:

```
src/content/
├── evaluation/
│   ├── 01-why-evaluation.mdx
│   └── ...
├── llm-app-engineering/
│   ├── 01-why-llm-app-engineering.mdx
│   └── ...
└── frontmatter/            ← shared, excluded below
```

Point the collection at the shared base and namespace ids by guide:

```ts
// src/content.config.ts
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { researchPortfolioChapterSchema } from '@brandon_m_behring/book-scaffold-astro/schemas';

const chapters = defineCollection({
  loader: glob({
    pattern: ['**/*.{md,mdx}', '!**/_*', '!frontmatter/**'],
    base: './src/content',
    generateId: ({ entry, data }) => {
      const guide = entry.split('/')[0];
      const slug =
        (data && data.slug) || entry.replace(/\.[^.]+$/, '').split('/').pop();
      return `${guide}/${slug}`; // → /chapters/<guide>/<slug>/
    },
  }),
  schema: researchPortfolioChapterSchema,
});

export const collections = { chapters };
```

The scaffold's auto-injected `pages/chapters/[...slug].astro` routes on `params: { slug: entry.id }` — a namespaced id rides through unchanged, so both guides render with zero route overrides.

## Gotcha 1 — the flat-slug footgun

**Without** the `generateId`, Astro's glob loader keys entry ids off the frontmatter `slug` (or filename) and routes FLAT at `/chapters/<slug>/`. That silently requires slugs to be **globally unique across all guides** — two guides each having an `introduction` chapter is a route collision, surfaced as a confusing router warning rather than a clear error. The `generateId` namespacing makes slugs only need uniqueness *within* a guide, which is what authors expect.

## Gotcha 2 — `validate` counts everything under the base

With `base: './src/content'`, `book-scaffold validate` walks the whole base — shared folders like `frontmatter/` are counted as "chapters" (e.g. `16 chapter(s)` for 13 + 2 real chapters + an authors page). The checks still run correctly per file; only the count is inflated. Excluding non-guide folders from the *loader* pattern does not affect the validator's walk. Guide-aware validation is part of the first-class multibook design (#15).

## Gotcha 3 — the `/chapters/` index mixes guides

The auto-injected `/chapters/` index lists every entry in the collection — i.e. all guides interleaved. If you want per-guide landing pages, add consumer-owned pages (e.g. `src/pages/evaluation/index.astro`) that `getCollection('chapters', (e) => e.id.startsWith('evaluation/'))`. A grouped-by-guide index is also on the #15 wishlist.

## When to expect first-class support

This recipe is the interim, zero-scaffold-change path. Issue [#15 (multibook)](https://github.com/brandon-behring/book-scaffold-astro/issues/15) tracks a `books`/`guides` registry that would emit per-guide indexes, a guides landing, and guide-scoped `validate`. It was deferred pending 2–3 independent consumers; `guides-ai-engineering` (#132) is the second — file your use case on #15 to add weight.

## Canonical files

- `package/pages/chapters/[...slug].astro` — the rest-param route that makes namespaced ids "just work"
- `package/scripts/walk-mdx.mjs` — `readChaptersBase` (how validate finds the base)
- `package/recipes/12-where-to-file-issues.md` — multi-book corpus routing is a known scaffold-issue category

## Reference implementation

`guides-ai-engineering` — two guides (Evaluation + LLM Application Engineering) on `@brandon_m_behring/book-scaffold-astro@4.14.2`; both `dist/chapters/evaluation/why-evaluation/index.html` and `dist/chapters/llm-app-engineering/why-llm-app-engineering/index.html` build from the scaffold's injected route.
