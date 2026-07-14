# Recipe 20 — Anki deck export (consumer-side pattern)

**Profile**: any (most useful for `course-notes` and `research-portfolio`).

**TL;DR**: The scaffold does **not** ship an `<AnkiCard>` component or an
`extract-cards` CLI (see [PACKAGE_DESIGN.md §15c](../../PACKAGE_DESIGN.md#15c-deferred-scope)
for why). This recipe shows how a consumer can roll their own: a small
`<AnkiCard>` component plus a `scripts/extract-cards.mjs` extractor that reads
chapter source and emits tool-neutral JSON. A downstream tool may convert that
JSON to `.apkg`; no scaffold change or Anki-archive dependency is required.

The historical `dlai-study-notes` pilot is consumer one: it extracted 154 cards
to one deck plus a JSON debug artifact before its later pedagogy rebuild
replaced that corpus. If your book is a **second independent consumer**
committed to maintaining this workflow, please comment on
[issue #210](https://github.com/brandon-behring/book-scaffold-astro/issues/210)
with the card schema and target import contract. That is the signal for
considering a scaffold-level surface.

## When to use this pattern

Use it if your book:

- Has discrete reviewable facts that benefit from spaced repetition (course notes, foundational reference material).
- Already authors chapter content in MDX and wants flashcards as a *byproduct*, not a parallel deck file.
- Wants `<AnkiCard>` to render inline as a "study widget" and export stable card
  records that a separate tool can import or package for offline review.

Do **not** use it if your book is essay-style prose, narrative arguments, or working through proofs — the per-card "front/back" shape fights that content.

## Step 1 — Add the component

Create `src/components/AnkiCard.astro`:

```astro
---
export interface Props {
  id?: string;        // Stable Anki note GUID (recommended)
  front: string;      // Plain-text card front
  back?: string;      // Optional plain-text back; otherwise use the MDX slot
  tags?: string;      // Optional comma-separated tags
}
const { id, front, back, tags = '' } = Astro.props;
const tagList = tags.split(',').map((tag) => tag.trim()).filter(Boolean);
---

<aside class="anki-card" data-id={id} data-front={front} data-tags={tagList.join(',')}>
  <header><strong>Q.</strong> {front}</header>
  {back ? <p><strong>A.</strong> {back}</p> : <slot />}
</aside>

<style>
  .anki-card {
    border-left: 4px solid var(--color-accent, #6366f1);
    padding: 0.75rem 1rem;
    margin: 1rem 0;
    background: var(--color-surface-2, #fafafa);
    border-radius: 4px;
  }
  .anki-card header { margin-bottom: 0.5rem; }
</style>
```

Import in chapters:

```mdx
import AnkiCard from '../../components/AnkiCard.astro';

<AnkiCard id="ch01-q01" front="What does the central limit theorem state?">
The distribution of sample means approaches a normal distribution as $n \to \infty$,
regardless of the underlying population distribution (provided finite variance).
</AnkiCard>
```

## Step 2 — Add the extractor

Create `scripts/extract-cards.mjs` at the project root:

```js
#!/usr/bin/env node
/**
 * scripts/extract-cards.mjs — walk chapters, find <AnkiCard> instances, emit JSON.
 *
 * Pairs with src/components/AnkiCard.astro. For .apkg generation, pipe the
 * JSON through a separate tool (e.g., genanki Python lib) — keeping that
 * outside this script avoids a runtime dependency on an Anki package builder.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { glob } from 'node:fs/promises';
import { dirname, relative } from 'node:path';

// Single-book default. In corpus mode, replace this with one entry per exact
// defineBookCorpus key/root; never glob questions, glossary, or frontmatter.
const BOOK_ROOTS = new Map([
  ['book', 'src/content/chapters'],
  // ['evaluation', 'src/content/evaluation'],
]);
const OUT_PATH = 'dist-cards/cards.json';

// Match <AnkiCard ...> ... </AnkiCard> OR self-closing <AnkiCard ... />.
// Captures attribute block + optional slot body.
const ANKI_RE = /<AnkiCard\s+((?:"[^"]*"|'[^']*'|[^>])*?)(?:\/>|>([\s\S]*?)<\/AnkiCard>)/g;
const ATTR_RE = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

function parseAttrs(attrStr) {
  const out = {};
  let m;
  while ((m = ATTR_RE.exec(attrStr)) !== null) {
    out[m[1]] = m[2] ?? m[3];
  }
  return out;
}

async function main() {
  const cards = [];
  const seenGuids = new Map();
  for (const [book, root] of BOOK_ROOTS) {
    const files = await Array.fromAsync(glob(`${root}/**/*.{md,mdx}`));
    files.sort();
    for (const file of files) {
      const src = await readFile(file, 'utf8');
      const slug = relative(root, file).replaceAll('\\', '/').replace(/\.mdx?$/, '');
      let fileCardIndex = 0;
      ANKI_RE.lastIndex = 0;
      let m;
      while ((m = ANKI_RE.exec(src)) !== null) {
        const attrs = parseAttrs(m[1]);
        if (!attrs.front?.trim()) {
          throw new Error(`${file}: <AnkiCard> requires a literal front="..." attribute`);
        }
        const back = attrs.back?.trim() || (m[2] ?? '').trim();
        if (!back) {
          throw new Error(`${file}: <AnkiCard> requires a literal back="..." or non-empty slot`);
        }
        const guid = attrs.id ?? `${book}-${slug}-${fileCardIndex}`;
        const prior = seenGuids.get(guid);
        if (prior) throw new Error(`Duplicate card guid "${guid}" in ${prior} and ${file}`);
        seenGuids.set(guid, file);
        cards.push({
          guid,
          book,
          chapter: slug,
          front: attrs.front,
          back,
          tags: (attrs.tags ?? '').split(',').map((tag) => tag.trim()).filter(Boolean).concat([book, slug]),
        });
        fileCardIndex += 1;
      }
    }
  }

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(cards, null, 2) + '\n');
  console.log(`extract-cards: ${cards.length} cards → ${OUT_PATH}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

Wire it into `package.json`:

```json
{
  "scripts": {
    "extract:cards": "node scripts/extract-cards.mjs"
  }
}
```

## Step 3 — Generate the `.apkg`

The JSON output is intentionally tool-neutral. Pick whichever Anki builder fits your stack:

- **Python `genanki`** (most common): wrap the JSON read in a 20-line Python script that emits `.apkg` via `genanki.Deck` + `genanki.Note`. Stable note GUIDs from the `guid` field keep your review history when the source updates.
- **Node `anki-apkg-export`** (npm): direct from Node if you want to stay in one runtime.
- **Plain CSV import**: Anki's CSV importer reads the JSON directly enough that you can convert with `jq -r '.[] | [.guid, .front, .back, (.tags | join(" "))] | @tsv'`.

The scaffold deliberately does **not** opine on the choice. This
consumer-owned JSON boundary keeps conversion separate without claiming a
package-level schema.

## Step 4 — Configure corpus roots (if needed)

The extractor emits one JSON array with an explicit `book` field. In
first-class corpus mode, replace `BOOK_ROOTS` with the exact registered book
keys and chapter roots:

```js
const BOOK_ROOTS = new Map([
  ['evaluation', 'src/content/evaluation'],
  ['experimentation', 'src/content/experimentation'],
]);
```

This follows Recipe 21's `src/content/<book>/...` contract without accidentally
scanning the reserved `questions`, `glossary`, or `frontmatter` collections.
Anki extraction itself remains consumer-owned.

## Common gotchas

- **Stable GUIDs**: if you omit `id`, the script falls back to a generated
  book/slug/per-file-index value. Adding or removing an earlier card in the
  same file can shift that index and break review history. **Always set explicit
  `id` props** for cards you want to survive content edits. Duplicate GUIDs
  fail extraction.
- **Literal attributes**: the intentionally small extractor accepts quoted
  `id`, `front`, `back`, and comma-separated `tags` attributes. Dynamic MDX
  expressions, code examples, and commented tags require a real MDX
  AST/compiler pipeline; constrain the consumer convention or extend the script
  structurally instead of evaluating authored JavaScript with `eval`.
- **Markdown in slots**: this extractor reads raw MDX source, so a slotted back
  remains Markdown/MDX text rather than rendered HTML. Convert it downstream or
  constrain card backs to the syntax your importer accepts. Raw `$...$` LaTeX
  can be left for Anki's MathJax integration.
- **Pagefind**: `<AnkiCard>` instances are indexed by Pagefind like any prose. If you don't want flashcard fronts in search results, wrap in `<aside data-pagefind-ignore>`.
- **Visual regression**: the component adds a styled block to every chapter that has cards. If you maintain visual baselines, regenerate them after first adoption.

## Why this isn't in the scaffold

Per [PACKAGE_DESIGN.md §15c](../../PACKAGE_DESIGN.md#15c-deferred-scope), the
historical DLAI pilot proves the pattern once; a second independent consumer
must confirm a stable schema before it becomes a package contract. Direct
`.apkg` generation remains outside the scaffold even if JSON extraction later
graduates.

## Canonical files

- This recipe (consumer pattern)
- [PACKAGE_DESIGN.md §15c](../../PACKAGE_DESIGN.md#15c-deferred-scope) — deferral rationale

## Reference implementation

- [`dlai-study-notes`](https://github.com/brandon-behring/dlai-study-notes) — the DLAI Study Notes pilot that prototyped this pattern (originator of issue #16).
