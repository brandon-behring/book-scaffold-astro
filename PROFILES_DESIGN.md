# Profiles Design — v2.0 architecture

> **Status**: design document for `book-scaffold-astro` v2.0.
> **Date**: 2026-05-18.
> **Plan**: `~/.claude/plans/i-want-to-investigate-recursive-yao.md` (15 locked Q&A decisions; this doc translates them into an executable audit).
> **Production reference**: [`~/Claude/post_transformers/guides/web/`](../post_transformers/guides/web/) is the academic-profile reference implementation; `~/Claude/book-template-astro/` is the tools-profile inspiration (out of scope for v2.0 backport per Q9).

## 1. Purpose

Scaffold v1 (current main) was extracted from `book-template-astro` ("Agentic Coding") and embeds patterns that fit AI-tools content: volatility classes, source tiers, convergence dashboards, tool-filter UI. It has no math support, no bibliography pipeline, no asset pipelines.

During the post_transformers migration (March–May 2026, 6 chapters live at https://post-transformers-guide.brandon-m-behring.workers.dev), several patterns emerged that *every* book project would want:

- Three-tier responsive typography (`--measure-main` 65/80/90ch at 1440/1920px)
- Left chapter-navigation sidebar (docs-style layout)
- KaTeX strict-mode math integration
- BibTeX → JSON bibliography pipeline
- PDF→SVG + Jupyter→HTML asset pipelines (graceful-skip in CI)
- 10 academic callouts + Theorem family + utility components (`<Cite>`, `<XRef>`, `<Figure>`, `<CodeRef>`, `<CodeBlock>`, etc.)
- `.gitleaks.toml` allowlist for bibkey false-positives
- Workers + Static Assets deploy via `wrangler.toml`

v2.0's job: backport these into the scaffold as **opt-in features behind a `BOOK_PROFILE` env var**, without disrupting v1 consumers. Existing books (`book-template-astro`, `post_transformers/guides/web/`) freeze on their current state — they don't auto-pull v2.0 (Q9 locked).

## 2. Profile architecture

```bash
# Per-book opt-in at install or run time.
BOOK_PROFILE=academic npm run dev   # KaTeX + BibTeX + academic callouts
BOOK_PROFILE=tools    npm run dev   # volatility/tiers + tools callouts + convergence
BOOK_PROFILE=minimal  npm run dev   # default; just Tufte layout + base callouts
```

**Wiring pattern** (Q3 locked, "read env at top, branch config object"):

```js
// astro.config.mjs
const profile = process.env.BOOK_PROFILE ?? 'minimal';

const integrations = [mdx(), preact()];
const remarkPlugins = [];
const rehypePlugins = [];

if (profile === 'academic') {
  remarkPlugins.push(remarkMath);
  rehypePlugins.push([rehypeKatex, { strict: 'error', macros: ssmMacros }]);
}

export default defineConfig({
  integrations,
  markdown: { remarkPlugins, rehypePlugins, shikiConfig: { ... } },
});
```

The same `profile` variable is read by:
- `astro.config.mjs` — wires integrations + math plugins
- `src/content.config.ts` — picks the Zod schema (academic 7-state status vs tools volatility/tiers)
- `src/layouts/Base.astro` — conditional KaTeX CSS import
- `package.json` `prebuild` / `predev` — runs `build:bib` for academic, `build:sources` for tools

No `book.config.ts` file (avoided per Q1 — env var is simplest). No multiple `.mjs` configs (Q3 option D rejected — file proliferation). No helper function indirection (Q3 option B rejected — explicit branches in `defineConfig` are clearest).

## 3. Delta walk — scaffold (current) vs post-transformers (reference)

Each subsection is one of the audit pairs from the plan. Format: scaffold-has → post-transformers-has → v2.0 canonical.

### 3.1 `package.json` dependencies
- Scaffold: `@astrojs/mdx`, `@astrojs/preact`, `astro`, `pagefind`, `preact`, fonts. No math, no citations.
- post-transformers: adds `katex ^0.16`, `remark-math ^6`, `rehype-katex ^7`, `@citation-js/core ^0.7`, `@citation-js/plugin-bibtex ^0.7`.
- **v2.0**: add all 5 to scaffold's `dependencies`. Conditionally loaded by `astro.config.mjs` so minimal profile doesn't materialize them at build time (bundle splitting handled by Astro; the deps are just *available*).

### 3.2 `astro.config.mjs`
- Scaffold: `mdx() + preact()`, Shiki css-variables theme. No remark/rehype plugins.
- post-transformers (`guides/web/astro.config.mjs`): adds `remarkMath` + `rehypeKatex` with `strict: 'error'` and ssmMacros imported from `src/lib/katex-macros.ts`.
- **v2.0**: read `BOOK_PROFILE` at top; branch integrations and plugins per profile (see section 2). Shiki config stays as-is.

### 3.3 `src/content.config.ts` schema
- Scaffold (v1): `title`, `part`, `chapter`, `volatility` (3 levels), `tools_compared`, `last_verified`, `sources`, plus `sources` and `changelog` and `patterns` collections.
- post-transformers (`guides/web/src/content.config.ts`): `week`, `part` (5 academic parts), `title`, `status` (7-state), `roadmap_lines`, `code_path`, `tests_path`, `notebook_path`. Just the `chapters` collection.
- **v2.0**: profile-gated schema. Both schemas defined; `BOOK_PROFILE` selects which Zod object is exported as `chapters` collection's schema. `sources` / `changelog` / `patterns` collections stay (tools profile uses them; academic profile ignores them).

### 3.4 Callouts (`src/components/callouts/`)
- Scaffold v1: `SkillBox`, `CaseStudy`, `ConceptBox`, `KeyIdea`, `TryThis`, `Recovery`, `Convergence`, `Divergence` (8).
- post-transformers (`guides/web/src/components/callouts/`): `NoteBox`, `ExampleBox`, `DynConnect`, `InsightBox`, `WarnBox`, `CounterBox`, `TipBox`, `OpenQuestion`, `PaperBox`, `ResultBox` (10).
- **v2.0**: both families coexist (Q3 locked). All 18 callouts shipped. Author imports what they want. Profile controls which is exported as "default suggested" in the chapter-template examples (Phase D).

### 3.5 Utility components
- Scaffold v1: `Sidenote`, `Citation` (slug-based, reads `sources/manifest.yaml`), `ChapterHeader` (volatility/freshness/tools_compared aware), `ChapterNav`, `ChapterTOC`, plus tools-specific `PatternTimeline`, `SourceArchive`, `ToolFilter.tsx`, `VersionSelector.tsx`.
- post-transformers: `Sidenote` (compatible), `Cite` (bibkey-based, reads `src/data/references.json`), `ChapterHeader` (academic schema), `Theorem`, `XRef`, `Figure`, `MarginNote`, `WeekRef`, `CodeRef`, `CodeBlock`, `Tag`, `StatusBadge`.
- **v2.0**: keep scaffold's tools-profile components; add post-transformers' academic + universal components. Universal ones (`<Figure>`, `<MarginNote>`, `<CodeRef>`, `<CodeBlock>`, `<Theorem>`) become CORE. Profile-specific (`<Citation>` vs `<Cite>`) coexist. ChapterHeader becomes profile-aware (Zod schema branches drive which fields are rendered).

### 3.6 `Sidebar.astro` (new in v2.0)
- Scaffold v1: no sidebar component.
- post-transformers (`guides/web/src/components/Sidebar.astro`, added 2026-05-18 commit `2eaef5d`): reads `getCollection('chapters')`, groups by `part`, sorts by `week`, highlights current page via `Astro.url.pathname` match.
- **v2.0**: verbatim port to scaffold. Adapt the `partLabel` map to support either schema (`'foundations' | 'ssm-core' | ...` for academic, `1..5` for tools). One paint of polish: when sidebar runs under tools profile, sort by `chapter` not `week`.

### 3.7 `Base.astro` layout shell
- Scaffold v1: `Base.astro` loads fonts + tokens + typography + layout + callouts + chapter + tool-filter + convergence + print CSS. ToolFilter and VersionSelector islands top-right.
- post-transformers: `Base.astro` loads same minus tool-filter/convergence CSS. Adds `showSidebar` prop default true; wraps content in `<div class="layout-with-sidebar"><Sidebar />{slot}</div>` when true.
- **v2.0**: take post-transformers' showSidebar pattern. CSS imports stay scaffold-style (load tool-filter/convergence CSS conditionally per profile — or unconditionally since they're tiny). ToolFilter/VersionSelector chrome remains tools-profile but hidden via CSS when `BOOK_PROFILE !== 'tools'`.

### 3.8 `Chapter.astro` layout
- Scaffold v1: wraps Base, renders ChapterHeader + ChapterTOC + slot + ChapterNav.
- post-transformers: wraps Base, renders ChapterHeader + slot. (No ChapterTOC, no ChapterNav — those got deleted during the post-transformers migration; could be added back.)
- **v2.0**: keep scaffold's structure (Header + TOC + slot + Nav). ChapterHeader becomes profile-aware. ChapterTOC and ChapterNav both stay CORE — useful in either profile.

### 3.9 `ChapterHeader.astro`
- Scaffold v1: shows part + chapter number + volatility badge + freshness badge + tools_compared badges + last_verified date.
- post-transformers: shows part label + "Week N" + StatusBadge (3-state public translation) + companion artifact links (code/tests/notebook paths).
- **v2.0**: branch on `BOOK_PROFILE`. Both renderings in one component, conditionally rendered. Frontmatter schema dictates which fields are valid; component checks profile to render the right view. (Alternative: two separate `ChapterHeaderAcademic.astro` + `ChapterHeaderTools.astro`; Base composes the right one. Cleaner. Defer the choice to execution.)

### 3.10 `tokens.css` — typography measures
- Scaffold v1: `--measure-main: 65ch`, `--measure-side: 28ch`, `--breakpoint-narrow: 48rem`. No wider breakpoints.
- post-transformers (`guides/web/src/styles/tokens.css` commit `d9d085b`): adds `--breakpoint-wide: 90rem` and `--breakpoint-ultrawide: 120rem`. `@media (min-width: 90rem)` sets `--measure-main: 80ch` and `--measure-side: 24ch`. `@media (min-width: 120rem)` sets `--measure-main: 90ch` and `--measure-side: 26ch`.
- **v2.0**: verbatim port to scaffold. Same three-tier strategy. CORE — every profile benefits.

### 3.11 `layout.css` — sidebar grid + .prose
- Scaffold v1: `.prose` Tufte 2-column. No `.layout-with-sidebar` rules.
- post-transformers (`guides/web/src/styles/layout.css` commit `2eaef5d`): adds `.layout-with-sidebar` grid at `@media (min-width: 64rem)` — `grid-template-columns: 16rem 1fr` at 64rem+, `18rem 1fr` at 90rem+. Below 64rem, sidebar `display: none`.
- **v2.0**: verbatim port. CORE.

### 3.12 Chapter routing pages
- Scaffold v1: `src/pages/chapters.astro` lists all chapters at `/chapters`. `src/pages/[...slug].astro` is the dynamic chapter route — currently at root level, so URLs are `/<slug>/`.
- post-transformers: `src/pages/chapters/index.astro` lists all at `/chapters/`. `src/pages/chapters/[...slug].astro` routes chapters at `/chapters/<slug>/`. The nested `/chapters/` namespace is cleaner because the landing page (`/`) can live separately.
- **v2.0**: adopt post-transformers' nested routing. Migration path for v1 consumers: documented in `recipes/05-deploy-cloudflare.md` with redirect rules.

### 3.13 `wrangler.toml` (new in v2.0)
- Scaffold v1: no `wrangler.toml`. Uses `.github/workflows/deploy.yml` (legacy Pages OAuth via GitHub Action).
- post-transformers (`guides/web/wrangler.toml`): Workers + Static Assets configuration. `name = "<project>"`, `compatibility_date`, `[assets] directory = "./dist/"`.
- **v2.0**: add template `wrangler.toml` to scaffold root. Keep `.github/workflows/deploy.yml` as alternative for users on legacy Pages. Recipe `recipes/05-deploy-cloudflare.md` explains both paths + when to choose each.

### 3.14 `.gitleaks.toml` (new in v2.0)
- Scaffold v1: no `.gitleaks.toml`.
- post-transformers (`/.gitleaks.toml`): extends default ruleset; allowlists `references/dossier/.+/bib_ledger\.yml`, `guides/shared/references\.bib`, `guides/web/src/content/chapters/.+\.mdx`, `references/dossier/.+/dataset_ledger\.yml` — bibkey false-positives.
- **v2.0**: ship template `.gitleaks.toml` with placeholder paths. Pre-flight check in `create-book.sh`: prompt user to install the gitleaks pre-commit hook.

### 3.15 `scripts/` pipelines (new in v2.0)
- Scaffold v1: no `scripts/` directory.
- post-transformers (`guides/web/scripts/`): `build-bib.mjs` (citation-js BibTeX→JSON), `build-figures.mjs` (pdftocairo PDF→SVG, graceful-skip), `render-notebooks.mjs` (jupyter nbconvert via uv, graceful-skip).
- **v2.0**: port all three. Conditional via `prebuild` and `predev` npm scripts that read `BOOK_PROFILE`: academic runs `build:bib + build:figures + build:notebooks`; tools runs (nothing for now); minimal runs (nothing).

### 3.16 `pedagogy/` docs
- Scaffold v1: 3 markdown docs (`kf-chapter-shape.md`, `source-tiers.md`, `volatility-classes.md`).
- post-transformers: none — it has `guides/STANDARDS.md` (LaTeX-legacy) and `guides/web/README.md`.
- **v2.0**: preserve `pedagogy/` as-is. Add `recipes/` directory alongside (Phase D scope). `recipes/07-chapter-shapes.md` references `pedagogy/kf-chapter-shape.md` for the Koller-Friedman doctrine + adds the academic week-based alternative.

## 4. Profile assignment table

### CORE — always shipped, no profile gating

- **Layout**: `Base.astro`, `Chapter.astro`, three-tier `tokens.css`, `.layout-with-sidebar` grid in `layout.css`, mobile sidenote-reflow rules.
- **Components**: `Sidebar.astro` (new), `Sidenote.astro`, `ChapterTOC.astro`, `ChapterNav.astro`, `Figure.astro`, `MarginNote.astro`, `CodeRef.astro`, `CodeBlock.astro`, `WeekRef.astro` (works in either profile — for academic week numbers OR tools chapter cross-refs).
- **Pages**: `index.astro` (landing), `chapters/index.astro`, `chapters/[...slug].astro`, `print.astro`, `search.astro`, `references.astro` (academic-only data binding but page itself is CORE).
- **Styles**: `tokens.css`, `typography.css`, `layout.css`, `callouts.css`, `chapter.css`, `print.css`.
- **Build**: Pagefind, Paged.js, Shiki css-variables, dark mode `data-theme` + `prefers-color-scheme`.
- **Templates**: `wrangler.toml`, `.gitleaks.toml`, `.gitignore`, `LICENSE`, `LICENSE-CONTENT`.
- **AI guides**: `CLAUDE.md`, `AGENTS.md` (Phase D scope, but both profiles get them).
- **Recipes**: 00–10 (Phase D scope).

### ACADEMIC PROFILE — `BOOK_PROFILE=academic` opt-in

- **Schema**: 7-state status (`implemented` / `chapter_only` / etc.), `week` field, `part` enum of 5 academic strings, `roadmap_lines`, `code_path`, `tests_path`, `notebook_path`.
- **Components**: 10 academic callouts (NoteBox, ExampleBox, DynConnect, InsightBox, WarnBox, CounterBox, TipBox, OpenQuestion, PaperBox, ResultBox), Theorem family component, Cite (bibkey-based), XRef, Tag, StatusBadge.
- **Pipelines**: `build:bib` (BibTeX → references.json), KaTeX wiring in `astro.config.mjs`, `katex/dist/katex.min.css` import in Base.astro.
- **Optional pipelines**: `build:figures` (pdftocairo), `render:notebooks` (jupyter). These are CORE conceptually but only academic books typically use them. They graceful-skip when tools missing, so safe to wire under academic profile only.
- **Library**: `src/lib/katex-macros.ts` (36 SSM-specific macros + 16 general).

### TOOLS PROFILE — `BOOK_PROFILE=tools` opt-in

- **Schema**: volatility (3 classes), tools_compared, last_verified, T1-T4 source tiers, `sources` slug array.
- **Components**: 8 tools callouts (SkillBox, CaseStudy, ConceptBox, KeyIdea, TryThis, Recovery, Convergence, Divergence), Citation (slug-based), PatternTimeline, SourceArchive, ToolFilter island, VersionSelector island, freshness/volatility badges in ChapterHeader.
- **Pipelines**: none (YAML manifest is read directly via content collection).
- **Collections**: `sources` (sources/manifest.yaml), `changelog` (changelog/tools/*.yaml), `patterns` (changelog/patterns.yaml).
- **Pages**: `convergence.astro` (dashboard).

### DEFER — not in v2.0

- **npm packaging** — locked as v3.0 work (Q9 revised). Scaffold stays a GitHub template; npm publishing happens when triggered.
- **Tools-profile dashboards from book-template-astro** — convergence dashboard, tool-filter UI, freshness badges. These exist in `book-template-astro` but were *book-specific*, not template-worthy. Stay in book-template-astro; do not backport.
- **Chapter-shape templates** — `examples/chapter-template-academic.mdx` and `examples/chapter-template-tools.mdx` per Q5 — these go into Phase D, not Phase C. Phase C is component/pipeline backport only.

## 5. Phase C execution checklist (sub-phase → file ops)

### C.1 KaTeX integration
- **Add**: `src/lib/katex-macros.ts` (copy from `post_transformers/guides/web/src/lib/katex-macros.ts`).
- **Modify**: `astro.config.mjs` — read `BOOK_PROFILE`, conditionally add `remarkMath` + `rehypeKatex`.
- **Modify**: `src/layouts/Base.astro` — conditional `katex/dist/katex.min.css` import.
- **Modify**: `package.json` — add `katex`, `remark-math`, `rehype-katex` to deps.
- **Add**: `recipes/01-add-math.md`.
- **Verify**: `BOOK_PROFILE=academic npm run build` renders an MDX page with `$x^2$` as KaTeX HTML. `BOOK_PROFILE=minimal npm run build` does not load KaTeX CSS in the output.

### C.2 Bibliography pipeline
- **Add**: `scripts/build-bib.mjs` (copy from post-transformers).
- **Add**: `src/components/Cite.astro` (academic bibkey-based citation).
- **Add**: `src/pages/references.astro` (auto-rendered bibliography page).
- **Modify**: `package.json` — add `@citation-js/core`, `@citation-js/plugin-bibtex`; add `prebuild` and `predev` running `build:bib` when `BOOK_PROFILE=academic`.
- **Add**: `.gitleaks.toml` template with bibkey allowlist.
- **Modify**: `.gitignore` — gitignore `src/data/references.json` (derived artifact).
- **Add**: `bibliography.bib` (empty placeholder at scaffold root for new books to fill in).
- **Add**: `recipes/02-bibliography-pipeline.md`.

### C.3 Asset pipelines (figures + notebooks)
- **Add**: `scripts/build-figures.mjs`, `scripts/render-notebooks.mjs` (copy from post-transformers, already graceful-skip).
- **Modify**: `package.json` — add `build:figures`, `build:notebooks`; wire conditionally in prebuild.
- **Modify**: `.gitignore` — gitignore `public/figures/`, `public/notebooks/` when generated locally; or *un*-ignore if committing artifacts (Cloudflare workaround).
- **Add**: `recipes/03-asset-pipelines.md` — documents the "commit derived artifacts" pattern.

### C.4 Academic callouts + utility components
- **Add**: 10 callouts to `src/components/callouts/` (copy from post-transformers).
- **Add**: `src/components/Theorem.astro`.
- **Add**: `src/components/{XRef,Figure,MarginNote,WeekRef,CodeRef,CodeBlock,Tag,StatusBadge}.astro` (copy from post-transformers; mark CORE not academic-only).
- **Modify**: `src/content.config.ts` — academic schema variant + profile dispatcher.
- **Add**: `recipes/04-component-library.md`.

### C.5 Workers + Static Assets deploy
- **Add**: `wrangler.toml` template at scaffold root with placeholders.
- **Update**: `.github/workflows/deploy.yml` — note in comments that this is the legacy path; new books should prefer `wrangler.toml` + Cloudflare's GitHub integration.
- **Add**: `recipes/05-deploy-cloudflare.md` documenting both paths.

### C.6 Layout — three-tier + sidebar
- **Modify**: `src/styles/tokens.css` — port three-tier breakpoint values.
- **Add**: `src/components/Sidebar.astro` (copy from post-transformers, generalize partLabel map for both schemas).
- **Modify**: `src/layouts/Base.astro` — `showSidebar` prop + `.layout-with-sidebar` wrapper.
- **Modify**: `src/styles/layout.css` — add sidebar grid rules.
- **Modify**: `src/pages/index.astro` — set `showSidebar={false}` (landing pages get no sidebar).
- **Add**: `recipes/06-mobile-first-layout.md`.

### C.7 Validation tooling
- **Add**: `scripts/validate.mjs` (~150 lines per plan Q14). Checks bibkeys, XRef labels, figures, CodeBlock line ranges, frontmatter Zod, KaTeX strict, internal links.
- **Modify**: `package.json` — add `validate` script; wire into pre-commit hook.
- **Add**: `recipes/09-validation.md`.

## 6. Not in v2.0 (intentional)

- **npm package distribution** — Q9 locked as v3.0 work. Scaffold stays a GitHub template. When v3.0 triggers, package name is `@brandon-behring/book-scaffold-astro` with profile-conditional subpath exports.
- **Convergence dashboard / tool-filter UI from book-template-astro** — book-specific, not template-worthy. Stay in book-template-astro.
- **Chapter-shape templates** (`examples/chapter-template-{academic,tools}.mdx`) — Phase D scope, not Phase C.
- **CLAUDE.md / AGENTS.md** — Phase D scope. Phase C ships components + pipelines only.
- **License files** (LICENSE / LICENSE-CONTENT) — Phase E scope. v2.0 release includes them; Phase C does not.
- **Validator's "broken link" check that crawls all internal URLs** — defer the crawler; v2.0 validator only checks frontmatter+bibkey+label+figure references.
- **i18n / multi-language Pagefind index** — deferred; English-only at v2.0.

---

## Appendix — file path quick reference

| Pattern | Scaffold path | Post-transformers reference |
|---|---|---|
| Profile config | `astro.config.mjs` (read BOOK_PROFILE) | `guides/web/astro.config.mjs:8-12` |
| KaTeX macros | `src/lib/katex-macros.ts` | `guides/web/src/lib/katex-macros.ts` |
| Bibliography script | `scripts/build-bib.mjs` | `guides/web/scripts/build-bib.mjs` |
| Sidebar | `src/components/Sidebar.astro` | `guides/web/src/components/Sidebar.astro` |
| Three-tier breakpoints | `src/styles/tokens.css:67-100` | `guides/web/src/styles/tokens.css:67-100` |
| Sidebar grid | `src/styles/layout.css:19-49` | `guides/web/src/styles/layout.css:19-49` |
| Workers deploy | `wrangler.toml` | `guides/web/wrangler.toml` |
| Gitleaks allowlist | `.gitleaks.toml` | `/.gitleaks.toml` |
