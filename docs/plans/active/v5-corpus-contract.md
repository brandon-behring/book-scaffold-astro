# v5 corpus contract — one app, one build, multiple books

**Date:** 2026-07-13 · **Issue:** #80 · **Status:** accepted for implementation

This document is the design gate for the v5 corpus work. It defines the public
contract before route, schema, or tooling code lands. Later implementation may
change internal names, but it must not change the behavior below without an
explicit design amendment.

## Decision summary

- A corpus is one Astro application, one deployment, and one ordered registry
  of books.
- Every book in a corpus uses the same composed preset and Style chain in v5.
  Heterogeneous-profile corpora are intentionally deferred: Astro's Markdown
  pipeline and package integrations are application-wide, and neither current
  consumer needs a profile cross-product.
- Book identity comes from the first segment of a chapter entry id. Authors do
  not repeat a `book` discriminator in frontmatter.
- Recipe 21's public chapter URLs remain canonical:
  `/chapters/<book>/<slug>/`. First-class support adds
  `/chapters/<book>/` indexes and `/<book>/` landing pages without breaking
  already-deployed chapter links.
- Single-book applications keep their current routes and generated-data shapes.
  Corpus behavior is opt-in through a shared, branded manifest.
- Generated artifacts and diagnostics are book-scoped. No label, reference,
  readiness count, or previous/next relationship may bleed across books.
- Search remains one Pagefind index with a required `book` filter. The corpus
  search surface can search everything; a book surface starts scoped to its
  current book.

## Public configuration

Consumers define the corpus once in a Node-loadable module and import the same
object from both Astro configuration and content configuration:

```ts
// src/book-corpus.ts
import { defineBookCorpus } from '@brandon_m_behring/book-scaffold-astro';

export const corpus = defineBookCorpus({
  preset: 'research-portfolio',
  books: [
    {
      id: 'evaluation',
      title: 'Evaluation Engineering',
      description: 'How to evaluate production LLM systems.',
    },
    {
      id: 'llm-app-engineering',
      title: 'LLM Application Engineering',
      description: 'Patterns for dependable LLM applications.',
    },
  ],
});
```

```js
// astro.config.mjs
import {
  defineBookConfig,
  researchPortfolioStyle,
} from '@brandon_m_behring/book-scaffold-astro';
import { corpus } from './src/book-corpus.js';

export default defineBookConfig({
  site: 'https://guides.example.com',
  title: 'Engineering Guides',
  styles: [researchPortfolioStyle],
  corpus,
});
```

```ts
// src/content.config.ts
import { defineBookSchemas } from '@brandon_m_behring/book-scaffold-astro/schemas';
import { corpus } from './book-corpus';

export const { collections } = defineBookSchemas({ corpus });
```

The accepted type shape is:

```ts
interface BookCorpusInput {
  preset: BookPreset;
  books: readonly CorpusBookInput[];
}

interface CorpusBookInput {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  author?: string;
  image?: string;
  apparatus?: readonly ApparatusRoute[];
}
```

`defineBookCorpus` returns a frozen, branded value. It validates eagerly so
both config entrypoints fail with the same diagnostic.

### Manifest invariants

- `books` is non-empty and array order is navigation/display order.
- `id` is unique and matches `[a-z0-9]+(?:-[a-z0-9]+)*`.
- The ids `assets`, `chapters`, `search`, `_astro`, `_og`, and `pagefind` are
  reserved.
- `title` is non-blank.
- `apparatus` is a duplicate-free subset of the scaffold's known apparatus
  routes.
- The preset resolved from `defineBookConfig({ styles })` must equal
  `corpus.preset`. A mismatch is a configuration error, not a warning.
- Per-book Styles, presets, Markdown plugins, integrations, `site`, and `base`
  are not supported in v5. They are application-wide Astro concerns.

Top-level `title`, `description`, `author`, and `seo` describe or default the
corpus. A book's optional metadata overrides those values only while rendering
that book. The deployment `site` and Astro `base` always remain corpus-wide.

## Content identity and loader behavior

In corpus mode, `defineBookSchemas` defaults `chaptersBase` to
`./src/content`, matching Recipe 21. It builds one glob per registered book and
therefore never counts `frontmatter/` or another shared directory as chapters:

```text
src/content/
├── evaluation/
│   ├── 01-why-evaluation.mdx
│   └── 02-designing-evals.mdx
├── llm-app-engineering/
│   └── 01-architecture.mdx
└── frontmatter/                 # not part of chapters
```

The loader generates every entry id as `<book>/<slug>`:

- `<book>` is the registered first path segment.
- `<slug>` is explicit string frontmatter `slug` when present; otherwise it is
  the relative path below the book directory with its extension removed.
- A slug must be non-empty, must not begin or end with `/`, and may not contain
  `.` or `..` path segments.
- Two entries may share a slug in different books. Duplicate ids within one
  book fail content sync.

The path-derived book id is authoritative. Corpus schemas do not add a required
`book` frontmatter field, and the runtime does not accept a conflicting second
identity. Existing consumer-specific schemas may retain such a field during
migration, but validation requires it to match the entry-id prefix.

Questions, glossary entries, and other collection-backed apparatus use the
same `<book>/<local-id>` convention when corpus mode is active. A book without
that apparatus may omit its directory.

## Route table

All generated links are resolved through Astro's normalized `base`. The paths
below are shown without that deployment prefix and with trailing slashes.

| Surface | Pattern | `getStaticPaths` params | Source |
|---|---|---|---|
| Corpus landing | `/` | none | ordered manifest |
| Corpus chapter index | `/chapters/` | none | all books, grouped in manifest order |
| Book landing | `/[book]/` | `{ book }` | one path per manifest book |
| Book chapter index | `/chapters/[book]/` | `{ book }` | one path per manifest book |
| Chapter | `/chapters/[book]/[...slug]/` | `{ book, slug }` | one path per non-draft chapter |
| Corpus search | `/search/` | none | Pagefind, optional `?book=<id>` filter |
| Book apparatus | `/[book]/<route>/` | `{ book }` | books enabling that known route |

Chapter path props contain both the content `entry` and resolved manifest
`book`. The route rejects an entry whose id prefix is not registered. Book and
apparatus paths come only from the manifest; arbitrary URL values never become
content selectors.

The corpus defaults its href patterns to:

```text
chapterRoute   = /chapters/:id/
apparatusRoute = /:book/:route/
```

Those happen to preserve the Recipe 21 chapter route while making apparatus
book-specific. Explicit `chapterRoute`, `bookField`, or `apparatusRoute`
overrides are rejected in corpus mode because alternate patterns would make
the injected route table disagree with navigation. They remain supported for
v5 single-book applications and v4-style consumer-owned routing.

A consumer filesystem page wins over an injected page under Astro's normal
precedence rules. Overriding one corpus route makes the consumer responsible
for preserving the same params, canonical URL, Pagefind book metadata, and
base handling.

## Runtime book context and navigation

The integration exposes the frozen manifest and these pure operations through
the public entry and its virtual runtime config:

- resolve a manifest book by id;
- derive a book id from a collection entry id;
- select entries belonging to a book;
- resolve corpus, book, chapter, and apparatus hrefs.

Unknown book ids always throw an actionable error that names the source entry
or requested route.

On a book page, Sidebar, drawer navigation, previous/next chapter links,
apparatus links, headings, author defaults, and social metadata use the current
book context. The corpus landing and `/chapters/` index expose a book switcher.
The existing global `siblingBooks` registry remains for separately deployed
books. A key may not exist in both `corpus.books` and `siblingBooks`; duplicate
ownership is a configuration error rather than a precedence rule.

`<BookLink book="...">` resolves an in-corpus key to a base-relative local URL
and an external sibling key to its configured origin. #147 validates fragments
against the corresponding local or vendored label index; #80 does not duplicate
that validator.

## Generated artifacts and diagnostics

Corpus-mode build products keep their existing filenames but use a versioned
book envelope:

```json
{
  "schemaVersion": 1,
  "books": {
    "evaluation": {},
    "llm-app-engineering": {}
  }
}
```

This applies to labels/counters, references, tips, exercises, and later QA
results. A producer iterates books in manifest order; keys inside each book use
their existing deterministic ordering. A consumer must select a book before
looking up an unqualified label or local id. Cross-book lookup is explicit.

Single-book mode keeps the v4 file shapes and locations. Corpus mode is new in
v5, so its envelope does not require a legacy unscoped alias. Every CLI command
accepts `--book <id>` in corpus mode and defaults to all books. `--book` on a
single-book project is an invocation error.

Human diagnostics begin with `[book:<id>]`; JSON diagnostics include a required
`book` property. Corpus-level configuration failures use `book: null`. Counts
are emitted per book plus an explicitly named `corpus` aggregate; an aggregate
must never be presented as if it were a single book's readiness result.

## Search and indexing

One build produces one Pagefind index. Every indexable book page carries:

```html
<main data-pagefind-body data-pagefind-filter="book:evaluation">
```

The exact element may vary by layout, but both attributes are required. Corpus
landing content uses a separate `surface:corpus` filter and is not attributed
to an arbitrary book.

- `/search/` searches all books by default and accepts only registered
  `?book=<id>` values.
- Search launched from book chrome includes the current book filter; users can
  deliberately switch to all books or another manifest book.
- Pagefind result URLs are the built canonical URLs, including Astro `base`.
  No post-index URL rewriting is permitted.
- Navigation exposes the current book and a corpus switcher without mixing
  chapter lists.

## Compatibility and migration

### Existing single-book application

No corpus manifest is required. `/chapters/<slug>/`, `/chapters/`, flat
apparatus routes, schemas, and generated JSON remain as in v4. The v5 migration
still includes the deliberate #211 and #212 removals documented in the
roadmap, but #80 adds no single-book URL break.

### Recipe 21 application

1. Extract the ordered book metadata into `defineBookCorpus`.
2. Pass the same manifest to `defineBookConfig` and `defineBookSchemas`.
3. Remove the hand-written chapter collection and its custom `generateId`.
4. Keep book folders under `src/content/`, or set one explicit
   `chaptersBase` if the shared base lives elsewhere.
5. Remove consumer-owned per-book index pages after comparing their content
   with the injected pages.
6. Run all book-scaffold build commands and `validate`; migrate any script
   reading corpus generated JSON to the versioned `books` envelope.

Existing `/chapters/<book>/<slug>/` URLs do not change. No redirect layer is
needed for the blessed recipe.

## Boundaries with adjacent issues

- #147 owns validation of external sibling-book targets and fragments. The
  corpus resolver supplies local book identity but does not make #147 complete.
- #190 owns fail-loud detection of authored root-absolute internal links under
  a non-root base. Corpus routing does not rewrite authored MDX.
- #158 consumes the manifest, selectors, diagnostics, and artifact envelope to
  report readiness. Its interface is designed now and implemented after the
  v5 corpus core.
- #157 consumes resolved book/page identity for generated social cards. It is
  designed now and implemented after the v5 corpus core.
- #210's Anki authoring/export contract remains parked and out of scope.

## Implementation and release gates

The v5 implementation is complete only when:

1. the manifest and schema entrypoints reject every invariant above;
2. root- and subpath-base fixture builds prove every route in the table;
3. two books can reuse the same chapter slug and label without collision;
4. all build scripts and `validate` emit correctly scoped artifacts and
   diagnostics for one selected book and for the full corpus;
5. navigation, previous/next, apparatus, and Pagefind filters never cross books
   implicitly;
6. a v4 single-book fixture remains route- and artifact-compatible;
7. a Recipe 21 fixture migrates without changing its public chapter URLs; and
8. #211 and #212 ship with one reviewed v5 migration guide and lock-step package
   versions.

