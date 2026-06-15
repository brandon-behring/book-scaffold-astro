# Recipe 20 — Anki deck export (consumer-side pattern)

**Profile**: any (most useful for `course-notes` and `research-portfolio`).

**TL;DR**: The scaffold does **not** ship an `<AnkiCard>` component or an `extract-cards` CLI (see [PACKAGE_DESIGN.md §15a](../../PACKAGE_DESIGN.md#15a-deferred-scope-post-v4x) for why). This recipe shows how a consumer can roll their own — a small `<AnkiCard>` component plus a `scripts/extract-anki.mjs` extractor that walks the chapters collection and emits an Anki deck. ~120 lines of consumer-side code; no scaffold changes required.

If your book is the **third** independent consumer to want this, please open an issue at [book-scaffold-astro](https://github.com/brandon-behring/book-scaffold-astro/issues) — that's the signal we need to consider promoting this to scaffold-level surface.

## When to use this pattern

Use it if your book:

- Has discrete reviewable facts that benefit from spaced repetition (course notes, foundational reference material).
- Already authors chapter content in MDX and wants flashcards as a *byproduct*, not a parallel deck file.
- Wants `<AnkiCard>` to render inline as a "study widget" on the chapter page AND export to `.apkg` for offline review.

Do **not** use it if your book is essay-style prose, narrative arguments, or working through proofs — the per-card "front/back" shape fights that content.

## Step 1 — Add the component

Create `src/components/AnkiCard.astro`:

```astro
---
export interface Props {
  id?: string;        // Stable Anki note GUID (recommended)
  front: string;      // Card front (HTML / Markdown allowed in slot)
  back?: string;      // Optional one-line back; otherwise use slot
  tags?: string[];    // Anki tags (in addition to chapter slug)
}
const { id, front, back, tags = [] } = Astro.props;
---

<aside class="anki-card" data-id={id} data-front={front} data-tags={tags.join(',')}>
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
import AnkiCard from '../components/AnkiCard.astro';

<AnkiCard id="ch01-q01" front="What does the central limit theorem state?">
The distribution of sample means approaches a normal distribution as $n \to \infty$,
regardless of the underlying population distribution (provided finite variance).
</AnkiCard>
```

## Step 2 — Add the extractor

Create `scripts/extract-anki.mjs` at the project root:

```js
#!/usr/bin/env node
/**
 * scripts/extract-anki.mjs — walk chapters, find <AnkiCard> instances, emit JSON.
 *
 * Pairs with src/components/AnkiCard.astro. For .apkg generation, pipe the
 * JSON through a separate tool (e.g., genanki Python lib) — keeping that
 * outside this script avoids a runtime dependency on an Anki package builder.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { glob } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

const CHAPTERS_GLOB = 'src/content/chapters/**/*.{md,mdx}';
const OUT_PATH = 'dist-anki/cards.json';

// Match <AnkiCard ...> ... </AnkiCard> OR self-closing <AnkiCard ... />.
// Captures attribute block + optional slot body.
const ANKI_RE = /<AnkiCard\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/AnkiCard>)/g;
const ATTR_RE = /(\w+)\s*=\s*(?:"([^"]*)"|\{([^}]*)\}|'([^']*)')/g;

function parseAttrs(attrStr) {
  const out = {};
  let m;
  while ((m = ATTR_RE.exec(attrStr)) !== null) {
    out[m[1]] = m[2] ?? m[3] ?? m[4];
  }
  return out;
}

async function main() {
  const cards = [];
  for await (const file of glob(CHAPTERS_GLOB)) {
    const src = await readFile(file, 'utf8');
    const slug = file.replace(/^.*\/chapters\//, '').replace(/\.mdx?$/, '');
    let m;
    while ((m = ANKI_RE.exec(src)) !== null) {
      const attrs = parseAttrs(m[1]);
      cards.push({
        guid: attrs.id ?? `${slug}-${cards.length}`,
        chapter: slug,
        front: attrs.front,
        back: attrs.back ?? (m[2] ?? '').trim(),
        tags: (attrs.tags ?? '').split(',').filter(Boolean).concat([slug]),
      });
    }
  }

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(cards, null, 2) + '\n');
  console.log(`extract-anki: ${cards.length} cards → ${OUT_PATH}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

Wire it into `package.json`:

```json
{
  "scripts": {
    "build:anki": "node scripts/extract-anki.mjs"
  }
}
```

## Step 3 — Generate the `.apkg`

The JSON output is intentionally tool-neutral. Pick whichever Anki builder fits your stack:

- **Python `genanki`** (most common): wrap the JSON read in a 20-line Python script that emits `.apkg` via `genanki.Deck` + `genanki.Note`. Stable note GUIDs from the `guid` field keep your review history when the source updates.
- **Node `anki-apkg-export`** (npm): direct from Node if you want to stay in one runtime.
- **Plain CSV import**: Anki's CSV importer reads the JSON directly enough that you can convert with `jq -r '.[] | [.guid, .front, .back, (.tags | join(" "))] | @tsv'`.

The scaffold deliberately does **not** opine on the choice — the JSON is the contract.

## Step 4 — Per-book grouping (if needed)

The example above emits one deck per book. If you have a multi-book corpus (per the DLAI Study Notes pattern), gate emission on a `book` discriminator in chapter frontmatter:

```js
const byBook = new Map();
// ... inside the loop:
const fm = parseFrontmatter(src);  // bring your own YAML parser
const book = fm.book ?? 'main';
if (!byBook.has(book)) byBook.set(book, []);
byBook.get(book).push({ ... });
```

Then write one file per book key. Multi-book corpus routing is itself out of scope at v4.x ([deferred, see §15a](../../PACKAGE_DESIGN.md#15a-deferred-scope-post-v4x); tracked on #80) — if you need it, the same consumer-side pattern applies.

## Common gotchas

- **Stable GUIDs**: if you omit `id`, the script falls back to `${slug}-${index}`. Adding/removing cards above an existing card will shift indices and break review history. **Always set explicit `id` props** for cards you want to survive content edits.
- **Markdown in slots**: Anki accepts HTML; MDX renders the slot content to HTML before this extractor sees it, so most formatting carries through. KaTeX math is a special case — the extractor sees raw `$...$` LaTeX; either pre-render with KaTeX server-side before extraction, or use Anki's MathJax integration.
- **Pagefind**: `<AnkiCard>` instances are indexed by Pagefront like any prose. If you don't want flashcard fronts in search results, wrap in `<aside data-pagefind-ignore>`.
- **Visual regression**: the component adds a styled block to every chapter that has cards. If you maintain visual baselines, regenerate them after first adoption.

## Why this isn't in the scaffold

Per [PACKAGE_DESIGN.md §15a](../../PACKAGE_DESIGN.md#15a-deferred-scope-post-v4x): single consumer signal so far (DLAI), runtime dep concerns (`.apkg` is a SQLite-backed zip — needs an external builder), and the design space for per-book grouping is entangled with multi-book corpus routing (also deferred). When 2-3 consumers independently want this, it gets promoted.

## Canonical files

- This recipe (consumer pattern)
- [PACKAGE_DESIGN.md §15a](../../PACKAGE_DESIGN.md#15a-deferred-scope-post-v4x) — deferral rationale

## Reference implementation

- [`dlai-study-notes`](https://github.com/brandon-behring/dlai-study-notes) — the DLAI Study Notes pilot that prototyped this pattern (originator of issue #16).
