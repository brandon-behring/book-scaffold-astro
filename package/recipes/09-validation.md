# Recipe 09 — Pre-flight validation

**Profile**: any (Cite checks skip under non-academic).

**TL;DR**: `npm run validate` runs `scripts/validate.mjs` against all chapter MDX files. It first regenerates missing `labels.json` and `references.json`, then catches typo'd bibkeys / XRef ids / Figure paths / internal links that `astro build` would either miss or surface with poor context. Auto-runs as `prebuild`; recommend wiring into pre-commit too.

## What gets checked

| Check | Profile | Why this is needed (vs astro build alone) |
|---|---|---|
| `<Cite key="...">` resolves in `src/data/references.json` | academic | Cite.astro throws on the first unknown key. Validator surfaces ALL bad keys at once. |
| `<XRef id="...">` resolves in `src/data/labels.json` | all | XRef.astro silently renders `[?label]` placeholders. Without this check, typos ship to readers. |
| `<Figure src="/...">` file exists under `public/` | all | Figure.astro emits a broken-image icon for missing files; build doesn't fail. |
| `[text](/internal-link)` resolves to known chapter slug or top-level route | all | Astro won't fail on dead internal links. Warning, not error (regex misses dynamic routes). |
| `<CodeRef path="..." line={N} />` path exists + line in bounds | all, if `BOOK_REPO_ROOT` set | Catches stale line numbers after code refactors in the paired experiments/ repo. |
| `<Theorem>` has a resolvable `kind=` (or legacy `type=`); an id'd theorem resolves in `labels.json`; a literal `n=` agrees with the index (#121, #126, #176) | all | An absent kind throws at build with less context; an unindexed id silently renders the heading unnumbered; a stale literal `n=` contradicts the heading/XRefs. Dynamic expressions and `label=` overrides are skipped. |
| `<BookLink book= to=>` both present; `book=` registered in `siblingBooks` (#96) | all | Pre-flights the component's build-time throw across all files at once. |
| Questions collection: unique `id`s + `domain` in `examDomains` (#112); `<Rationale appendix>` carries `for=` (#114, v4.21.0) | all, when `src/content/questions/` exists | Duplicate ids break the appendix/flashcards cross-ref key; an unregistered domain throws one-at-a-time at build; an appendix rationale without its anchor target throws at build. |
| `los[].anchor` ↔ `{/* anchor: <slug> */}` prose markers agree both ways (#130, v4.20.0) | all, when frontmatter has `los:` | A declared objective whose prose marker is missing/misspelled (or an orphan marker) builds green otherwise — frontmatter↔prose drift only a hand audit would catch. |

Validate also emits two **non-blocking shadow-route warnings** (exit code unaffected): a consumer-owned `src/pages/chapters/[...slug].astro` without `routes: { chapters: false }` (v4.6.0, #76), and a consumer-owned `src/pages/index.astro` without `routes: { landing: false }` (v4.20.0, #129 — Astro has announced this collision becomes a hard error). See [recipe 18](./18-chapter-route-ownership.md).

## Missing generated artifacts

`src/data/labels.json` and `src/data/references.json` are derived and normally gitignored. v4.27+ `validate` self-heals either missing file unconditionally by invoking the package's own `build-labels` or `build-bib` command before loading data. Existing files are untouched. A failed child command stops validation with the child's original diagnostic and exit status.

`build-bib` resolves `BOOK_BIB_PATH` from the process environment first, then the project-root `.env`, then `./bibliography.bib`. A project with no bibliography still gets a deterministic empty `references.json`.

## What is NOT checked (already covered elsewhere)

- **Frontmatter Zod validation** — `astro build` syncs content collections first; Zod errors there.
- **MDX renders** — `astro build` is the source of truth.
- **KaTeX strict-mode** (academic profile) — rehype-katex throws on undefined macros during build.

The validator's job is to fill the gaps `astro build` leaves, not duplicate it.

## Wiring

```jsonc
// package.json
{
  "scripts": {
    "prevalidate": "npm run build:bib --if-present && npm run build:labels --if-present",
    "validate": "book-scaffold validate",
    "prebuild": "npm run validate --if-present"
  }
}
```

For pre-commit: add to `.pre-commit-config.yaml`:

```yaml
- repo: local
  hooks:
    - id: book-validate
      name: validate book content
      entry: npm run validate --silent
      language: system
      pass_filenames: false
      files: 'src/content/chapters/.*\.(md|mdx)$'
```

## Environment variables

- `BOOK_PRESET` (canonical) / `BOOK_PROFILE` (alias) — which preset to validate against. `academic` enables Cite-key checking.
- `BOOK_REPO_ROOT` — absolute path to the paired code repo for CodeRef checks. Unset → skipped (the scaffold default; minimal/tools books rarely have a paired code repo).
- `BOOK_CHAPTERS_DIR` — override the chapters directory (default: read from `content.config.ts`, fallback `src/content/chapters`).

## Preset / chaptersBase resolution (v4.7.0+, #75)

The validator evaluates `astro.config.*` through Vite first. A resolved scaffold integration supplies the composed preset and `numberStyle`, so CLI tooling sees the same Style chain as the Astro build. Without such an integration, the legacy preset chain remains: `--preset` → process `BOOK_PRESET`/`BOOK_PROFILE` → root `.env` → the literal value in `defineBookSchemas` → a warned `minimal` v4 compatibility fallback. Every selected value is checked against the five-preset enum; config-evaluation failures stop validation instead of silently using defaults.

`chaptersBase` resolution still consults `BOOK_CHAPTERS_DIR`, content configuration, then `src/content/chapters`. The v4.5+ canonical form is:

```ts
// src/content.config.ts
export const { collections } = defineBookSchemas({
  preset: 'research-portfolio',
  chaptersBase: './src/content/textbook',
});
```

is now read by the CLI (previously it was silently ignored — the CLI defaulted to `profile=minimal` and walked `./src/content/chapters/` while `astro build` applied the correct settings, masking real schema drift).

Full precedence chain documented in [`PACKAGE_DESIGN.md §8 — Preset + chaptersBase resolution`](../../PACKAGE_DESIGN.md#preset--chaptersbase-resolution-v470-closes-75).

## Output

Exit code = total error count. On success:

```
validate: ✓ 6 chapter(s) checked (profile=academic, number-style=shared); no errors.
```

On failure, all issues listed at once with `file:line msg`:

```
validate: ✗ 17 error(s) in 6 chapter(s) (profile=academic, number-style=shared):
  week05.mdx:102  Unknown XRef id "w4:prop:zoh-stability" — not in labels.json
  week11.mdx:37  Unknown XRef id "ch:week13" — not in labels.json
  ...
```

Warnings (currently: internal-link unresolved) are printed to stderr but don't affect exit code.

## Extending the validator

The script is ~150 lines of regex-driven scanning. To add a check:

1. Define a regex (`RE_FOO`).
2. Loop `content.matchAll(RE_FOO)` per chapter.
3. Push to `errors` (build-blocking) or `warnings` (informational).

Examples of checks worth adding for specific books:

- **Word-count budget** per chapter (catch runaway chapters early)
- **Mandatory frontmatter fields** beyond the Zod schema (e.g. `last_verified` date older than 6 months → warning)
- **Image alt text presence** (accessibility)
- **No `TODO` strings in published chapters** (with frontmatter `status: implemented`)

Keep the script regex-based; resist the urge to pull in MDX AST parsing. The script must stay <2 s for the pre-commit-hook use case.

## Common gotchas

- **Regex false negatives**: multi-line `<Cite\n  key="...">` won't match. Authors should keep component attributes on one line; the build catches the residual cases.
- **`<Figure src>` with `BOOK_FIGURES_PATH` override**: the validator checks `public/figures/<...>` (post-build location), not the source `figures/` directory. Run `npm run build:figures` before `npm run validate` if assets are stale.
- **`labels.json` exists but is stale**: self-healing only regenerates missing artifacts. Run `npm run build:labels` after changing IDs, kinds, slugs, or `numberStyle`.

## Canonical files

- `scripts/validate.mjs` — the validator
- `src/data/references.json` — emitted by `scripts/build-bib.mjs` (recipe 02)
- `src/data/labels.json` — emitted by `scripts/build-labels.mjs`
- `src/components/{Cite,XRef,Figure,CodeRef}.astro` — components whose contracts validate.mjs enforces

## Reference implementation

Tested against `~/Claude/post_transformers/guides/web/` (6 chapters, ~3000 lines of MDX): caught 17 unknown XRef ids that the empty labels.json had been hiding. Runtime: ~80 ms.
