# Recipe 02 — Bibliography pipeline (BibTeX → JSON)

**Profile**: academic (primarily), but build-bib runs in all profiles and gracefully skips when no `bibliography.bib` is present.

**TL;DR**: Author citations in `bibliography.bib` (BibTeX). `npm run dev` or `npm run build` runs `scripts/build-bib.mjs` which emits `src/data/references.json`. Use `<Cite key="bibkey" />` in MDX to render `Author (Year)` links to `/references#bibkey`.

## How it works

1. **Source**: `bibliography.bib` at scaffold root (overridable via `BOOK_BIB_PATH` env var for books that share a `.bib` with another tree — e.g. a LaTeX sibling).
2. **Build step**: `scripts/build-bib.mjs` invokes `@citation-js/core` + `@citation-js/plugin-bibtex` to parse the `.bib` and serialize to CSL JSON. Output: `src/data/references.json`, one key per bibkey. Idempotent.
3. **Pre-hook**: `prebuild` and `predev` both call `npm run build:bib`, so any `npm run dev` / `npm run build` invocation refreshes the JSON.
4. **Graceful skip**: If `bibliography.bib` is absent (minimal/tools profile, or a fresh scaffold), the script emits `{}` and exits 0. No error.
5. **Component**: `src/components/Cite.astro` imports `references.json` and renders inline `Author (Year)` styled link. Unknown bibkeys throw a build-time error (same guarantee biber gives the LaTeX build).
6. **Bibliography page**: `src/pages/references.astro` auto-renders all entries from `references.json`, sorted by surname+year, each with an anchor `id="<bibkey>"` so `<Cite>` links resolve.

## Author a citation

1. Add a BibTeX entry to `bibliography.bib`:
   ```bibtex
   @inproceedings{gu2024mamba,
     author    = {Gu, Albert and Dao, Tri},
     title     = {Mamba: Linear-Time Sequence Modeling with Selective State Spaces},
     booktitle = {COLM},
     year      = {2024},
     note      = {arXiv:2312.00752}
   }
   ```

2. Reference in MDX:
   ```mdx
   The selective scan <Cite key="gu2024mamba" /> replaces
   the input-independent A matrix with...
   ```

3. Run the build:
   ```bash
   npm run dev        # prebuild runs build:bib first, then astro dev
   ```
   The Cite component renders `Gu & Dao (2024)` linked to `/references#gu2024mamba`. Optional page-locator: `<Cite key="..." page="42" />`.

## Override the `.bib` location

If your book stores its `.bib` outside the Astro project root (e.g. shared with a LaTeX sibling at `../shared/references.bib`):

```bash
BOOK_BIB_PATH=../shared/references.bib npm run build
```

Or persist in `.env`:
```
BOOK_BIB_PATH=../shared/references.bib
```

The script resolves relative paths against `process.cwd()`.

## .gitleaks.toml allowlist

Gitleaks' generic-api-key entropy heuristic flags bibkeys like `gu2024mamba` as false-positive secrets. The scaffold's `.gitleaks.toml` allowlists:
- `src/content/chapters/.+\.mdx` (chapter prose using `<Cite key="...">`)
- `bibliography\.bib` (BibTeX source)

For books using `BOOK_BIB_PATH` to point elsewhere, extend the allowlist with the appropriate path pattern in your fork.

`src/data/references.json` (the derived artifact) is `.gitignore`d entirely — it's regenerated on every build, and gitignoring it sidesteps gitleaks scanning of high-entropy bibkey arrays.

## Common gotchas

- **Duplicate bibkeys** cause the script to exit 1 — `@citation-js` silently overwrites earlier entries, which biber would flag. The wrapper script surfaces duplicates so they don't silently lose entries.
- **Unknown bibkey in `<Cite>` throws at build time** — typos surface as an Astro build error pointing at the offending key.
- **The `note = {arXiv:...}` convention** in BibTeX entries is detected by `src/pages/references.astro` and surfaced as a direct arXiv link in the bibliography page.

## Canonical files

- `scripts/build-bib.mjs:35-50` — path resolution + BOOK_BIB_PATH override
- `src/components/Cite.astro` — author formatting, bibkey lookup
- `src/pages/references.astro` — sorted bibliography page with anchors
- `.gitleaks.toml` — bibkey allowlist
- `package.json` `prebuild` / `predev` — auto-runs build:bib

## Reference implementation

[`~/Claude/post_transformers/guides/web/`](../) uses this pipeline with a `.bib` shared between biber (LaTeX legacy) and citation-js (active MDX site). 66 entries; see commit `acdc847` for the initial wiring.
