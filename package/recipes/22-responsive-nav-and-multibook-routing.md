# Recipe 22 — Responsive navigation & custom routing (v4.26.0, #80)

> **v5 corpus applications:** use
> [Recipe 21](./21-multi-guide-single-app.md) and `defineBookCorpus`. Corpus
> mode owns `chapterRoute`, `bookField`, `apparatusRoute`, and
> `apparatusRoutes`; the custom fields below remain for single-book applications
> and consumer-owned v4-style routes.

The scaffold's navigation (left `Sidebar`, prev/next `ChapterNav`) is **book-aware**
and **responsive**: it serves a single-book site unchanged, a multi-book consumer
(one Astro app at `/<book>/<slug>/`) correctly, and adds a mobile/tablet drawer.

## Single-book — zero config (byte-identical)

Do nothing. The defaults reproduce the pre-4.26 behavior:

- chapter links are `${BASE_URL}chapters/<id>/`,
- the sidebar lists every chapter, prev/next walk the full collection,
- you additionally get a **mobile drawer** for free (hamburger in the chrome row,
  below 80rem), where the auto-hidden sidebar previously left no nav.

## Multi-book — four `defineBookConfig` fields

For a consumer that owns `/[book]/[...chapter]` routing and serves chapters at
`/<book>/<slug>/` (each chapter's `entry.id` is `'<book>/<slug>'` and carries a
`book` frontmatter field):

```js
// astro.config.mjs
export default await defineBookConfig({
  // … styles, routes, etc. …
  chapterRoute: '/:id/',                 // entry.id is '<book>/<slug>' → '/<book>/<slug>/'
  bookField: 'book',                     // scope sidebar/drawer/prev-next to the current book
  apparatusRoute: '/:book/:route/',      // → '/<book>/practice-exam/', etc.
  apparatusRoutes: ['practice-exam', 'glossary', 'flashcards', 'answers'],
});
```

Tokens (base-relative; `BASE_URL` is applied for you):

| token   | value                                   |
|---------|-----------------------------------------|
| `:id`   | `entry.id` verbatim (slashes kept)      |
| `:book` | the entry's book (`bookField`), or `''` |
| `:slug` | `entry.id` minus the leading `<book>/`  |
| `:route`| an apparatus route slug                 |

The nav then:

- lists **only the current book's** chapters (the current book is derived from the
  URL's first path segment, validated against the books that exist),
- emits `/<book>/<slug>/` links and highlights the current chapter (`aria-current`),
- keeps prev/next **within the current book** (`getNeighbors` is book-scoped),
- surfaces the per-book apparatus links from `apparatusRoutes`.

**Landing pages** (a multi-book corpus front door) should pass
`showSidebar={false}` to `Base` — there is no "current book" there, so the chapter
nav would otherwise fall back to the single-book all-chapters list.

## The mobile/tablet drawer

Below **80rem (1280px)** the full 3-column layout doesn't fit beside the sidebar,
so the sidebar is replaced by a slide-in **drawer** reached from a hamburger in
the chrome row. It reuses `NavContent` (the same book-scoped nav), is a
`role="dialog"` with focus-trap / ESC / backdrop close (an inline controller in
`Base.astro`), and degrades to a `:target` CSS open with **no JS**. Nothing to
configure — it appears automatically wherever the sidebar is enabled.

## The Tufte right-gutter ("on this page" scrollspy)

The floated gutter scrollspy (`SectionMap`) + sidenotes need room the sidebar
steals, so the **full 3-column activates at ≥80rem (1280px)**. Below that the
drawer is the nav and the collapsed in-flow `ChapterTOC` is the "on this page".
The shared text measure (`--measure-main` / `--measure-side`, `tokens.css`) is
tuned so `main + gutter` fits inside `viewport − sidebar` at every desktop width
— the scrollspy **fits**, it is not hidden. (BC note: single-book sidebar
consumers see the sidebar + scrollspy from 1280px up, was 1024px, with a slightly
narrower body measure.)

## Owning your own route components

The resolver is exported for consumers who render their own nav (recipe 18):

```ts
import { chapterHref, apparatusHref, bookOf, isCurrentChapter }
  from '@brandon_m_behring/book-scaffold-astro';
```

Pure functions, no `astro:content` — pass a `{ id, data }` and the same
`chapterRoute` / `bookField` you set in `defineBookConfig`.

`book-scaffold build-labels` evaluates those same two fields and routes every
component and h2–h6 heading entry through `chapterHref`. A root- or multi-book
site's vendored cross-book index therefore describes its real routes rather
than silently falling back to `/chapters/<id>/`.

## Verify

A consumer should drive a cross-device audit (Playwright is ideal): for each rich
page across `{390, 768, 1024, 1440}` × `{light, dark}`, assert no horizontal page
overflow (`scrollWidth ≤ clientWidth`), a visible sidebar ≥1280 / hamburger+drawer
below, and that no nav link points outside the current book. See the
`dlai-study-notes` consumer's `tests/responsive.spec.ts` for a worked harness.
