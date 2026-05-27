# Recipe 09 — Pre-flight validation

**Profile**: any (Cite checks skip under non-academic).

**TL;DR**: `npm run validate` runs `scripts/validate.mjs` against all chapter MDX files. Catches typo'd bibkeys / XRef ids / Figure paths / internal links that `astro build` would either miss or surface with poor context. Auto-runs as `prebuild`; recommend wiring into pre-commit too.

## What gets checked

| Check | Profile | Why this is needed (vs astro build alone) |
|---|---|---|
| `<Cite key="...">` resolves in `src/data/references.json` | academic | Cite.astro throws on the first unknown key. Validator surfaces ALL bad keys at once. |
| `<XRef id="...">` resolves in `src/data/labels.json` | all | XRef.astro silently renders `[?label]` placeholders. Without this check, typos ship to readers. |
| `<Figure src="/...">` file exists under `public/` | all | Figure.astro emits a broken-image icon for missing files; build doesn't fail. |
| `[text](/internal-link)` resolves to known chapter slug or top-level route | all | Astro won't fail on dead internal links. Warning, not error (regex misses dynamic routes). |
| `<CodeRef path="..." line={N} />` path exists + line in bounds | all, if `BOOK_REPO_ROOT` set | Catches stale line numbers after code refactors in the paired experiments/ repo. |

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
    "validate": "node scripts/validate.mjs",
    "prebuild": "npm run build:assets && npm run validate"
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

The validator resolves both `preset` and `chaptersBase` by consulting multiple sources in a documented order. Notable v4.7.0 addition: the v4.5+ canonical form

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
validate: ✓ 6 chapter(s) checked (profile=academic); no errors.
```

On failure, all issues listed at once with `file:line msg`:

```
validate: ✗ 17 error(s) in 6 chapter(s) (profile=academic):
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
- **`labels.json` empty**: every XRef fires an error. Until you have a labels-building step (Phase 2.6 in post-transformers, deferred at scaffold v2.0), avoid `<XRef>` in chapter content — use direct markdown links instead.

## Canonical files

- `scripts/validate.mjs` — the validator
- `src/data/references.json` — emitted by `scripts/build-bib.mjs` (recipe 02)
- `src/data/labels.json` — placeholder; populated by future labels-building step
- `src/components/{Cite,XRef,Figure,CodeRef}.astro` — components whose contracts validate.mjs enforces

## Reference implementation

Tested against `~/Claude/post_transformers/guides/web/` (6 chapters, ~3000 lines of MDX): caught 17 unknown XRef ids that the empty labels.json had been hiding. Runtime: ~80 ms.
