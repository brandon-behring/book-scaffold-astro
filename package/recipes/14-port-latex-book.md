# Recipe 14 — Port a LaTeX book into the scaffold

**Profile**: typically `academic` (textbooks, research manuscripts). Adapt for `research-portfolio` if your LaTeX book also tracks freshness/volatility.

**TL;DR**: Bootstrap a `web/` subdirectory inside the LaTeX repo. Share the canonical `bibliography.bib` via `BOOK_BIB_PATH`. Smoke-test the bib pipeline *before* writing chapter content. Pick one chapter as the pilot; port it manually (do not script the conversion) so the friction surfaces. File each gap upstream the moment it surfaces — with a real receipt — and consume the fix via a `file:` dependency until it publishes. Defer chapters 2..N until the pilot ships.

See [`LATEX_TO_MDX_MAPPING.md`](../LATEX_TO_MDX_MAPPING.md) for the component-mapping reference table (which scaffold component replaces which LaTeX environment).

This recipe is the operational *process* that goes around that table.

## When to use this recipe

Use it when you already have a working LaTeX manuscript (`main.tex` + `chapters/*.tex` + `bibliography.bib`) and want a web companion that:

- Builds in parallel with the existing PDF build (you keep LaTeX canonical during the migration window).
- Reuses the same `bibliography.bib` so citations don't drift.
- Surfaces the friction points specific to your book so they become upstream improvements to the scaffold, not consumer-side workarounds that rot.

If you are *starting* a new book from scratch, prefer [Recipe 00](00-getting-started.md) — no LaTeX baggage to migrate.

## 1. Pre-flight (before any code)

These two steps are deliberately *not* code changes. They make the work inheritable across sessions and visible to collaborators.

### 1a. File a tracking issue in your LaTeX repo

```bash
gh issue create \
  --repo <you>/<your-book> \
  --label tracked --label P2 --label feature \
  --title "pilot: port <your-book> to book-scaffold-astro" \
  --body "Link to plan, acceptance bar (functional parity), upstream-first strategy"
```

The issue gives every commit a number to link back to, and shows up on cross-repo project boards.

### 1b. Record the strategic context

If you have a memory store (Claude `MEMORY.md`, Obsidian, etc.), note:

- The scaffold version you targeted (e.g. `^3.6.0`).
- The fact that you intend to file upstream issues as friction surfaces, *not* work around consumer-side.
- The pilot's acceptance bar — typically **functional parity** for one chapter: every LaTeX construct has a working MDX equivalent, visual styling may differ.

A future session (yours, or another author taking the same approach) inherits the strategy without re-discovering it.

## 2. Bootstrap a `web/` subdirectory

From inside your LaTeX repo root:

```bash
npx @brandon_m_behring/create-book web --profile=academic
cd web && npm install
```

You will get 11 scaffolded files in `web/`. Edit these four immediately:

**`web/package.json`** — set the package name, and override `build:bib` so it consumes the canonical bibliography at the repo root:

```diff
- "name": "web",
+ "name": "my-book-web",

- "build:bib": "book-scaffold build-bib",
+ "build:bib": "BOOK_BIB_PATH=../bibliography.bib book-scaffold build-bib",
```

**`web/astro.config.mjs`** — set the deploy URL and make the profile explicit (the env-driven fallback fails in Cloudflare's build container because `.env` is gitignored):

```js
export default await defineBookConfig({
  site: 'https://my-book.<your-cloudflare-account>.workers.dev',
  profile: 'academic',
});
```

**`web/src/content.config.ts`** — same reasoning: explicit `profile: 'academic'`.

**`web/wrangler.toml`** — Cloudflare project name.

Delete the scaffolded `web/bibliography.bib` placeholder (the `BOOK_BIB_PATH` override makes it dead weight).

## 3. Bib smoke test (before chapter content)

**Do not write a single line of MDX until the bibliography parses cleanly.** Bib bugs cascade into chapter content and are then conflated with "MDX problems."

```bash
cd web && npm run build:bib
```

You should see, e.g., `build-bib: 34 entries -> src/data/references.json`. Sanity-check the output:

```bash
# Total entry count matches the raw .bib
jq 'keys | length' src/data/references.json
# Should equal: grep -c '^@' ../bibliography.bib

# Spot-check 5 entries: surname + year + title + container
jq '.["chernozhukov2018double"] | {author, "issued.date-parts": ."issued"."date-parts", title, "container-title"}' \
  src/data/references.json
```

Watch for biblatex-only fields silently dropped (`date`, `journaltitle`, `eventtitle`), `[object Object]` artifacts, or UTF-8 mishandling (umlauts, em-dashes). If any entries mistranslate, that's your first organic upstream issue. File it with the failing entry as evidence, *then* keep going.

## 4. The inline-upstream-PR loop

The pilot's core discipline. Whenever the port surfaces real friction (a missing macro, a schema mismatch, a component gap, a crashing build):

1. **Stop the port.** Capture the receipt: the LaTeX snippet that's hard to translate + what the scaffold currently offers + the proposed API.
2. **File the issue** at `brandon-behring/book-scaffold-astro` with labels `consumer:<your-book>` + `kind:enhancement` / `kind:api-friction` / `kind:bug` / `kind:doc-drift`. Create labels if they don't exist.
3. **Implement the upstream PR.** Branch from `v3.0` (or the current dev branch), make the fix, run the scaffold's tests (`cd package && node --test tests/*.test.mjs`), bump the version, document in `CHANGELOG.md`. Add a regression test where one is missing.
4. **Consume the fix via a `file:` dependency** so the pilot is unblocked before the registry version exists:

   ```json
   "dependencies": {
     "@brandon_m_behring/book-scaffold-astro": "file:../../book-scaffold-astro/package"
   }
   ```

   Run `npm install` again. The local scaffold's built `dist/` is what the consumer now resolves.
5. **Log it** in a running `web/UPSTREAM_ISSUES.md` — issue link, PR link, version bumped, receipt. Future sessions reading the log understand why the consumer carries any leftover workaround.
6. **Resume the port** using the now-fixed upstream API. Delete consumer-side workarounds that the upstream PR superseded — those deletions are part of the proof.

When the PR merges and the registry version publishes, swap the `file:` dependency back to `^<version>` and rerun `npm install`.

> **Triage rule.** If the upstream fix is small (one-line, one-file) and has a clear API, do steps 1–6 inline before the next chapter section. If it's large (cross-cutting, requires API design), file the issue with the receipt, fall back to a consumer-side workaround for the pilot, and mark the PR as Phase-2 work in `UPSTREAM_ISSUES.md`. The slow path is the point — the scaffold improves with every consumer book — but not at the cost of pilot momentum on a single bug.

## 5. Wire the build pipeline

Per [Recipe 09](09-validation.md), the scaffold ships `book-scaffold validate` to catch authoring errors (bad cite keys, dangling XRef ids, missing figure files). Wire it into `prebuild`:

```json
"scripts": {
  "predev": "npm run build:bib && npm run build:labels --if-present",
  "prebuild": "npm run build:bib && npm run build:labels --if-present && npm run validate --if-present",
  "build:bib": "BOOK_BIB_PATH=../bibliography.bib book-scaffold build-bib",
  "build:labels": "book-scaffold build-labels",
  "validate": "book-scaffold validate",
  "dev": "astro dev",
  "build": "astro build && pagefind --site dist"
}
```

Use `<XRef id="..." />` for cross-references from the first chapter onward — do not fall back to plain markdown anchors with the intent to "retrofit later." The retrofit is more expensive than wiring labels from the start.

## 6. Consumer-side KaTeX macros

If your LaTeX preamble defines `\newcommand{\Var}{\mathrm{Var}}` style shortcuts, list the *actually used* ones (not the full preamble!) in `astro.config.mjs`:

```js
katexMacros: {
  '\\Var': '\\mathrm{Var}',
  '\\Cov': '\\mathrm{Cov}',
  // Add macros as the port surfaces real uses. Do not preemptively
  // import every \newcommand from the LaTeX preamble.
},
```

`katexMacros` is shallow-merged on top of `ssmMacros`. Consumer wins on key collision. The scaffold runs KaTeX with `strict: 'error'`, so any undefined macro fails the build — a forcing function that keeps the macro set honest.

If you discover a macro pattern that's clearly cross-book (most causal-inference books need `\ate`, `\att`, `\cate`, `\propensity`; most RL books need `\bellman`, `\argmin`), that is an upstream-issue-worthy signal. File it and shift the consumer-side bridge to an upstream preset.

## 7. Pilot port

Pick one chapter — ideally Chapter 1, since later chapters depend on its conventions. Port manually.

**Manual is the point.** A scripted conversion (pandoc, custom AST walk) misses the friction. The friction is the deliverable.

For each LaTeX environment, consult [`LATEX_TO_MDX_MAPPING.md`](../LATEX_TO_MDX_MAPPING.md) and translate. A few hot-spots that consistently produce upstream issues:

- **Theorem numbering**. The scaffold's `<Theorem kind="theorem" n="1.3" name="...">` accepts manual `n=` until a counter API lands. Pass the number explicitly; do not assume auto-numbering. (This is open work — see [Recipe 09](09-validation.md) for current status.)
- **Margin notes**. Map `\marginnote[Title]{body}` → `<MarginNote title="Title">body</MarginNote>` and `\sidenote{...}` → `<Sidenote>...</Sidenote>`. Lean on `<MarginNote>` for Tufte sidebars; `<Sidenote>` is auto-numbered footnote-style.
- **Citations**. Map `\cite{key}` → `<Cite key="key" />`. The `<Cite>` component validates `key` against the parsed bibliography at build time — broken bibkeys fail `book-scaffold validate`.
- **Proof blocks**. `\begin{proof}…\end{proof}` → `<Theorem kind="proof">…</Theorem>`. Same component, different `kind`.

Frontmatter status: every chapter that already has prose + working code gets `status: implemented`. Do not invent finer-grained migration states (`status: porting` etc.) — if a real distinction emerges, file the upstream issue.

## 8. Verify the build

```bash
cd web
npm run build:bib && npm run build:labels && npx book-scaffold validate && npm run build
```

Acceptance bar (recommended): **functional parity**.

- Every LaTeX construct in the pilot chapter has a working MDX equivalent.
- KaTeX strict mode passes — no undefined macros.
- Validate passes — no unknown cite keys, no dangling XRef ids, no missing figures.
- The Astro build produces the auto-injected routes (`/print`, `/references`, `/search`) and your chapter renders inside `/print`.

Visual styling may differ from the LaTeX PDF — the scaffold owns visual design; the pilot owns content fidelity.

## 9. Known pitfalls (from past pilots)

These are real friction discovered by consumer pilots. Some are fixed, some open.

### Academic profile and `routes.chapters`

The `defineBookConfig` option `routes: { chapters: true }` *appears* to opt an academic book into per-chapter URLs but currently crashes the build — the shipped `pages/chapters.astro` is hardcoded to the tools schema (`volatility`, `tools_compared`, `last_verified`, `chapter`). Track [issue #24](https://github.com/brandon-behring/book-scaffold-astro/issues/24). For now, the academic profile's chapter access point is `/print` (which aggregates all chapters into one Paged.js-friendly page).

### Scaffolded demo content is occasionally drifty

The `week01-hello-world.mdx` demo created by `create-book` ships with a placeholder cite (`example-key2024`) that's not in the placeholder bibliography. It also uses `<Theorem type="theorem">` (the deprecated prop name) instead of `<Theorem kind="theorem">`. Delete or rewrite the demo before running `validate` for the first time. If the drift recurs across versions, file a `kind:doc-drift` issue.

### `BOOK_PROFILE` and `.env`

`book-scaffold validate` reads `BOOK_PROFILE` from `.env` per [Issue #20](https://github.com/brandon-behring/book-scaffold-astro/issues/20), fixed in 3.5.2. If you see `profile=minimal` reported despite an academic `.env`, you're on an older scaffold version — upgrade or set the env var explicitly in your npm scripts.

### Bibkeys flagged as secrets

If your repo has a `gitleaks` pre-commit hook, BibTeX cite keys like `chernozhukov2018double` (high-entropy author-year strings) will trip the default `generic-api-key` rule. Add a repo-level `.gitleaks.toml`:

```toml
title = "my-book"

[extend]
useDefault = true

[allowlist]
description = "Human-authored chapter MDX and the BibTeX bibliography."
paths = [
  '''web/src/content/.*\.mdx$''',
  '''^bibliography\.bib$''',
]
```

Use the singular `[allowlist]` form (not the newer plural `[[allowlists]]`) — older gitleaks releases installed by `pre-commit` don't honor the plural syntax.

### `npm install` after `file:` dependency

When you switch `web/package.json` to `"@brandon_m_behring/book-scaffold-astro": "file:../../book-scaffold-astro/package"`, `npm install` resolves the local path. The scaffold's `dist/` must be present (run `npm run build` inside the scaffold once). When you later switch back to a registry version, run `npm install` again to drop the file resolution.

## 10. Phase 2: chapters 2..N

Only after the pilot ships:

- Has the manual port pace matched LaTeX authoring? If yes, green-light the full migration. If not, evaluate pandoc-assisted drafts as a 30% time saver on bulk prose; hand-edit minted blocks / margin notes / custom commands (pandoc mangles all three).
- Did upstream-first investment produce a net gain? It should: each PR makes the *next* chapter port cheaper.
- Are there scaffold gaps that still warrant inline PRs, or is the remaining work entirely consumer-side?
- Schema upgrades that were deferred during the pilot (e.g. parameterized `parts` per-book) ship now if they unblock chapter 2's frontmatter.

## See also

- [Recipe 00 — Getting started](00-getting-started.md) — for new books, not migrations.
- [Recipe 01 — Add math](01-add-math.md) — KaTeX details + the `katexMacros` consumer option.
- [Recipe 02 — Bibliography pipeline](02-bibliography-pipeline.md) — `BOOK_BIB_PATH`, `build-bib`, `<Cite>`.
- [Recipe 09 — Validation](09-validation.md) — `book-scaffold validate` and its checks.
- [Recipe 12 — Where to file issues](12-where-to-file-issues.md) — consumer-pilot issue template.
- [`LATEX_TO_MDX_MAPPING.md`](../LATEX_TO_MDX_MAPPING.md) — component mapping reference card.
