# Changelog

All notable changes to `book-scaffold-astro`. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [SemVer](https://semver.org/).

## [2.0.0] — 2026-05-18

### Added

- **Profile-aware architecture**: `BOOK_PROFILE` env var dispatches schemas, integrations, and recipe defaults across three profiles:
  - `academic` — KaTeX 36-macro library, BibTeX citation pipeline, 10 academic callouts + `Theorem` family, 7-state status frontmatter, week/part(enum) schema
  - `tools` — 8 tools callouts (SkillBox/CaseStudy/.../Convergence/Divergence), volatility + T1-T4 source tiers, chapter/part(numeric) schema, convergence dashboard
  - `minimal` — falls back to tools schema; single-author manifesto / essay collection
- **KaTeX math integration** (`src/lib/katex-macros.ts`, 36 macros). Gated on `BOOK_PROFILE=academic`; CSS always loaded so dark/light themes don't FOUC. New deps: `katex ^0.16`, `remark-math ^6`, `rehype-katex ^7`.
- **BibTeX → CSL JSON pipeline** (`scripts/build-bib.mjs`). Default reads `bibliography.bib` at scaffold root; override via `BOOK_BIB_PATH`. New deps: `@citation-js/core`, `@citation-js/plugin-bibtex`.
- **PDF figure pipeline** (`scripts/build-figures.mjs`). PDF → SVG via `pdftocairo` with `pdftoppm` fallback. Graceful-skip on Cloudflare build container (tools missing → serves committed artifacts).
- **Jupyter notebook pipeline** (`scripts/render-notebooks.mjs`). ipynb → HTML via `uv run jupyter nbconvert`. Style-scoped via `.notebook-frame` wrapper. Graceful-skip when `uv` missing.
- **Three-tier Tufte layout** in `tokens.css`: 65ch (default) / 80ch (≥90rem) / 90ch (≥120rem); sidenote column 28/24/26ch.
- **Left chapter-nav sidebar** (`src/components/Sidebar.astro`). Profile-aware grouping (academic by part enum + sort by week; tools/minimal by numeric part + sort by chapter). Hidden below 64rem. Toggle per-page via `showSidebar` prop on `Base.astro` (default true).
- **Academic callout family** (10 components): NoteBox, ExampleBox, DynConnect, InsightBox, WarnBox, CounterBox, TipBox, OpenQuestion, PaperBox, ResultBox. Coexists with the existing 8 tools callouts.
- **Theorem family**: unified `Theorem.astro` component supporting theorem / proposition / lemma / corollary / definition / example / exercise / remark / proof via `type` prop.
- **Utility components**: Cite, XRef, Figure, MarginNote, WeekRef, CodeRef, CodeBlock, Tag, StatusBadge. Available in any profile.
- **Pre-flight content validator** (`scripts/validate.mjs`, ~150 lines). Checks unknown `<Cite key>` / `<XRef id>` / missing `<Figure src>` files / unresolved internal links / out-of-bounds `<CodeRef line>`. Wired into prebuild + recommended pre-commit.
- **Wrangler.toml deploy template** for Cloudflare Workers + Static Assets (the unified post-Pages path). Legacy Pages OAuth workflow preserved as alternative.
- **`.gitleaks.toml` allowlist template** for bibkey false-positives in chapter MDX and `references.bib`.
- **Eleven recipes** under `recipes/`:
  - 00-getting-started, 01-add-math, 02-bibliography-pipeline, 03-asset-pipelines
  - 04-component-library, 05-deploy-cloudflare, 06-mobile-first-layout
  - 07-chapter-shapes, 08-decisions-ledger, 09-validation, 10-custom-domain
  - README index
- **Chapter-shape templates** in `examples/`: `chapter-template-academic.mdx` (week-based) and `chapter-template-tools.mdx` (Koller-Friedman).
- **AI authoring guides** at root: `CLAUDE.md` (Claude Code auto-loaded, references hub at `~/Claude/lever_of_archimedes/patterns/`) + `AGENTS.md` (cross-tool pointer to CLAUDE.md).
- **Profile-aware demo chapter** at `src/content/chapters/_week01-hello-world.mdx` (underscore-prefixed so it's excluded from default glob; `create-book.sh` un-prefixes and swaps frontmatter shape based on `--profile` flag).
- **Dual license**: `LICENSE` (MIT, applies to code) + `LICENSE-CONTENT` (CC-BY-4.0, applies to prose / book content).

### Changed

- `astro.config.mjs` reads `BOOK_PROFILE` at top and conditionally adds remark-math / rehype-katex when `academic`.
- `src/content.config.ts` dispatches schema by profile: academic 7-state status vs tools volatility + sources.
- `src/layouts/Base.astro` adds `showSidebar` prop; conditionally mounts tools-chrome islands (ToolFilter, VersionSelector) only when `BOOK_PROFILE !== 'academic'`.
- `package.json` prebuild now chains `build:assets && validate`.
- `create-book.sh` accepts `--profile=academic|tools|minimal`; writes `BOOK_PROFILE` to `.env`; activates the appropriate demo chapter; points new users at the recipes index.
- `README.md` rewritten to reflect v2.0 profile-aware architecture, lists recipes, references reference implementations.

### Decisions ledger

The v2.0 architecture encodes 15 design decisions reached via Q&A (locked 2026-05-18). See [`recipes/08-decisions-ledger.md`](recipes/08-decisions-ledger.md) for the full record; the master plan with discussion lives at `~/.claude/plans/i-want-to-investigate-recursive-yao.md`.

### Reference implementations

- **Academic profile**: `~/Claude/post_transformers/guides/web/` — deployed at `post-transformers-guide.brandon-m-behring.workers.dev`. The v2.0 backport ports its KaTeX, BibTeX pipeline, academic callouts, sidebar, and three-tier breakpoints into the scaffold.
- **Tools profile**: `~/Claude/book-template-astro/` — *Agentic Coding: Principles and Practices*, the v0.x reference implementation. Stays as a book instance; not migrated to consume v2.0 (per decision D11).

### Migration notes

v2.0 is for **new books only**. Existing books (`post_transformers`, `book-template-astro`) stay on their current code. Bug fixes in scaffold v2.0 don't auto-flow downstream; that's the explicit cost of the low-churn release (Q9 / D11). v3.0 (deferred) will publish the scaffold as `@brandon-behring/book-scaffold-astro` and migrate both existing books.

## [0.x] — 2026-02 → 2026-04

Pre-2.0 development extracted from *Agentic Coding: Principles and Practices* at v0.2-stage3-complete (2026-04-18). Methodology for volatility classes and source tiers migrated conceptually from the LaTeX book *Claude Best Practices* at v2.9 (2026-03-27).

Pre-2.0 features: Astro 6 + MDX, Tufte 2-column layout, 8 tools callouts, Pagefind, Paged.js PDF, Warm Tol 5-hue palette, dark mode. See git history for full pre-2.0 detail.

---

[2.0.0]: https://github.com/brandon-behring/book-scaffold-astro/releases/tag/v2.0.0
