# Recipe 17 — Draft chapter workflow (v4.3.0+)

The scaffold ships a `draft: boolean` field on every chapter schema (default `false`). Chapters with `draft: true` are filtered out by the canonical chapter-list and per-chapter routes — they exist in `src/content/chapters/` but don't render. Closes [#68](https://github.com/brandon-behring/2-scaffold-astro/issues/68).

## TL;DR

```yaml
---
title: "My in-progress chapter"
week: 4
part: foundations
status: scaffolded
draft: true   # ← Chapter is invisible while draft: true. Flip to false to publish.
---
```

## The filter

Both the scaffold-injected `/chapters/` index AND the auto-injected per-chapter route `/chapters/[...slug]/` (new in v4.3.0; see [#69](https://github.com/brandon-behring/2-scaffold-astro/issues/69)) filter via:

```ts
await getCollection('chapters', (entry) => !entry.data.draft);
```

So a `draft: true` chapter:
- Does **not** appear in `/chapters/`
- Does **not** get a `/chapters/<slug>/` route
- Does **not** appear in nav / TOC
- DOES exist in the source tree (still validated by `book-scaffold validate`; still scanned by `book-scaffold build-labels`)

This is by design: keeps in-progress work under version control without polluting the production build.

## Schema definition

All 5 built-in chapter schemas define `draft`:

```ts
// package/src/schemas.ts (academic + tools + minimal + course-notes + research-portfolio)
draft: z.boolean().default(false),
```

The default is `false` — chapters publish by default. Authors flip to `true` to hide a work-in-progress.

## When to use draft

- **Active drafting** — writing a chapter over multiple sessions; don't want intermediate states deployed.
- **Outline-stage chapters** — frontmatter exists but body is just a TODO list.
- **Migration in progress** — porting from another source format (LaTeX, Docs, etc.); keep the partial port in-tree but invisible.

When you're ready to publish, edit the frontmatter to `draft: false` (or delete the line — default is false).

## When NOT to use draft

- **Deleting a chapter** — if you no longer want it at all, delete the file. `draft: true` is for chapters that ARE coming back to live.
- **Reordering** — `draft` doesn't affect chapter ordering. To rearrange chapters, edit the `week:` / `part:` / `chapter:` frontmatter fields (the field varies by preset).
- **Section-level hiding** — `draft` is whole-chapter only. To hide a section within a published chapter, comment it out in MDX or use a build-time conditional.

## Previewing draft chapters during development

The default canonical filter excludes drafts in BOTH `npm run dev` and `npm run build`. To preview a draft locally without publishing it:

**Option A** (transient): temporarily flip the chapter to `draft: false`, run `npm run dev`, then flip back before committing.

**Option B** (recommended): scope the filter to honor an env var in your `src/pages/chapters/[...slug].astro` (only relevant if you've ejected from the scaffold's auto-injected route):

```ts
const includeDrafts = import.meta.env.BOOK_INCLUDE_DRAFTS === '1';
const chapters = await getCollection('chapters', (entry) =>
  includeDrafts || !entry.data.draft
);
```

Then run `BOOK_INCLUDE_DRAFTS=1 npm run dev` for the draft-inclusive preview. This is NOT shipped in the scaffold's auto-route (would muddy the production behavior); add it to a consumer-owned override file if you need it.

## Common gotchas

- **Silent zero-chapters build** — if EVERY chapter has `draft: true` (or no chapters are published yet), `/chapters/` renders an empty list and no `/chapters/<slug>/` routes generate. Build succeeds with no warnings. Diagnosis: check `npx book-scaffold validate` output — it reports the total `chapter(s) checked` regardless of draft status, so you'll see "5 chapter(s) checked" even when no chapters render.
- **Author's intent vs filter behavior** — early Phase-1 chapter authoring sessions sometimes catch this: chapter is fully written, frontmatter looks right, but it doesn't render. First check: `grep '^draft:' src/content/chapters/*.mdx` to find drafts. Time-to-diagnosis tax averages ~20 min per consumer per session until they remember the filter exists. This recipe is the discoverability fix.

## See also

- `recipes/01-create-book.md` — full scaffold getting-started flow
- `recipes/09-validation.md` — `book-scaffold validate` semantics (which DON'T honor the draft filter)
- `PACKAGE_DESIGN.md §5` — `defineBookSchemas` API (where the draft field lives)

## Feedback

If the filter behavior surprises you in a new way or you want a different draft-preview UX (e.g., a `BOOK_INCLUDE_DRAFTS` env in the scaffold's auto-route by default), file an issue at https://github.com/brandon-behring/book-scaffold-astro/issues with the `consumer:<workspace>` label.
