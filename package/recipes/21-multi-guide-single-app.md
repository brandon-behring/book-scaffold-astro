# Recipe 21 — One app, multiple books with `defineBookCorpus` (v5, #80)

**Profile**: any, provided every book uses the same preset and Style chain.

**TL;DR**: Define one ordered, branded corpus manifest and pass the same object
to `defineBookConfig` and `defineBookSchemas`. Put chapters beneath
`src/content/<book>/`. The scaffold derives book identity from that path,
injects corpus and per-book routes, scopes navigation/search/generated data,
and preserves the established `/chapters/<book>/<slug>/` URL.

## Define the corpus once

Keep the manifest in a Node-loadable module shared by both configuration
entrypoints:

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
      apparatus: ['references', 'glossary'],
    },
    {
      id: 'llm-app-engineering',
      title: 'LLM Application Engineering',
      description: 'Patterns for dependable LLM applications.',
      // apparatus omitted: inherit the application-enabled apparatus set
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

export default await defineBookConfig({
  site: 'https://guides.example.com',
  title: 'Engineering Guides',
  styles: [researchPortfolioStyle],
  routes: {
    glossary: true,
    practiceExam: true,
  },
  corpus,
});
```

```ts
// src/content.config.ts
import { defineBookSchemas } from '@brandon_m_behring/book-scaffold-astro/schemas';
import { corpus } from './book-corpus.js';

export const { collections } = defineBookSchemas({ corpus });
```

The manifest is an explicit preset source. If a composed Style also supplies a
preset, it must match `corpus.preset`. Presets, Styles, Markdown plugins,
integrations, `site`, Astro `base`, and `examDomains` are application-wide in
v5; per-book variants are deliberately unsupported.

`defineBookCorpus` validates and freezes the complete registry immediately:

- `books` must be non-empty; its order is display/navigation order;
- each `id` is unique and matches `[a-z0-9]+(?:-[a-z0-9]+)*`;
- `assets`, `chapters`, `search`, `_astro`, `_og`, and `pagefind` are reserved;
- every title is non-blank; and
- each `apparatus` list is duplicate-free and uses only known route names.

## Author content by path

Corpus chapters default to a shared `./src/content` base. Only registered book
folders become chapters, so shared directories are not accidentally counted:

```text
src/content/
├── evaluation/
│   ├── 01-why-evaluation.mdx
│   └── design/02-metrics.mdx
├── llm-app-engineering/
│   └── 01-architecture.mdx
├── questions/
│   ├── evaluation/q-measurement.mdx
│   └── llm-app-engineering/q-retries.mdx
├── glossary/
│   ├── evaluation/calibration.mdx
│   └── llm-app-engineering/idempotency.mdx
└── frontmatter/                 # shared; never a chapter
```

The loader emits `<book>/<local-id>` collection ids. The local id is the
relative path below the book folder without `.md`/`.mdx`, unless frontmatter
sets a string `slug`. For example:

| Source | Entry id | Public chapter URL |
|---|---|---|
| `evaluation/01-intro.mdx` | `evaluation/01-intro` | `/chapters/evaluation/01-intro/` |
| `evaluation/design/02-metrics.mdx` | `evaluation/design/02-metrics` | `/chapters/evaluation/design/02-metrics/` |
| `evaluation/99-draft.mdx` with `slug: conclusion` | `evaluation/conclusion` | `/chapters/evaluation/conclusion/` |

Do not add a required `book:` frontmatter field. The registered first path
segment is authoritative. A legacy field may remain while migrating only when
it agrees with the path; disagreement fails validation. The same local slug,
label, question id, or glossary id may appear in different books, but duplicates
inside one book still fail.

Set `chaptersBase` only when the common content base lives elsewhere:

```ts
defineBookSchemas({ corpus, chaptersBase: './guides/content' });
```

The registered book directories must remain direct children of that base.

## Canonical routes

Every generated href includes Astro's normalized deployment `base`. These
patterns are shown without that prefix:

| Surface | Route |
|---|---|
| Corpus landing | `/` |
| Corpus chapter index | `/chapters/` |
| Book landing | `/<book>/` |
| Book chapter index | `/chapters/<book>/` |
| Chapter | `/chapters/<book>/<slug>/` |
| Corpus search | `/search/` and `/search/?book=<book>` |
| Book apparatus | `/<book>/<route>/` |

Draft chapters do not generate paths. Book and apparatus params come only from
the manifest; arbitrary URL segments never become content selectors.

Corpus mode owns `chapterRoute`, `bookField`, `apparatusRoute`, and
`apparatusRoutes`, using `/chapters/:id/` and `/:book/:route/`. Do not set those
legacy custom-routing fields in a corpus configuration. They remain available
to single-book and consumer-owned v4-style routes. If a consumer filesystem
page overrides an injected corpus page, it must preserve the same params,
canonical URL, Pagefind metadata, and `base` handling.

## Apparatus per book

The closed public apparatus set is:

```text
references, print, convergence, tips, exercises, practice-exam,
glossary, flashcards, answers
```

Application route defaults come from the preset and top-level `routes`
overrides. Manifest values use public URL slugs (`practice-exam`), while the
top-level route toggle remains camel-cased (`practiceExam`). For each book:

- omit `apparatus` to inherit the application-enabled subset;
- set `apparatus: []` to expose none; or
- list an explicit subset to expose only those routes.

Naming a route that the application has disabled is a configuration error, not
a dead link. Only books exposing a route receive its static path, and every
apparatus renderer selects that book's questions, glossary entries, labels,
references, tips, or exercises. `examDomains` remains one application-wide
taxonomy in v5 even though question ids and pages are book-scoped.

## Search and links

One build creates one Pagefind index. Book pages are tagged with the current
`book:<id>` filter; corpus landing content uses `surface:corpus`. `/search/`
searches everything by default, accepts only registered `?book=<id>` values,
and search opened from book chrome starts scoped to that book. Users can switch
back to all books. Pagefind result URLs already include Astro `base`; do not
rewrite them or build separate per-book indexes.

Use `<BookLink>` for an explicit cross-book link. A manifest book resolves
locally and an external `siblingBooks` key keeps its configured origin:

```mdx
<BookLink book="evaluation" to="chapters/metrics#calibration">
  calibration metrics
</BookLink>
```

The local result is `/chapters/evaluation/metrics/#calibration` (plus Astro
`base`). Other relative targets resolve below `/<book>/`. Empty, absolute,
query-only, fragment-only, or traversal targets fail loudly. A key cannot be
owned by both `corpus.books` and `siblingBooks`.

## Generated data and `--book`

Corpus outputs keep the existing `src/data/*.json` filenames but use a strict,
versioned envelope:

```json
{
  "schemaVersion": 1,
  "books": {
    "evaluation": {},
    "llm-app-engineering": {}
  }
}
```

This applies to `labels.json`, `references.json`, `sources.json`, `tips.json`,
and `exercises.json`. Payloads inside each book retain their established shape
and deterministic ordering. Components select the current book before looking
up a local key; there is no unscoped corpus alias.

These content-derived commands accept `--book <id>` in corpus mode:

```bash
npx book-scaffold build-labels --book evaluation
npx book-scaffold build-bib --book evaluation
npx book-scaffold build-tips --book evaluation
npx book-scaffold build-exercises --book evaluation
npx book-scaffold validate --book evaluation
```

Omit `--book` to process all books in manifest order. A selected producer run
updates that key in an existing valid envelope and preserves the other
registered keys; it rejects an existing malformed or manifest-mismatched
envelope. A full run rewrites all keys. Unknown ids, repeated/missing selectors,
and `--book` in a single-book project fail loudly. Figure and notebook
conversion remain application-wide and do not take a book selector.

Human diagnostics begin with `[book:<id>]`; explicitly named corpus totals use
`[book:corpus]`. Identical local ids in two books are checked independently.

### One bibliography and source manifest

`bibliography.bib` (or `BOOK_BIB_PATH`) and `sources/manifest.yaml` remain
root-level, corpus-wide authoring inputs in v5. `build-bib` parses each once and
stores the result beneath every selected book key in `references.json` and
`sources.json`. Renderers still select a book namespace before resolving a
citation, so artifact access never becomes implicitly global.

Per-book bibliography/source input files are not part of the v5 contract. A
duplicate BibTeX key is therefore still an application-level authoring error.

## Migrate the v4 Recipe 21 workaround

The v4 recipe used a hand-written collection and `generateId`. Migrate it in
six steps:

1. Extract ordered book metadata into `defineBookCorpus`.
2. Pass the same manifest to `defineBookConfig` and `defineBookSchemas`.
3. Remove the hand-written chapter collection and custom `generateId`.
4. Keep book folders under `src/content/`, or set one explicit shared
   `chaptersBase`.
5. Compare consumer-owned per-book index pages with the injected pages, then
   remove duplicates.
6. Run `build-labels`, `build-bib`, optional `build-tips`/`build-exercises`,
   and `validate`; update scripts that read generated JSON to select from the
   `books` envelope.

Existing `/chapters/<book>/<slug>/` URLs do not change, so this migration needs
no redirect layer. Remove legacy `book:` frontmatter when convenient; until
then it must match the containing registered folder.

## Single-book compatibility

If a one-book application does not need corpus routes, leave corpus mode off.
Its `src/content/chapters/` loader, `/chapters/<slug>/` and `/chapters/` routes,
flat apparatus routes, and generated JSON shapes remain unchanged. `--book` is
intentionally rejected. The separate v5 removals—an explicit preset and
deletion of inert `deploy` configuration—are covered by
[`MIGRATION-v4-to-v5.md`](../MIGRATION-v4-to-v5.md).

## Verify

```bash
npx book-scaffold build-labels
npx book-scaffold build-bib
npx book-scaffold validate
npm run build
```

Check `/`, `/chapters/`, both per-book landings and indexes, a chapter from each
book, every enabled apparatus route, `/search/`, and `/search/?book=<id>`. Repeat
under a non-root Astro `base` when the deployment uses one.

## Canonical files

- `src/lib/corpus.ts` — manifest validation, identity, selectors, and artifact reader
- `src/schemas-entry.ts` — manifest-scoped loaders and `<book>/<local-id>` ids
- `src/integration.ts` + `pages/{book,chapters-book}.astro` — injected route ownership
- `scripts/corpus-tooling.mjs` — `--book` selection and envelope validation
- `MIGRATION-v4-to-v5.md` — release-wide v4 migration checklist

The original `guides-ai-engineering` two-guide layout is the compatibility
fixture for this migration: its established chapter URLs are the reason the v5
route remains `/chapters/<book>/<slug>/`.
