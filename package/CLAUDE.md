# CLAUDE.md — Authoring guide for AI assistants

This file is auto-loaded by Claude Code (and cross-tool agents via the symmetric `AGENTS.md`) when working in a repo bootstrapped from `book-scaffold-astro`. Read this first; the patterns below are pre-tested.

## Inherits from

Cross-project conventions live in the hub at `~/Claude/lever_of_archimedes/patterns/`. Defer to those for:

- **Git commit format** — `~/Claude/lever_of_archimedes/patterns/git.md`
- **Testing patterns** — `~/Claude/lever_of_archimedes/patterns/testing.md`
- **Session workflows** — `~/Claude/lever_of_archimedes/patterns/sessions.md`

If the hub isn't available in your environment (e.g. external contributor), the scaffold's `CHANGELOG.md` documents commit conventions inline.

## Profile

Read `BOOK_PRESET` (preferred) or its `BOOK_PROFILE` compatibility alias from
the environment or `.env`. It controls:

- Which of the five content-collection schemas is enforced
- Which markdown integrations run (KaTeX for `academic` and `research-portfolio`)
- Which callout family is the "default" import in templates
- Whether the ToolFilter Preact island mounts in the automatic chrome row

When in doubt, run `grep -E 'BOOK_(PRESET|PROFILE)' .env astro.config.mjs src/content.config.ts` to see the wiring.

`VersionSelector` is different: it is a manual, prop-driven island because only
the consuming book knows which versions are actually deployed. Import it from
`@brandon_m_behring/book-scaffold-astro/components/VersionSelector`, pass
`versions: [{ href, label, date, current? }]`, and hydrate it where your own
navigation belongs. It renders nothing for an omitted or empty manifest;
`Base.astro` never invents or auto-mounts version links.

## Frontmatter schemas

**Universal field (v4.9.0):** every profile accepts an optional `slug:` string that overrides the URL. A file `99-appendix.mdx` with `slug: appendix` is served at `/chapters/appendix/` — Astro's glob loader maps frontmatter `slug` → `entry.id`, and cross-references (`<XRef>`, via `build-labels`) resolve to the same path. Omit it and the URL falls back to the filename. Use it to keep numbered filenames for ordering while publishing clean URLs.

### Academic profile (`src/content.config.ts:academicChapterSchema`)

```yaml
---
week: 1                  # int, required, 1-99
part: foundations        # required: foundations|ssm-core|beyond-ssm|integration|synthesis
title: "..."             # string, required
status: implemented      # required: implemented|chapter_only|prose_only|code_only|reading_only|scaffolded|planned
# optional:
slug: ch01-introduction  # clean URL override; else filename → /chapters/<slug>/
roadmap_lines: [10, 42]  # [start, end] line refs into roadmap.md
code_path: experiments/jax/week01/foo.py
tests_path: experiments/jax/week01/test_foo.py
notebook_path: notebooks/week01.ipynb
description: "..."       # SEO/meta
draft: false
---
```

### Tools profile (`src/content.config.ts:toolsChapterSchema`)

```yaml
---
title: "..."                       # required
part: 1                            # int, required, 0-10
chapter: 1                         # int, required, 0-99
volatility: architectural-pattern  # required: stable-principle|architectural-pattern|feature-surface
tools_compared: [claude-code]      # required, ≥1 of: claude-code|gemini-cli|codex-cli|cross-tool
last_verified: 2026-05-18          # date, required
sources: []                        # array of source-manifest keys
# optional: slug (clean URL override), description, draft, updated
---
```

### Research-portfolio profile (`src/schemas.ts:researchPortfolioChapterSchema`)

Hybrid of academic + tools provenance with research-paper-style inline sources. Only `title` + `last_verified` are required; all hierarchy and classification fields are optional.

```yaml
---
title: "..."                       # required
last_verified: 2026-05-19          # date, required
# optional — hierarchy (use whichever fits; all may be omitted)
slug: ch01-introduction            # defaults to filename
chapter: 1
part: 1                            # number OR academic-style string enum
week: 1
# optional — status (AUTHORING state) vs freshness (EPISTEMIC type) are ORTHOGONAL
status: prose_only                 # 'scaffolded'|'prose_only'|'code_only'|'chapter_only'|'reading_only'|'implemented'|'planned'
freshness: experimental-result     # 'experimental-result'|'literature-survey'|'theoretical'|'reference'
# optional — provenance + inline sources (T1-T4 tiers)
volatility: feature-surface        # 'stable-principle'|'architectural-pattern'|'feature-surface'
tags: [prompt-injection, ...]      # freeform string array
sources:
  - tier: T1
    url: https://...
    label: Primary source
# optional: description, draft, updated, author, published, image (SEO/og:*)
---
```

**`status` vs `freshness` is the #1 author gotcha.** `status` = authoring state (have I written it?). `freshness` = epistemic type (what kind of evidence?). A chapter can be `status: scaffolded` (not written yet) AND `freshness: theoretical` (will be a math argument). See Recipe 13 for the full table.

## Component reference

Two callout families coexist. Authors import what they need.

**Tools family** (8 components, imported from the flat `@brandon_m_behring/book-scaffold-astro/components/<Name>.astro` path): `SkillBox`, `CaseStudy`, `ConceptBox`, `KeyIdea`, `TryThis`, `Recovery`, `Convergence`, `Divergence`.

**Academic family** (10 components, using the same flat import path): `NoteBox`, `ExampleBox`, `DynConnect`, `InsightBox`, `WarnBox`, `CounterBox`, `TipBox`, `OpenQuestion`, `PaperBox`, `ResultBox`. Plus `Theorem` (unified for theorem/proposition/lemma/corollary/definition/example/exercise/remark/proof). **Props (v4.14.3, #121):** `kind=` is canonical; `type=` is accepted as a legacy alias (likewise `title=`/`label=` alias `name=`). An absent or unknown kind **throws at build** (via `src/lib/theorem-label`) rather than rendering an empty label; `book-scaffold validate` flags a `<Theorem>` with neither `kind=` nor `type=` even earlier. **Numbering (v4.18.0+, #126/#175):** a theorem with an `id` auto-numbers from `labels.json` — the same index `<XRef>` reads — so the heading number equals every cross-reference to it by construction; explicit `n=` is a fallback for un-id'd theorems. `build-labels` indexes the kind-accurate word (`Proposition 8.1`, not a kind-blind `Theorem 8.1`) and throws on an unknown kind. The theorem family shares one counter by default; set `numberStyle: 'per-kind'` in `defineBookConfig` or a composed `defineStyle` for independent theorem/proposition/lemma/etc. sequences. A `label=` override stays unnumbered and consumes no counter.

**Pedagogy family** (v4.1.0+, any profile, 4 components): `Pitfall` (rose; "common mistake" — distinct from `WarnBox`'s preemptive warning), `WorkedExample` (plum; collapsible `<details>` block with `#worked-example-{id}` anchor for deep links), `YouWillLearn` (gold; chapter-opener with optional `prerequisites` prop), `Diagnostic` (v4.19.0, #110; teal; pre-reading "Do I Know This Already?" DIKTA self-check — a slotted question list + a skip/skim/read routing rubric via `skimTo`, plus an optional collapsible answer key via `slot="answers"`). Slot bullets/code freely; render at any preset.

**Utility components** (`src/components/`, any profile): `Cite`, `XRef`, `Figure`, `MarginFigure`, `MarginNote`, `Sidenote`, `EvidenceTag`, `Newthought`, `Epigraph`, `WeekRef`, `CodeRef`, `CodeBlock`, `Tag`, `StatusBadge`, `BookLink` (v4.16.0+; cross-book link — `<BookLink book="design" to="…"/>` resolves `book` against `defineBookConfig({ siblingBooks })` and throws on an unknown book; `<XRef>` is in-book only — #96), `PocLayout` (v4.1.0+; wraps slot in a per-`kind` layout shell — 5 closed-union kinds; see `recipes/15-defining-styles.md`).

**`MarginNote` vs `Sidenote` (don't let the names mislead).** `MarginNote` renders **inline** — a colored callout in the running text column; despite the name it does **not** go in the margin. It's for a load-bearing aside the reader must see. `Sidenote` is the one that **floats into the right gutter** (auto-numbered Tufte marginalia, reflowing inline on mobile). Reach for `Sidenote` for footnote-like asides; `MarginNote` for an inline colored callout.

**`MarginFigure` + figure/content placement (1d).** `MarginFigure` is a `<Figure>` that **floats into the right gutter** (the same Tufte float + negative-margin technique `Sidenote`/SectionMap use — *not* a grid), shown at ≥64rem and reflowing inline below on mobile. Props mirror `<Figure>` (`src`/`caption`/`alt`/`desc`/`id`/`width`); rendering is delegated to `Figure`, and `width` defaults to `100%` (of the ~28ch gutter column). Two additive placement classes back it: **`.column-margin`** floats any block into the gutter (the un-figure version), and **`.column-page`** is a full-width breakout — an alias of the canonical **`.wide`** escape (max-width override, spans the gutter column too). For a full-bleed figure use `<Figure class="wide" …/>`; for the margin use `<MarginFigure …/>`. **Per-page width knob:** an optional `layout: wide` frontmatter field (closed enum `default`|`wide`, every profile) widens the main text measure for figure-/table-heavy chapters — `Chapter.astro` threads it as `data-layout="wide"` on `<article class="prose">` and `layout.css` maps `.prose[data-layout="wide"] { --measure-main: 80ch }`. Omitting it (or `layout: default`) emits no attribute, so existing chapters are byte-identical. All of these live in the always-loaded `layout.css` (token-only; additive — `.prose`'s block layout and `.sidenote`'s float are unchanged).

**`EvidenceTag`** (v4.25.0): inline claim-confidence pill placed right after a claim — `kind` is a closed union `verified | inference | audit-corrected` (fail-loud via `assertEnumProp`; colors green/blue/rose, token-only). Sibling of `Tag` (which flags claim *provenance*); `EvidenceTag` flags how well a claim has been *checked*. An optional `source` prop is reserved (rendered as `data-source`, no behavior yet) for a future fail-loud `validate.mjs` upgrade. Usage: `<EvidenceTag kind="verified" /> … <EvidenceTag kind="inference" />`.

**`Newthought` + `Epigraph`** (v4.25.0): Tufte typographic openers ported from the LaTeX book. `Newthought` is a run-in small-caps section opener (TRUE small-caps via `font-feature-settings: "smcp"`) — `<p><Newthought>In practice</Newthought>, …</p>`. `Epigraph` is a chapter-opening italic quotation with a right-aligned attribution (named `attribution` slot) — `<Epigraph>…<Fragment slot="attribution">Hamming</Fragment></Epigraph>`. Their CSS ships in the always-loaded `typography.css`; an opt-in `.heading-accent` (warm-blue italic) class is available there too (global headings are unchanged).

**Provenance** (v4.8.0, any profile, **auto-injected by the chapter route — not author-imported**): per-chapter "How this was made" audit-trail block, rendered from the optional `provenance` frontmatter (`ai_tools`, `prompts_archive`, `decisions_log`, `audit_history`, `citation_backstop`). **Opt-out**: a chapter with no `provenance` shows a fallback ("Audit history not yet recorded"). Distinct from `AICollaborationDisclosure` (book-level, manual model+role disclosure). Repo-relative path fields render as `<code>`; only `http(s)` values link.

**Study-guide (v4.17.0+, #112; opt-in).** A schema-validated `questions` content collection drives an exam-prep "question bank". Author questions under `src/content/questions/**.{md,mdx}` — frontmatter `id` (unique, required) / `type` (`mcq`|`free`|`cloze`) / `chapter` / `domain` (+ optional `part`/`bloom_level`/`objective_id`/`difficulty`), MDX body = the stem. MCQ carries `options: [{ id, text, correct }]` (exactly one `correct: true`); free-response carries an `answer` (model answer). An MCQ must **not** set `answer` — its answer is the option marked `correct`, and explanations for any type go in a `<Rationale>` body block. Declare the per-book domain taxonomy in `defineBookConfig({ examDomains: ['…'] })` — a question whose `domain` isn't registered **throws at build** (fail-loud, like `<BookLink>`'s `siblingBooks`). Enable the static `/practice-exam` route with `defineBookConfig({ routes: { practiceExam: true } })` (renders the bank grouped by domain with answers behind a `<details>` reveal; `cloze` is reserved/render-deferred). `<ObjectiveMap />` renders the exam-domain → chapter coverage matrix auto-derived from the collection (no separate data file). `<Rationale>` is a collapsible answer/explanation marker for a question's MDX body. `<Diagnostic>` (v4.19.0, #110) renders a per-chapter pre-reading "Do I Know This Already?" self-check (pedagogy family above; static `<details>` answer reveal). `<PartReview part={N} />` (v4.19.0, #111) aggregates a Part's `<Exercise>` items for interleaved review — reusing the `build-exercises` index + the chapters' `part` field (run `book-scaffold build-exercises` first; presence-gated otherwise). A **searchable glossary** (v4.19.0, #115): author terms under `src/content/glossary/**` (frontmatter `term` + an MDX-body definition), enable the static `/glossary` route via `defineBookConfig({ routes: { glossary: true } })`, and link inline with `<Term id="…">…</Term>` (→ `/glossary#term-<id>`). **Interactive layer (v4.21.0, #112-UI/#113/#114):** `/practice-exam` mounts the **ExamRunner island** (`client:idle`) — Start samples a form client-side (`sampleExam`), hides the rest of the bank + the answer reveals, scores checked radios on submit (`scoreExam`), and reads out per-domain results with weak-domain anchors (no JS → the static bank is the fallback). `<AssessmentTest />` is the whole-book front-matter diagnostic: a cross-domain sampled form whose weak-domain readout routes to the chapters carrying those domains' questions. The `/answers` route (`routes: { answers: true }`) is the Sybex back-appendix — every question grouped by chapter with the correct answer + rationale pre-expanded; `<Rationale appendix for="<id>">` renders inline as a link into it (and throws at build without `for=` or with the route disabled). **Flashcards (v4.22.0, #116):** the `/flashcards` route (`routes: { flashcards: true }`) turns the glossary into a spaced-recall deck — shuffled, one term at a time, flip-to-check, with knew-it/still-learning buckets persisted to localStorage and a "review unknown only" pass; no JS → the full front+back list reads like a compact glossary. That completes the study-guide epic (#122).

Full reference in `recipes/04-component-library.md`.

### Theme-change event (v4.14.2)

`Base.astro` emits `book:theme:change` on `window` whenever the **effective** theme changes — both the chrome's dark-mode toggle and a system `prefers-color-scheme` flip (the latter only when no explicit theme is pinned). Use it for **canvas / JS islands** that can't recolor via CSS alone; CSS-token elements recolor automatically from the `[data-theme]` attribute.

```ts
// inside a Preact island (client:visible / client:idle)
function currentTheme(): 'light' | 'dark' {
  const t = document.documentElement.getAttribute('data-theme');
  return t === 'light' || t === 'dark'
    ? t
    : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
useEffect(() => {
  draw(currentTheme());                                 // initial paint
  const onChange = (e: Event) => draw((e as CustomEvent).detail.theme);
  window.addEventListener('book:theme:change', onChange);
  return () => window.removeEventListener('book:theme:change', onChange);
}, []);
```

`detail.theme` is `'light' | 'dark'`. Pull design-token colors via `getComputedStyle(document.documentElement).getPropertyValue('--…')` so the canvas matches the page, and respect `prefers-reduced-motion` for any redraw animation. (Event-only by design — a `useThemeColors` helper graduates with the demo kit, #103.)

## Citation patterns

Academic profile uses BibTeX → `references.json`:

```mdx
The HiPPO theory <Cite key="gu2020hippo" /> shows that …
For the kernel decomposition see <Cite key="gu2024mamba" page="3" />.
```

Build: `npm run build:bib` reads `bibliography.bib` and writes `src/data/references.json`. Run after any `.bib` edit. The pre-build hook handles this automatically.

Tools profile uses the YAML source manifest (`sources/manifest.yaml`); cite via `sources` array in frontmatter, rendered by `SourceArchive.astro`.

## Build + dev commands

```bash
npm install                  # once after clone
npm run dev                  # localhost:4321
npm run build                # astro build + pagefind index → dist/
npm run validate             # pre-flight check (recipe 09)
npm run build:bib            # rebuild references.json after .bib edit
npm run pdf                  # render dist-pdf/book.pdf via Paged.js
```

Generated academic/research-portfolio books use `prevalidate` to rebuild
bibliography and label indexes before validation; the other presets keep those
steps in `prebuild`. Figure and notebook conversion remain explicit authoring
commands because their system tools are optional. `prepdf` always runs the
full site build before previewing `/print/` and rendering `dist-pdf/book.pdf`.

## Deploy

The generated `wrangler.toml` uses Cloudflare Workers + Static Assets for
academic/tools/minimal presets and Cloudflare Pages for course-notes and
research-portfolio. Recipe 05 documents both flows.

For monorepo Astro projects (Astro project in subdir), prefix build + deploy commands with `cd <subdir> &&`.

## Validation

`npm run validate` (also runs in prebuild) catches:

- Unknown `<Cite key>` (academic) — bibkey not in `references.json`
- Unknown `<XRef id>` — id not in `labels.json` (XRef silently renders `[?label]` otherwise)
- Literal `<Theorem n>` values that disagree with `labels.json` (dynamic expressions and `label=` overrides are skipped)
- Missing `<Figure src>` files under `public/`
- Internal markdown links that don't resolve
- Study-guide questions (v4.17.0, #112) — a question whose frontmatter `domain` isn't in `examDomains`, and duplicate question `id`s

Missing `src/data/labels.json` or `references.json` self-heals before checks by running the corresponding package build script; an existing artifact is never rewritten implicitly.

See `recipes/09-validation.md` to extend.

## Common authoring tasks

### Add a new chapter

1. Copy `examples/chapter-template-{academic,tools}.mdx` to `src/content/chapters/`.
2. Edit frontmatter (title, week/chapter, status/volatility).
3. Write.
4. `npm run dev` to preview at `/chapters/<slug>/`.

### Add a citation

1. Edit `bibliography.bib` (academic profile) — add the BibTeX entry.
2. `npm run build:bib` regenerates `src/data/references.json`.
3. Use `<Cite key="<bibkey>" />` in chapter.

### Add a figure

1. Drop a PDF in `figures/<topic>/<name>.pdf`, or a TikZ standalone `.tex` (auto-compiled), or set `BOOK_FIGURES_PATH`.
2. `npm run build:figures` produces `public/figures/<topic>/<name>.svg`.
3. Reference: `<Figure src="/figures/<topic>/<name>.svg" caption="..." alt="..." id="..." />`.

**Accessibility + dark mode (v4.11.0, #84).** `build:figures` rewrites every generated SVG so one file serves both themes: it adds `role="img"` and remaps the *neutral* fills/strokes to `var(--diagram-ink|paper|grid, <original>)` (saturated accent colors are left as authored). `<Figure>` **inlines** a local `.svg` (vs `<img>`), so the page's `--diagram-*` tokens cascade in and the figure tracks the in-page dark-mode toggle; `caption`/`alt`/`desc` become the SVG's `<title>`/`<desc>`. Notes:

- `alt` is the short accessible name (defaults to `caption`); `desc` is an optional longer description.
- Non-SVG (`.png` fallback), remote, or unreadable `src` keep the `<img>` render.
- Opt a figure out of theming with a `%! no-theme` line in its source `.tex`.
- After upgrading, re-run `npm run build:figures` to theme pre-existing figures (the rewrite is idempotent).

### Add a new component

1. Create `src/components/<Foo>.astro`.
2. Add an entry to `recipes/04-component-library.md`.
3. Update this file's "Component reference" section.

## Commit conventions

Inherit from the hub's `git.md`. Format:

```
type(scope): Short imperative subject

Body paragraphs explaining what and why.

- Bullet for each significant change
- Another bullet

Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>
```

Types: `feat` / `fix` / `refactor` / `docs` / `test` / `chore` / `release`. One commit per logical unit; small commits over big ones.

## Don't

- Don't use `npm create astro@latest` to bootstrap a fresh repo — the scaffold is not vanilla Astro.
- Don't bypass the validator with `--no-verify` on a commit. If validate fails, fix the underlying issue.
- Don't commit large binaries (PDFs > 5 MB, model checkpoints) — keep them in research-kb or a separate asset host.
- Don't auto-import from both callout families in the same chapter unless you have a reason. Pick a default family and stay with it.

## Reference repos

- `~/Claude/post_transformers/guides/web/` — academic-profile reference, deployed at `post-transformers-guide.brandon-m-behring.workers.dev`
- `~/Claude/book-template-astro/` — tools-profile reference, "Agentic Coding" book in production
- `~/Claude/book-scaffold-astro/` — this canonical scaffold

## Reading this guide didn't help?

- `recipes/README.md` — index of all recipes
- `recipes/08-decisions-ledger.md` — why everything is shaped the way it is
- `~/.claude/plans/i-want-to-investigate-recursive-yao.md` — full design discussion
