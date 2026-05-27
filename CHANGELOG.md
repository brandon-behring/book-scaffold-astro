# Changelog

All notable changes to `book-scaffold-astro`. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [SemVer](https://semver.org/).

## [4.6.0] — 2026-05-26

Minor release. Bundles four cleanups + one convention discovered during the 2026-05-26 first-deploys of `double_ml_time_series` and `ssm-foundations`, plus the validator-UX follow-on filed as issue #77:

1. **Primary** — `Base.astro` SEO meta-tag parity (canonical + og:* + twitter:* + article:* — closes the two-consumer gap relative to `brandon-behring.dev`'s apex).
2. **Secondary** — `@astrojs/sitemap` as a scaffold-default integration with per-profile filter defaults.
3. **Tertiary** — chapter-route ownership cleanup (Layer 3a/3b/3c — recipe + validator warning + create-book template).
4. **Convention** — recommend the `prevalidate` npm lifecycle hook (replaces the ad-hoc `ci:validate` workaround shipped by DML + ssm during Phase 1c).
5. **Bonus** (issue #77) — validator re-frames missing-references.json from 25+ "unknown bibkey" symptoms to a single leading error pointing at the prereq.

All additive. Existing consumers upgrade with zero config changes; new features opt-in via the `seo` + `author` defineBookConfig fields.

### Why

Page-source grep across three deployed sites surfaced the gap:

| Tag | ssm-foundations | dml.brandon-behring | brandon-behring.dev |
|---|---|---|---|
| `<link rel="canonical">` | 0 | 0 | 1 |
| `<meta property="og:*">` | 0 | 0 | ≥ 1 each |
| `<meta name="twitter:*">` | 0 | 0 | ≥ 1 each |
| `<link rel="sitemap">` | 0 | 0 | 0 |
| `/sitemap-index.xml` | 404 | 404 | 404 |

Two-consumer evidence on the SEO meta tags + three-consumer gap on sitemap emission made this a v4.6 priority. Bundled with the chapter-route ownership cleanup (also surfaced during the same deploys — Astro's filesystem routes silently shadowing the scaffold's v4.3.0+ auto-injected `/chapters/[...slug]/` route) and the validator-UX recipe pair (`prevalidate` convention + missing-prereq re-framing) since all four touch the same surface area.

### Added

- **Base.astro SEO meta tags** (Layer A, issue #76 Primary): emits 11 baseline tags on every page — `<link rel="canonical">`, `<link rel="sitemap">`, `<meta property="og:title|description|url|type|site_name|image?>`, `<meta name="twitter:card|title|description|image?|site?>`. `og:image` + `twitter:image` only emit when `defineBookConfig.seo.ogImage` (or per-page `Astro.props.ogImage`) is explicitly set — no automatic `'/og-default.png'` fallback (avoids broken-link OG tags on consumers without an OG image authored).
- **Chapter.astro article:* meta tags** (Layer A): passes `ogType="article"` to Base + emits `<meta property="article:author|published_time|modified_time|tag>` from chapter frontmatter via Base's `<slot name="head">`. Author falls back to top-level `bookConfig.author`.
- **`defineBookConfig({ author?: string, seo?: { ogImage?, twitterHandle?, sitemap?: { filter?, customPages? } } })`** — new optional fields. `seo.sitemap.filter` REPLACES the per-profile default (not composed); consumers wanting AND-composition copy the profile predicate into their own filter.
- **Chapter frontmatter `author?: string, published?: Date, updated?: Date, tags?: string[], image?: string`** — additive optional fields across all 4 chapter schemas (academic / tools / course-notes / research-portfolio). Existing chapters work unchanged; new chapters opt-in by declaring fields.
- **`@astrojs/sitemap` default integration** (Layer B, issue #76 Secondary): emits `/sitemap-index.xml` + per-route sitemaps at build. Per-profile filter defaults: academic + course-notes exclude `/print/`; tools + minimal + research-portfolio include all.
- **`book-scaffold validate` chapter-route shadow warning** (Layer 3b, issue #76 Tertiary): detects consumer-owned `src/pages/chapters/[...slug].astro` shadowing the scaffold's auto-injected route; emits a non-blocking warning unless the consumer set `routes: { chapters: false }` (intentional override). Edge-case-tested via `tests/v4.6-seo-and-sitemap.test.mjs` (4 cases).
- **`book-scaffold validate` missing-prereq abort** (Layer E, issue #77): when `src/data/references.json` is missing AND chapters use `<Cite>`, abort with ONE leading error pointing at `npm run build:bib` + the `prevalidate` convention. Replaces the 25+ "Unknown bibkey" symptom list that pointed at content instead of the missing prereq. Same treatment for missing `src/data/labels.json` when chapters use `<XRef>`.
- **`package/recipes/18-chapter-route-ownership.md`** (Layer 3a, new): documents the 3 valid states (default / intentional override / shadow anti-pattern); includes migration playbook for pre-v4.3.0 consumers.
- **`package/recipes/19-prevalidate-hook.md`** (Layer D, new): documents the `prevalidate` npm-lifecycle hook convention as the long-term replacement for `ci:validate` wrapper scripts; includes 3-file migration recipe for existing consumers.

### Changed

- **Virtual module rename**: `virtual:book-scaffold/landing-config` → `virtual:book-scaffold/book-config`. The data it carries (title, description, portfolio, enabledRoutes + new seo + author) is no longer landing-specific — `Base.astro` on every page imports it now. Single internal consumer updated (`package/pages/index.astro`). No backward-compat alias — the virtual module is internal-only API. Plugin function renamed `makeLandingConfigVitePlugin` → `makeBookConfigVitePlugin`.
- **`create-book` templates** (Layer 3c): removed `src/pages/chapters/[...slug].astro` from all 5 profile branches. New books on v4.6+ are clean from day one; scaffold's auto-injected route handles per-chapter rendering. Consumers wanting a custom layout opt-in via State 2 of recipe 18 (consumer-owned file + `routes: { chapters: false }`).
- **`create-book` templates** (Layer D): added `prevalidate` npm-lifecycle hook for academic + research-portfolio profiles (the two that run cite-key validation). `prebuild` simplifies to just `npm run validate --if-present`; npm's lifecycle handles the prereq chain.
- **Demo update** (D14): `demo/astro.config.mjs` now sets `title`, `description`, `author`, and a `seo` block (ogImage + twitterHandle) to exercise v4.6's full propagation chain end-to-end. New `demo/src/content/chapters/v46-seo-demo.mdx` exemplifies article:* frontmatter. Demo's `demo/public/og-default.png` placeholder ships with the demo (1200×630, ~53 KB).

### Migration

None for consumers staying on existing functionality. To adopt new features:

```diff
 // astro.config.mjs
 export default await defineBookConfig({
   styles: [academicStyle],
   site: 'https://your-book.example/',
+  author: 'Your Name',
+  seo: {
+    ogImage: '/og-default.png',  // commit a 1200×630 PNG to public/ first
+    twitterHandle: '@yourhandle',
+  },
 });
```

Consumers using the `ci:validate` deploy-time wrapper can migrate to the `prevalidate` npm-lifecycle hook (recipe 19) — drop the wrapper script + revert `validate-command: ci:validate` → `validate` in `.github/workflows/deploy.yml`. Same CI behavior, cleaner `package.json`.

### Release policy

- 6 atomized commits per Layer (A → B → 3b+E → 3a → 3c+D → F).
- 222 tests pass (215 existing + 7 new in `tests/v4.6-seo-and-sitemap.test.mjs`).
- 18 create-book tests pass (14 existing + 4 new for Layer 3c + D).
- Demo build verifies the full SEO + sitemap surface end-to-end:
  - 11 baseline SEO tags emit on every page.
  - article:* tags emit on the v46-seo-demo chapter.
  - `/sitemap-index.xml` + `/sitemap-0.xml` emit; `/print/` excluded per academic-profile default filter.
- `npm publish` deferred to the maintainer (WebAuthn 2FA can't be CLI-driven; see plan D5).

## [4.5.1] — 2026-05-26

Patch release. Refactors v4.5.0's landing-config source from `import.meta.env.BOOK_*` env vars to a Vite virtual module (`virtual:book-scaffold/landing-config`). Functionally identical for consumers that don't have stale env-var entries; functionally **correct** for consumers whose `.env` files happen to define `BOOK_TITLE` / `BOOK_DESCRIPTION` / `BOOK_PORTFOLIO`.

### Why

Surfaced during the `double_ml_time_series` deploy that motivated v4.5.0: DML's `web/.env` already had a `BOOK_TITLE=web` line from an earlier exploratory phase. v4.5.0's `vite.define` injection of `import.meta.env.BOOK_TITLE` lost to the `.env`-loaded value at consumer build time — the auto-injected landing rendered `<h1>web</h1>` instead of `<h1>Double Machine Learning for Time Series</h1>`. The right fix is to route landing config through a mechanism that *cannot* collide with env vars.

The underlying architectural mistake in v4.5.0: I mimicked the existing `BOOK_PRESET` / `BOOK_PROFILE` pattern without distinguishing between *preference flags* and *config values*. Preference flags (preset/profile) are exactly the kind of thing where env-based override IS the convention (see `resolvePreset` which reads `process.env` / `.env` as authoritative sources). Config values (title/description/portfolio) should only flow from `defineBookConfig` — env-based override there is a foot-gun. Virtual modules cleanly isolate config-value transport from env-var resolution; the scaffold already uses this pattern for `virtual:book-scaffold/mdx-components`.

This is also a dogfood-loop win: the issue was invisible against the demo (which has no `.env`) and against the test fixtures (same). It only surfaced when a real consumer with a real `.env` file shipped. The patch ships ~30 min after v4.5.0, before DML's deploy proceeds.

### Changed

- **`package/src/integration.ts`**: removed `import.meta.env.BOOK_TITLE` / `BOOK_DESCRIPTION` / `BOOK_PORTFOLIO` / `BOOK_ROUTES_ENABLED` from `vite.define`. Added `makeLandingConfigVitePlugin` (inline, mirrors `makeMdxComponentsVitePlugin`) that exposes the resolved landing config via the virtual module `virtual:book-scaffold/landing-config`.
- **`package/pages/index.astro`**: replaced `import.meta.env.BOOK_*` reads with `import bookConfig from 'virtual:book-scaffold/landing-config'`. Single import, typed via the ambient module declaration.
- **`package/src/astro-ambient.d.ts`**: added `declare module 'virtual:book-scaffold/landing-config'` for TS type-checking of the consumer-side virtual import.

`BOOK_PRESET` / `BOOK_PROFILE` env-var injection is unchanged — they remain the right pattern for preference flags.

### Migration

None. v4.5.0 → v4.5.1 is a pure refactor of how landing config moves from `defineBookConfig` to the landing page. Consumers that bumped to v4.5.0 and got the env-var collision bug just need to bump to v4.5.1 (or, equivalently, delete the stale `BOOK_TITLE` line from their `.env` — but the v4.5.1 bump is the future-proof fix).

### Release policy

- Smoke-tested on demo: with demo's custom `src/pages/index.astro` temporarily moved aside, the auto-injected landing rendered correctly via the virtual module — `<h1>book-scaffold-astro</h1>` (title fallback, since demo doesn't set one), route list filtered to academic profile's enabled routes, `Part of brandon-behring.dev` footer present.
- DML re-bump to `^4.5.1` post-publish verified the title-from-config flow end-to-end against a real `.env` collision.

## [4.5.0] — 2026-05-26

Minor release. Adds an auto-injected `/` landing page so the root URL works for every consumer out of the box, instead of 404-ing when the consumer doesn't ship their own `src/pages/index.astro`. Triggered by a real consumer (`double_ml_time_series` web/) shipping a bound custom domain and getting a 404 at root because its scaffold-injected routes (`/chapters/`, `/search/`, `/references/`, `/print/`) all worked but `/` had no page. Pre-v4.5.0 the only fix was hand-writing a landing per consumer — replicating across every book in the ecosystem. v4.5.0 inverts: scaffold ships the default, consumers override only if they want to customize.

All additive; consumers upgrade by bumping version with zero config changes. The auto-injected landing renders if the consumer doesn't have their own `src/pages/index.astro` (file-system routes win over `injectRoute`, so existing custom landings keep working unchanged).

### Added

- **`/` auto-route** — minimal default landing page (~80 lines). Default `routes.landing: true` for all 5 built-in profiles. Renders:
  - `<h1>` with book title from `defineBookConfig({ title })` (fallback `'book-scaffold-astro'`).
  - Lead `<p>` with `defineBookConfig({ description })` (omitted if not set).
  - "Read" `<ul>` listing all enabled scaffold routes (filtered via the integration's post-merge `enabledRoutes` map, so consumers like `dlai-study-notes` with `routes.chapters: false` get a landing with no broken `/chapters/` link).
  - Portfolio footer `<a>` from `defineBookConfig({ portfolio })`.
- **`BookConfigOptions.title?: string`** — book title, propagates to the auto-injected landing's H1 + `<title>`. Distinct from per-page `Astro.props.title`.
- **`BookConfigOptions.description?: string`** — book description, propagates to the landing's lead paragraph + `<meta description>`.
- **`BookConfigOptions.portfolio?: { url, label } | false`** — portfolio backlink in the landing footer. Defaults to `BRANDON_PORTFOLIO_DEFAULT` (= `{ url: 'https://brandon-behring.dev', label: 'brandon-behring.dev' }`) baked into the scaffold. Single source of truth for the portfolio URL across all Brandon-owned consumers — update in `package/src/config.ts`, bump scaffold, every consumer inherits on next build. Set `portfolio: false` to disable the link, or pass `{ url, label }` to override.
- **`BRANDON_PORTFOLIO_DEFAULT`** exported from main entry — consumers who want to render a portfolio link in their OWN custom landing can import the same default for visual parity.
- **`RouteToggles.landing: boolean`** added to `profile-kit.ts` (default `true` for all 5 built-in profiles — academic / tools / minimal / course-notes / research-portfolio). Set `routes.landing: false` in `defineBookConfig` to disable the auto-injection without writing a custom landing.
- **Four new vite.define-injected env vars** propagate from `defineBookConfig` → the landing page at build time: `BOOK_TITLE`, `BOOK_DESCRIPTION`, `BOOK_PORTFOLIO`, `BOOK_ROUTES_ENABLED`. Matches the existing `BOOK_PRESET` / `BOOK_PROFILE` pattern.

### Changed

None. Pure additive minor release.

### Migration

None for v4.4.x consumers bumping to v4.5.0. The auto-injected `/` lands as a working root page where there was nothing before. Consumers with their own `src/pages/index.astro` (e.g., the demo, `ssm-foundations`) keep their custom landing unchanged — file-system routes win over `injectRoute`. To opt out of the auto-injection entirely without writing a custom landing: `defineBookConfig({ routes: { landing: false } })`.

### Why this design

See `~/.claude/plans/i-want-to-look-streamed-pebble.md` §Phase 6-pre for the full architectural reasoning. Short version: the root page being per-consumer was the only asymmetric exception in a scaffold that already auto-injects 7 other pages (`chapters`, `search`, `references`, `print`, `tips`, `exercises`, `convergence`). v4.5.0 brings the root page in line with the rest. Override mechanism is the existing Astro file-system routing — no new override API.

### Release policy

- Pre-publish smoke gate ran end-to-end against the demo (with its custom index removed, then restored) before publish — auto-injected page rendered correctly with title fallback, route-list filtered to academic profile's enabled routes (no chapters/convergence), portfolio footer linking to brandon-behring.dev.

## [4.4.0] — 2026-05-25

Minor release. Polish closure of v4.3.0 deferred items. No new consumer issues since v4.3.0 ship — this release closes internal backlog before the next consumer-feedback cycle begins. All additive; consumers upgrade by bumping version with zero config changes.

### Added

- **`fixture-book-genre` visual regression fixture** — 5 routes × 4 viewport widths = 20 new baseline PNGs at AE=0. Exercises all 6 v4.3.0 book-genre components (`<Tip>`, `<TipsCard>`, `<Exercise>`, `<Practice>`, `<Solution>`, `<ExerciseSolutions>`) plus both `/tips` and `/exercises` auto-routes. Closes the visual-coverage gap deferred from v4.3.0 to keep velocity.
- **`<ExerciseSolutions auto />` mode** — new optional boolean prop on the v4.3.0 component. When `auto` is true, the component reads `src/data/exercises.json` (emitted by `book-scaffold build-exercises`), scopes by the current chapter via `Astro.url.pathname` (matching the `/chapters/<slug>/` route pattern auto-injected since v4.3.0 #69), and auto-renders a list of exercise problem statements with placeholder solution lines (`_Add your solution here._`). Default `auto: false` preserves v4.3.0 manual-`<Solution>` behavior — no regression for existing consumers. Graceful skip + clear hint message when exercises.json is missing or the chapter URL pattern doesn't match.
- **`book-scaffold build-exercises` script** — sister to v4.3.0's `build-tips`. Scans chapter MDX (honoring `loader.base` overrides via `readChaptersBase` from v4.1.2) for `<Exercise id="X">body</Exercise>` instances via 2-branch regex (single + double quote portability, no backreference — same v4.1.2 cross-runtime lesson). Emits `src/data/exercises.json` keyed by chapter slug. Run on `prebuild`. Wired into the `bin/book-scaffold` dispatcher.
- **`/exercises` auto-route** — opt-in via `routes.exercises: true` in `defineBookConfig` (default `false` per profile, mirroring `routes.tips`). New `pages/exercises.astro` reads `src/data/exercises.json` and renders an index grouped by chapter with `/chapters/<slug>/#exercise-<id>` deep links + per-exercise problem-text previews (first 120 chars). Auto-injected via `bookScaffoldIntegration` (`ROUTE_REGISTRY.exercises` entry).
- **`RouteToggles.exercises: boolean`** added to `profile-kit.ts` (default `false` for all 5 built-in profiles — academic / tools / minimal / course-notes / research-portfolio).
- **9 new build-exercises extractor tests** (`tests/build-exercises.test.mjs`) — mirror the v4.3.0 build-tips test suite: double-quoted / single-quoted / multiple / whitespace normalization / full body preserved / no-id skip / empty-id skip / empty source / no-Exercise source.

### Changed

- **`ExerciseSolutions.astro` now branches on `auto` prop**. Manual mode (no prop) renders the slot content exactly as v4.3.0 (regression-safe). Auto mode renders the auto-generated section.
- **`bin/book-scaffold.mjs`** registers the new `build-exercises` sub-command + updates help text.

### Migration

None. Pure additive minor release.

### Out of scope / next sessions

- **MDX AST-based solution-slot extraction** (`<Fragment slot="solution">...</Fragment>` inside `<Exercise>`) — v4.4.0 auto-collection captures problem text only, not solutions. Full solution-slot extraction would require MDX AST traversal at build time. Defer until a consumer asks; file a request if you'd like it in v4.5.0.
- **#15** Multibook routing, **#16** AnkiCard + extract-cards CLI — still no consumer signal; deferred.

### Release policy

- **D12 lock-step preserved**: `@brandon_m_behring/create-book@4.4.0` ships alongside.
- Pre-publish smoke gate (v3.6.5) ran end-to-end against academic before publish.
- 215 unit tests pass (206 existing + 9 new build-exercises).
- 96 visual baselines at AE=0 (76 existing + 20 new fixture-book-genre).
- Feedback loop: file friction at https://github.com/brandon-behring/book-scaffold-astro/issues with the `consumer:<workspace>` label. If you'd like `<Fragment slot="solution">` extraction for auto-rendered actual solutions, file a v4.5.0 request.

## [4.3.0] — 2026-05-24

Minor release. Bundles 4 issues filed since v4.2.0 shipped (within ~36 hours): one real bug (#69), one docs gap (#68), and two pedagogy-component requests from the claude-books supplement-format decision round (#70 + #71). All additive; consumers upgrade by bumping version with zero config changes.

### Fixed

- **`/chapters/` index links + auto-injected per-chapter route** ([#69](https://github.com/brandon-behring/book-scaffold-astro/issues/69)). The shipped `/chapters/` index page previously linked to `/<slug>/` (root-level) instead of `/chapters/<slug>/` (under the chapters prefix). Every link on the academic chapters index 404'd. Two-part fix:
  - `package/pages/chapters.astro:115` — href corrected to `/chapters/${id}/`
  - **NEW** `package/pages/chapters/[...slug].astro` — per-chapter dynamic route auto-injected by `bookScaffoldIntegration` whenever `routes.chapters: true`. Mirrors the v3.4.0 frontmatter pattern (toolkit ships BOTH index + dynamic route together). Layout switches by preset: `Chapter.astro` for academic + research-portfolio (KaTeX + theorem chrome); `Base.astro` for tools + minimal + course-notes (lighter).
  
  Pre-v4.3.0 every academic consumer wrote the same dynamic-route boilerplate in their own `src/pages/chapters/[...slug].astro`. v4.3.0 removes that boilerplate. **Migration note for existing consumers**: if you have your own `src/pages/chapters/[...slug].astro` AND upgrade to v4.3.0, Astro will error on duplicate routes — either delete your local file (recommended) or keep yours and don't enable `routes.chapters: true` (your file takes precedence as a consumer route).

### Added

- **`<Tip n="..." title="...">` numbered-tips component** ([#70](https://github.com/brandon-behring/book-scaffold-astro/issues/70)) — Pragmatic Programmer-style pull-quotable rules. Author provides the number; registry doesn't auto-number. Gold border + `Tip {n}` badge + `#tip-{n}` anchor for cross-references.
- **`defineTips({ volumeOffset, volumeLabel })` API** — cross-volume coordination helper. Branded type (matches `defineStyle` pattern); lets a multi-volume series offset displayed numbers without renumbering source tags. See `package/src/lib/define-tips.ts`.
- **`<TipsCard>` component** — print-friendly pull-out card listing all tips. Reads `src/data/tips.json`. Graceful skip when tips.json missing.
- **`/tips` auto-injected route** — opt-in via `routes.tips: true`. Renders all tips with `#tip-{n}` permalinks, chapter backlinks, and 80-char body previews. Reads `src/data/tips.json` from the new build script.
- **`book-scaffold build-tips` script** — scans chapter MDX for `<Tip>` instances via 4-branch regex (handles single + double + mixed quote styles, no backreference for cross-runtime portability — same lesson as v4.1.2 regex fix). Emits `src/data/tips.json` sorted by `n`; warns (doesn't fail) on duplicate numbers. Wired into `bin/book-scaffold.mjs` dispatcher.
- **`<Exercise id="...">` inline-at-concept-introduction component** ([#71](https://github.com/brandon-behring/book-scaffold-astro/issues/71)) — CS:APP precedent. Light treatment; `#exercise-{id}` anchor for cross-linking from `<Solution>`.
- **`<Practice id="..." difficulty="1-4">` end-of-chapter component** — diamond markers (◆◆◇◇ for difficulty=2). Closed TS literal union on difficulty (inlined single-line per v4.1.0 PocLayout lesson). `#practice-{id}` anchor.
- **`<Solution for="...">` companion paired by id** — backlinks to `#exercise-{id}`. Manual pairing (no build-time auto-collection in v4.3.0).
- **`<ExerciseSolutions>` chapter-end wrapper** — provides `## Exercise solutions` heading + container for nested `<Solution>` elements. Author places `<Solution>` items inside manually.
- **New "book-genre" component family** (cross-profile, 6 components) — documented in `package/CLAUDE.md` alongside the v4.1.0 pedagogy family. Names trace genre lineage (Pragmatic Programmer for Tip; CS:APP for Exercise/Practice).
- **`RouteToggles.tips: boolean`** field added (all profiles default `tips: false`).
- **`package/recipes/17-draft-chapter-workflow.md`** ([#68](https://github.com/brandon-behring/book-scaffold-astro/issues/68)) — documents the canonical `getCollection('chapters', (e) => !e.data.draft)` filter pattern, when to use draft vs delete vs reorder, and a `BOOK_INCLUDE_DRAFTS` preview-env pattern consumers can wire into their own override route. Closes the docs-discoverability loose end from #63's resolution.
- **27 new tests** — 9 build-tips extractor tests, 6 defineTips identity/branding tests, 12 book-genre component contract tests.

### Changed

- **`bin/book-scaffold.mjs` dispatcher** gains `build-tips` sub-command + updated help text.
- **`build-figures` row in CLI table** notes that TikZ stage (v4.2.0) ships in build-figures.

### Migration

None required for the additive changes (#68, #70, #71). For #69 specifically: if you've been hand-maintaining `src/pages/chapters/[...slug].astro` AND you opt into `routes.chapters: true` (the academic preset doesn't by default), DELETE your local file before upgrading or Astro will error on duplicate routes. v3 consumers who never used `routes.chapters: true` are unaffected.

### Release policy

- **D12 lock-step preserved**: `@brandon_m_behring/create-book@4.3.0` ships alongside.
- Pre-publish smoke gate (v3.6.5) ran end-to-end against academic + research-portfolio before publish.
- 206 unit tests pass (171 existing + 27 new from this release + 8 carry-over from earlier patches).
- 76 visual baselines at AE=0 (existing fixtures unaffected by the #69 href fix — rendered output is byte-equivalent).
- Feedback loop: file friction at https://github.com/brandon-behring/book-scaffold-astro/issues with the `consumer:<workspace>` label.

## [4.2.0] — 2026-05-23

Minor release. Closes [#17](https://github.com/brandon-behring/book-scaffold-astro/issues/17) — `book-scaffold build-figures` now auto-compiles TikZ standalone `.tex` sources to `.pdf` via `pdflatex` before the existing PDF→SVG conversion runs. Additive only; consumers with `.pdf`-only figures are unaffected; consumers without TeX Live continue to work (clear ERROR + skip for `.tex` files; pre-built `.pdf` files still convert normally).

### Added

- **TikZ standalone → PDF → SVG pipeline** ([#17](https://github.com/brandon-behring/book-scaffold-astro/issues/17)). `package/scripts/build-figures.mjs` now scans `figures/` for both `.pdf` AND `.tex` files. For each `.tex` source: if no sibling `.pdf` exists OR the `.tex` is newer than the `.pdf`, runs `pdflatex -halt-on-error -interaction=nonstopmode -output-directory=. <name>.tex` in the source directory. The generated `.pdf` then flows into the existing pdf2svg conversion stage unchanged. Missing-pdflatex case: emits clear ERROR with TeX Live install link (https://www.tug.org/texlive/) and skips `.tex` files; continues processing any `.pdf`-only topics. Doesn't crash the build.
- **`package/recipes/16-tikz-figures.md`** — end-to-end recipe covering the `\documentclass[tikz,border=2mm]{standalone}` convention, discovery rule (when pdflatex runs vs skips), working-directory semantics (compiles in `figures/<topic>/` so `\input{}` relative paths work), `.gitignore` snippet for intermediate `.aux/.log/.fls/.fdb_latexmk/.synctex.gz` files, TeX Live install instructions per OS, CI workflow snippet for runners that need to regenerate from source, and common debugging tips.
- **`tests/build-figures-tikz.test.mjs`** — 2 tests. (1) End-to-end: copy a minimal `tikz-basic.tex` fixture to a temp project, run `build-figures`, assert that `pdf` exists alongside `.tex` AND that `.svg` exists under `public/figures/sample/` AND that the SVG contains valid `<svg>` markup. (2) Missing-pdflatex error message format. Both tests `skip` cleanly when `pdflatex` / `pdftocairo` aren't on PATH (uses `{ skip: undefined }` semantics — Node 22's test runner treats `null` as a skip-with-reason, so `undefined` is required for "run the test").
- **`tests/fixtures/figures/tikz-basic.tex`** — minimal TikZ standalone source for the pipeline test.
- **PACKAGE_DESIGN.md §7** — new "Optional system dependencies" subsection documenting `pdflatex` + `pdftocairo` install paths.
- **PACKAGE_DESIGN.md §8** — `build-figures` row updated to note the v4.2.0 TikZ stage.

### Changed

- **`build-figures` output line** — now includes `tikz→pdf` count when stage 1 ran on at least one source (e.g., `build-figures: 3 total, 3 converted (0 png fallback), 0 cached, 1 tikz→pdf`).

### Migration

None. Pure additive minor release. Upgrade by bumping `@brandon_m_behring/book-scaffold-astro` and `@brandon_m_behring/create-book` to `^4.2.0` (lock-step). Consumers without `.tex` figures see zero behavior change. Consumers WITH `.tex` figures now get automatic compilation IF they have TeX Live installed; otherwise see a clear ERROR + continued processing of `.pdf` figures.

### Release policy

- **D12 lock-step preserved**: `@brandon_m_behring/create-book@4.2.0` ships alongside.
- Pre-publish smoke gate (v3.6.5) ran end-to-end against academic + research-portfolio before publish.
- 171 unit tests pass (169 existing + 2 new TikZ tests; latter skip cleanly when TeX Live unavailable).
- Feedback loop: file friction at https://github.com/brandon-behring/book-scaffold-astro/issues with the `consumer:<workspace>` label.

## [4.1.2] — 2026-05-23

Hotfix release. Republishes v4.1.1's scope (#63 chapter discovery fix + fixture-pedagogy baselines) with a more permissive regex in `readChaptersBase`. The v4.1.1 tag exists on GitHub but **was never published to npm** because the `readChaptersBase: double-quoted loader.base override works` unit test failed in CI's Node 22 environment — the regex's `(['"])([^'"]+)\1` backreference form behaved differently on the runner than locally. v4.1.2 uses two separate alternation branches (one per quote style) instead of a backreference; the test passes locally AND in CI. No consumer impact since v4.1.1 never reached npm.

### Fixed

- **`readChaptersBase` regex rewritten without backreference** — replaced `chapters\s*[:=][\s\S]{0,400}?loader\s*:[\s\S]{0,200}?base\s*:\s*(['"])([^'"]+)\1` with `\bchapters\b[\s\S]{0,500}?\bbase\s*:\s*'([^']+)'|\bchapters\b[\s\S]{0,500}?\bbase\s*:\s*"([^"]+)"`. Two consequences: (1) no more backreference (more portable across regex engines), (2) more permissive matching pattern — relaxes the requirement that `chapters` be immediately followed by `:` or `=`. All 8 existing `chapters-base-resolution.test.mjs` tests pass; behavior is conceptually unchanged.

### Carries forward from the unreleased v4.1.1

- **`book-scaffold validate` + `book-scaffold build-labels` honor `loader.base` overrides** ([#63](https://github.com/brandon-behring/book-scaffold-astro/issues/63))
- **`fixture-pedagogy` visual regression fixture** — 20 new baseline PNGs at AE=0
- **`PocLayout.astro` type union flattened to single line**

See the v4.1.1 entry below for the full details of those changes.

### Release policy

- **D12 lock-step preserved**: `@brandon_m_behring/create-book@4.1.2` ships alongside.
- Pre-publish smoke gate (v3.6.5) ran end-to-end against academic + research-portfolio before publish.
- Test gate caught the regex regression in CI before publish — exactly the gate's intended purpose.

## [4.1.1] — 2026-05-23 (tagged but unreleased — see [4.1.2])

Patch release. Two-item bundle: closes [#63](https://github.com/brandon-behring/book-scaffold-astro/issues/63) (chapter discovery silently returns 0 when `content.config.ts` overrides `loader.base`) + ships visual regression baselines for the 4 v4.1.0 pedagogy components (deferred from v4.1.0 to keep velocity).

### Fixed

- **`book-scaffold validate` + `book-scaffold build-labels` honor `loader.base` overrides in `content.config.ts`** ([#63](https://github.com/brandon-behring/book-scaffold-astro/issues/63)). The `guides-experimentation` consumer's multi-guide pattern places chapters under `src/content/<guide-slug>/` rather than the Astro 5 default `src/content/chapters/`. Both scaffold scripts previously hardcoded the default path, silently reporting `0 chapter(s)` even with valid MDX files present. v4.1.1 adds a `readChaptersBase(projectRoot)` helper in `scripts/walk-mdx.mjs` that regex-parses the consumer's `content.config.{ts,mjs,js}` for the `chapters` collection's `loader.base` and falls back to the Astro 5 default when: the config file is missing / no `chapters` collection identifier is found / the base path uses dynamic forms (template literals, variables). When `BOOK_CHAPTERS_DIR` env var is set, it takes precedence (build-labels.mjs already honored this; validate.mjs now does too). Investigation note: the issue reporter also flagged `getCollection('chapters')` returning empty — that flow works correctly in v4.1.0 when the loader.base is properly configured (verified in reproduction). The scaffold fix targets validate + build-labels (the 2/3 symptoms with scaffold-side causes); the third symptom is consumer-side configuration. 8 new unit tests in `tests/chapters-base-resolution.test.mjs`.

### Added

- **`fixture-pedagogy` visual regression fixture** — 5 routes (index + one chapter per v4.1.0 pedagogy component) × 4 viewport widths = 20 new baseline PNGs at AE=0. Closes the visual-coverage gap deferred from v4.1.0. Each chapter exercises both default-prop and full-prop variants of its component (e.g., `<WorkedExample>` collapsed AND expanded; `<YouWillLearn>` with and without `prerequisites`). The 4th chapter exercises all 5 `<PocLayout>` kinds in one document.

### Changed

- **`PocLayout.astro` type union flattened to a single line** — Astro's frontmatter parser couldn't handle the multi-line discriminated union syntax (`| 'tutorial' | 'how-to' | ...`); inlined as `'tutorial' | 'how-to' | ...`. No API change; runtime behavior identical; all 17 v4.1.0 pedagogy/CSS contract tests still pass.

### Verification

- 169/169 unit tests pass (124 pre-v4.1.0 + 17 pedagogy + 9 empty-manifest + 8 new chapters-base-resolution + 11 carry-over)
- 76/76 visual baselines pass at AE=0 (56 existing + 20 new fixture-pedagogy)
- 15/15 create-book scaffold tests pass
- Local-tarball smoke: academic + research-portfolio scaffolds build end-to-end against the v4.1.1 tarball

### Release policy

- **D12 lock-step preserved**: `@brandon_m_behring/create-book@4.1.1` ships alongside.
- Pre-publish smoke gate (v3.6.5) ran end-to-end against academic + research-portfolio before publish.
- Feedback loop: file friction at https://github.com/brandon-behring/book-scaffold-astro/issues with the `consumer:<workspace>` label.

## [4.1.0] — 2026-05-23

Consumer-batch minor release. Bundles 6 issues filed by the [`claude-books`](https://github.com/brandon-behring/claude-books) consumer during its 2026-05-23 pedagogy PoC round. All additive; no breaking changes; v4.0.0 consumers upgrade by bumping the version with no config edits required.

### Why

The 2026-05-23 PoC round at `claude-books/handbook` rendered 5 supplement formats of Chapter 1 side-by-side (tutorial / how-to / TL;DR / part-summary / cheat-sheet) backed by research at `claude-books/docs/research/11-pedagogy/` (Sweller cognitive-load, Bloom's-taxonomy, React.dev callout vocabulary). The round surfaced 4 missing components + 1 layout primitive + 1 build-noise bug + 1 docs gap, all at once. This release ships all 6.

### Added

- **`<Pitfall>` component** ([#58](https://github.com/brandon-behring/book-scaffold-astro/issues/58)) — React.dev "Pitfall" vocabulary for retrospective "common mistake" callouts. Distinct from `<WarnBox>` (which is preemptive). Crimson border + tinted background (new `--warm-crimson` token).
- **`<WorkedExample>` component** ([#57](https://github.com/brandon-behring/book-scaffold-astro/issues/57)) — collapsible demonstration block backed by Sweller/Cooper's worked-example-effect theory. Native `<details>` (no JS); `id` prop becomes `#worked-example-{id}` anchor (prefixed to avoid heading-anchor collisions); optional `expanded` prop. Plum border + chip in the summary.
- **`<YouWillLearn>` component** ([#59](https://github.com/brandon-behring/book-scaffold-astro/issues/59)) — chapter-opener "what this chapter delivers" callout (Bloom's-taxonomy framing). Slotted body (MDX bullets); optional `prerequisites` prop renders a "Before you start" sub-block. Gold border.
- **`<PocLayout>` component** ([#56](https://github.com/brandon-behring/book-scaffold-astro/issues/56)) — per-PoC-kind layout selector. Closed discriminated `kind` union: `'tutorial' | 'how-to' | 'tldr' | 'part-summary' | 'cheat-sheet'`. Each kind swaps 3 CSS variables (`--bs-content-line-length`, `--bs-content-vertical-rhythm`, `--bs-heading-emphasis`) on a `.poc-layout-{kind}` wrapper. New `package/styles/poc-layouts.css` ships the variant table; consumers override via `:where(.poc-layout-X)` selectors.
- **Pedagogy family** — `Pitfall` / `WorkedExample` / `YouWillLearn` form a new "pedagogy" component family (any preset can use them). Documented in `package/CLAUDE.md`.
- **`PACKAGE_DESIGN.md §5a`** ([#61](https://github.com/brandon-behring/book-scaffold-astro/issues/61)) — new section "Custom collections + YAML date types" covers the `z.date()` vs `z.string()` gotcha + 2 safe patterns + anti-pattern. No `zodDateString` helper export in this release (one consumer hit the issue; docs solve it).
- **17 new contract tests** (`tests/pedagogy-callouts.test.mjs` + `tests/poc-layout-css.test.mjs`) — assert each component's Props interface, default values, CSS class names; assert each PocLayout kind's CSS variable set.
- **9 new isYamlEmpty tests** (`tests/sources-empty-detection.test.mjs`) — empty / whitespace / comment-only / `[]` / single-entry / multi-entry / missing-file / malformed-yaml.

### Changed

- **Empty `sources/manifest.yaml` no longer emits noisy WARN** ([#60](https://github.com/brandon-behring/book-scaffold-astro/issues/60)). Astro's `file()` content loader previously logged `[file-loader] No items found in sources/manifest.yaml` for every build — including when the file existed with `[]` content (valid pre-bibliography state in early Phase 1 chapter development). `package/src/schemas-entry.ts` now detects empty manifests (after stripping `#`-comment lines + whitespace; treats `[]` and empty as empty) and skips registering the collection entirely. Distinguished states:
  - File missing → collection not registered; build is silent (preserves existing behavior).
  - File exists, parses empty → collection not registered; build is silent (new).
  - File exists with entries → collection registered; loader runs normally (unchanged).
  - File exists, malformed YAML → Astro's loader surfaces the real ERROR (unchanged).

### Migration

None. Pure additive minor release. Upgrade by bumping `@brandon_m_behring/book-scaffold-astro` and `@brandon_m_behring/create-book` to `^4.1.0` (lock-step).

### Out of scope / next sessions

- **Visual regression baselines for new components** deferred to v4.1.1 (component contract tests cover the API; visual-pixel verification follows when fixture-pedagogy gets captured).
- **`zodDateString` helper export** — wait for a second consumer to ask (avoids ad-hoc API surface).
- **`<PocLayout kind: string>` escape hatch** — closed union enforces vocabulary discipline; revisit if a sixth kind is needed.

### Release policy

- **D12 lock-step preserved**: `@brandon_m_behring/create-book@4.1.0` ships alongside the toolkit.
- Pre-publish smoke gate (v3.6.5) ran end-to-end against academic + research-portfolio before publish.
- 161 unit tests pass (124 existing + 17 new pedagogy + 9 new empty-manifest + 11 existing katex/define-style).
- Visual regression baselines (56 existing) unaffected — no v4.0.0 components changed.
- Feedback loop: file friction at https://github.com/brandon-behring/book-scaffold-astro/issues with the `consumer:<workspace>` label. v4.x is the iteration window for this API.

## [4.0.0] — 2026-05-23

**BREAKING**: the v3.x `preset:` / `profile:` shorthand on `defineBookConfig` is removed. Replaced by typed `defineStyle()` composition via the new `styles: [...]` field. Migration is ~2 lines per book. Full migration recipe in [`package/MIGRATION-v3-to-v4.md`](package/MIGRATION-v3-to-v4.md); composition patterns in [`package/recipes/15-defining-styles.md`](package/recipes/15-defining-styles.md).

### Why

The v3.x API accumulated through 7 consumer-pilot releases. Each release added one or two top-level `BookConfigOptions` fields to address a specific consumer ask (`routes`, `katexMacros`, `extraStyles`, `extraIntegrations`, `mdxComponentsModule`, ...). v4 unifies that surface around a typed, branded, composable `Style` object: define a style once, import it across many books, override per-book explicitly. The user can now build style clusters (`guidesFamilyStyle`, `coursebookStyle`) once and reuse them across workspace siblings without per-book repetition.

Foundational design choices (locked during v4.0.0 design session, see [`/.claude/plans/examine-what-has-happened-peppy-scroll.md`](.claude/plans/examine-what-has-happened-peppy-scroll.md)):
- **Explicit over silent** — no profile-level magic defaults; every config decision visible in the call site or the imported Style.
- **No legacy debt** — hard break at v4; sunset of v3 API is immediate.
- **TypeScript strict-mode best practices** — branded types via `unique symbol`, closed shape (no public index signature; scoped `extra?` field instead — preserves typo protection on toolkit fields), `satisfies` for narrow registry inference, `readonly` on all DTO fields, `.js` extensions in imports.

### Added

- **`defineStyle(opts: StyleInput): Style`** — identity helper that creates a typed, branded, composable Style. Zero runtime overhead beyond an object spread + version marker. Branded type prevents confusion with `Partial<BookConfigOptions>`. See PACKAGE_DESIGN.md §4a.
- **5 built-in Style exports** — `academicStyle`, `toolsStyle`, `minimalStyle`, `courseNotesStyle`, `researchPortfolioStyle`. One per preset. Plus `BUILTIN_STYLES: Record<BookPreset, Style>` (`as const satisfies` — narrow inferred lookup).
- **`composeStyles(styles)`** — public helper for advanced consumer composition. Per-key merge strategy documented in PACKAGE_DESIGN.md §4a table.
- **`styles?: readonly Style[]`** on `BookConfigOptions` — array of Styles composed left-to-right; top-level fields win over composed style chain.
- **`deploy?: 'pages' | 'workers'`** on `BookConfigOptions` and `Style` ([#50](https://github.com/brandon-behring/book-scaffold-astro/issues/50)) — drives create-book's `wrangler.toml` shape. Inherited from chosen style; academic/tools/minimal default to `'workers'`, course-notes/research-portfolio default to `'pages'`.
- **`routes.frontmatter` widened to `boolean | { enabled: boolean; prefix?: string }`** ([#49](https://github.com/brandon-behring/book-scaffold-astro/issues/49)) — object form lets consumers control the URL prefix (`prefix: ''` mounts pages at root). Boolean form keeps working with default prefix `'frontmatter'`.
- **`extra?: Readonly<Record<string, unknown>>`** on `Style` — scoped consumer-side metadata namespace. Ignored by toolkit; survives composition as per-key spread. Preserves typo protection on known toolkit fields (closed shape — no public index signature).
- **`__styleVersion: 1` marker** on every Style (auto-set by `defineStyle`) — forward-compatibility hook for future API-shape evolution.
- **`package/recipes/15-defining-styles.md`** — new recipe covering workspace-local vs npm-package patterns, per-key merge semantics, escape hatches, feedback loop.
- **`package/MIGRATION-v3-to-v4.md`** — step-by-step migration recipe for the 4 known consumers + external users.
- **`PACKAGE_DESIGN.md §4` rewritten + new §4a** — full `defineBookConfig` v4 API contract + `defineStyle` API reference.
- **40 unit tests in `package/tests/define-style.test.mjs`** — identity, branding, merge semantics for each field, BUILTIN_STYLES integrity, composition edge cases.
- **5 new create-book scaffold tests** — per-preset `wrangler.toml` + new v4 `astro.config.mjs` shape.

### Removed (BREAKING)

- **`preset?: BookPreset` field on `BookConfigOptions`** — replaced by `styles: [<presetName>Style]`. Runtime check detects v3 usage and throws `BookConfigError` with auto-suggested replacement code + missing import line + link to MIGRATION-v3-to-v4.md.
- **`profile?: BookPreset` field** (v3.4.0 backward-compat alias) — same treatment as `preset`. Both throw the same migration error.
- **No backward-compatibility shim.** Consumers in early pilot phase (~4 known + workspace siblings, all maintained by same author); migration is ~2 lines per book. The v3.7.1 line stays installable indefinitely via npm for consumers who need more time.

### Changed

- **`book-scaffold build-bib` strips `%`-prefixed comment lines before parsing** ([#54](https://github.com/brandon-behring/book-scaffold-astro/issues/54)). Permanent fix for the citation-js parse-error class that drove the v3.6.1 → v3.6.4 hotfix chain. The library treats line-leading `@TYPE` tokens (e.g., `% @article{...}`) as entry starts even inside comments; the pre-pass `stripBibtexLineComments` removes any line whose first non-whitespace character is `%` before passing to `@citation-js/plugin-bibtex`. No consumer action needed; all existing `.bib` files continue to work.
- **`create-book` generated `astro.config.mjs` uses v4 API** — emits `import { defineBookConfig, <preset>Style } from '@brandon_m_behring/book-scaffold-astro'; export default await defineBookConfig({ styles: [<preset>Style], site: '...' });` instead of v3 `preset: '<preset>'` form.
- **`create-book` emits per-preset `wrangler.toml`** — Workers shape (academic/tools/minimal) vs Pages shape (course-notes/research-portfolio).
- **`PROFILES[preset]?.katex === true` gate preserved from v3.7.1** — KaTeX wiring activates for both `academic` and `research-portfolio` based on the profile registry, not the preset literal. The fix is unchanged by the v4 API redesign.

### Migration

For each book using `@brandon_m_behring/book-scaffold-astro@^3.x`, edit `astro.config.mjs`:

```diff
- import { defineBookConfig } from '@brandon_m_behring/book-scaffold-astro';
+ import { defineBookConfig, academicStyle } from '@brandon_m_behring/book-scaffold-astro';

  export default await defineBookConfig({
-   preset: 'academic',
+   styles: [academicStyle],
    site: 'https://my-book.example.com/',
  });
```

| v3 preset | v4 import | v4 styles field |
|---|---|---|
| `'academic'` | `academicStyle` | `[academicStyle]` |
| `'tools'` | `toolsStyle` | `[toolsStyle]` |
| `'minimal'` | `minimalStyle` | `[minimalStyle]` |
| `'course-notes'` | `courseNotesStyle` | `[courseNotesStyle]` |
| `'research-portfolio'` | `researchPortfolioStyle` | `[researchPortfolioStyle]` |

If migration friction surfaces, file an issue at https://github.com/brandon-behring/book-scaffold-astro/issues with the `consumer:<your-workspace>` label. The v4.x release line is explicitly the iteration window for this API.

### Release policy

- **D12 lock-step preserved**: `@brandon_m_behring/create-book@4.0.0` ships alongside the toolkit.
- Pre-publish smoke gate (v3.6.5) ran end-to-end against academic + research-portfolio before publish.
- 124 unit tests + 56 visual baselines (AE=0) verify DOM output is unchanged by the API redesign.

## [3.7.1] — 2026-05-23

Patch release. Closes 3 issues from the [`brandon-behring/guides`](https://github.com/brandon-behring/guides) + [`brandon-behring/guides-experimentation`](https://github.com/brandon-behring/guides-experimentation) Phase 0b consumer batch. Unblocks that workspace's CI (which was crashing on `validate` under Node 20) and fixes brace-containing math in research-portfolio chapters.

### Fixed

- **`book-scaffold validate` no longer requires Node 22** ([#52](https://github.com/brandon-behring/book-scaffold-astro/issues/52)). `scripts/validate.mjs` previously imported `glob` from `node:fs/promises`, an API added in Node 22. The scaffold's generated consumer CI templates ship `node-version: '20'`, so `npm run validate` crashed on every consumer's prebuild hook with `SyntaxError: The requested module 'node:fs/promises' does not provide an export named 'glob'`. Replaced with a recursive `readdir` walker (extracted to `scripts/walk-mdx.mjs` for unit-testability). Works on Node 18+; output format matches the previous `glob('**/*.{md,mdx}', { cwd })` shape (POSIX-style relative paths). 6 new regression tests in `tests/validate-walker.test.mjs`.
- **MDX math with curly braces now renders in `research-portfolio` preset** ([#51](https://github.com/brandon-behring/book-scaffold-astro/issues/51)). Expressions like `$\mathbb{E}\{X\}$`, `$\mathbb{P}\{X|Y\}$`, `$\mathrm{Cov}\{X, Y\}$` previously failed because `src/config.ts` gated the KaTeX wiring on the literal `profile === 'academic'`, ignoring the `katex: true` flag that `research-portfolio` sets in its profile definition. Without `remark-math` intercepting first, MDX parsed `{X}` as a JSX expression containing undefined variable `X`. Fix: gate the wiring on `PROFILES[profile]?.katex === true` instead (single source of truth: the profile registry). New visual fixture `fixture-research-portfolio/.../math.mdx` covers brace-math at 4 viewport widths.
- **`create-book` now adds KaTeX peer deps for `research-portfolio` scaffolds** (paired with the above). Previously only academic scaffolds got `katex`/`rehype-katex`/`remark-math` in their generated `package.json`; research-portfolio scaffolds with `katex: true` would have failed to dynamic-import the peer deps even after the gate fix. Now both presets get the deps.

### Added

- **Component prop tables for v3.5.0 components** ([#48](https://github.com/brandon-behring/book-scaffold-astro/issues/48)) in `PACKAGE_DESIGN.md §10`. Covers `PreReleaseBanner`, `PolicyRef`, `AICollaborationDisclosure`, `BlockedByCallout` with prop signatures + default values + slot semantics. Source of truth remains each component's `.astro` Props interface; this is a quick-lookup table for chapter authors.

### Release policy

- **D12 lock-step preserved**: `@brandon_m_behring/create-book@3.7.1` ships alongside the toolkit.
- Pre-publish smoke gate (v3.6.5) ran end-to-end before publish.

## [3.7.0] — 2026-05-22

Minor release. Refactors the `/chapters` route from a field-presence discriminator into a per-profile renderer strategy plugged into the existing `PROFILES` registry. Closes [#35](https://github.com/brandon-behring/peppy-scroll/book-scaffold-astro/issues/35) and [#36](https://github.com/brandon-behring/book-scaffold-astro/issues/36). No breaking changes; consumer DOM output is byte-equivalent for both tools and academic profiles (verified by visual regression at AE=0).

### Changed

- **`pages/chapters.astro` now dispatches via `PROFILES[BOOK_PROFILE].chaptersRenderer`** instead of inline field-presence branching ([#35](https://github.com/brandon-behring/book-scaffold-astro/issues/35)). Route-level concerns (data fetch, byPart grouping, ToolFilter island wiring, CSS, inline filter script) stay in the route file. Per-profile concerns (numbering format, badge selection, sort key, `data-tools` attribute value) move into each profile's renderer. Pure-function strategy; no Astro imports in renderer modules (preserves the `chapter-sort.ts` pattern that keeps tsup's DTS bundler stable).
- **Per-card render data is precomputed in the frontmatter `---` block** rather than inline inside JSX expressions. Sidesteps an Astro-compiler limitation where TypeScript generic casts (`as Record<string, unknown>`) inside `{...}` JSX expressions get parsed as tag-start tokens. Functionally identical to the inline pattern; structurally cleaner separation of "compute data" from "render JSX."

### Added

- **`ChaptersRenderer` interface** ([`src/lib/chapters-renderer.ts`](https://github.com/brandon-behring/book-scaffold-astro/blob/main/package/src/lib/chapters-renderer.ts)) — typed strategy for the `/chapters` route. Public export from `index.ts` along with `PartKey`, `VolatilityBadge`, `StatusBadge`, `FreshnessAffordance` types and the three shipped renderer instances.
- **`toolsChaptersRenderer`** — implements current tools UI (numeric Part/Chapter labels, volatility badge, freshness affordance from `last_verified` + volatility class, tools-compared tags). DOM-equivalent to v3.5.2.
- **`academicChaptersRenderer`** — implements academic UI (string-enum Part labels, Week N numbering, status badge). DOM-equivalent to v3.5.2's academic branch.
- **`fallbackChaptersRenderer`** — used by minimal / course-notes / research-portfolio when those profiles opt into `routes.chapters: true`. Dispatches per-chapter via field presence (v3.5.2's logic, preserved as a safety net for shapes without a dedicated renderer).
- **`ProfileDefinition.chaptersRenderer?: ChaptersRenderer`** — optional field on the `defineProfile()` input. Each of the 5 shipped profiles is wired to its renderer (academic + tools → dedicated; minimal + course-notes + research-portfolio → fallback).
- **`package/tests/visual/fixture-academic-chapters/`** ([#36](https://github.com/brandon-behring/book-scaffold-astro/issues/36)) — new visual-regression fixture exercising the academic `/chapters` route end-to-end via `defineBookConfig({ profile: 'academic', routes: { chapters: true } })`. 5 chapters across foundations/ssm-core/beyond-ssm/synthesis parts; 4 routes screenshotted at 4 viewport widths = 16 baseline PNGs. Wired into the workflow via `run.sh` FIXTURES array + root `package.json` workspaces.

### Tests

- **`package/tests/chapters-renderer.test.mjs`** (31 cases) — covers all three renderers' methods: `formatChapterNumber`, `getFreshnessData` thresholds, `sortKey` monotonicity for both schemas, full academic part-enum ordinal mapping, fallback dispatch correctness, cross-renderer `sortKey` agreement on shared shapes.
- **`chapterSortKey` public export** (v3.5.2) — kept as a back-compat shim; tested to agree with the per-profile `sortKey` methods on both tools and academic shapes.
- **Visual regression**: 52 total baselines pass at AE=0 — 36 existing (tools fixture + course-notes + research-portfolio) unchanged by the refactor, 16 new (academic-chapters).

### Backward compatibility

- **Public API**: `chapterSortKey(data)` export retained; behavior unchanged. `ChaptersRenderer` type + three renderer instances added (additive).
- **Frontmatter schemas**: no changes. Both academic and tools schemas continue working as before.
- **Route URL**: `/chapters/` unchanged.
- **DOM output**: byte-for-byte equivalent for tools profile (verified at AE=0 against all 3 pre-existing visual fixtures). Academic profile DOM matches v3.5.2 (verified by smoke-testing the chapters listing under the refactored route).

### Release policy

- **D12 lock-step preserved**: `@brandon_m_behring/create-book@3.7.0` ships alongside the toolkit.
- Pre-publish smoke (added in v3.6.5) ran end-to-end against the v3.7.0 tarball before publish, exercising the academic chapters renderer + new visual fixture build.

## [3.6.5] — 2026-05-22

Release pipeline polish. No new consumer features; locks in the lessons from the v3.6.1 → v3.6.4 hotfix chain so the next minor (v3.7.0, chapters profile-strategy refactor) ships cleanly the first time. Closes [#37](https://github.com/brandon-behring/book-scaffold-astro/issues/37).

### Changed

- **Pre-publish smoke is now an automated CI gate** in `.github/workflows/publish.yml`. Runs after build/test and before either `npm publish` call: packs the toolkit locally (`npm pack`), scaffolds a fresh academic book via the in-repo `create-book` bin, installs the toolkit via `file://` tarball, runs `npm install + npm run build`, and asserts the chapter route + landing page + references page all emit HTML. If any step fails, neither package publishes (no irreversible npm side-effect). Same recipe that was run manually before v3.6.4; now mandatory.
- **`Smoke verify registry` now uses an incremental-backoff retry loop** (10s/20s/30s/40s/50s = 150s budget) instead of a single fixed `sleep 10`. Previous version false-failed on v3.5.2 / v3.6.2 / v3.6.4 publishes when `npm view` ran before the registry index propagated; the publishes themselves succeeded but the workflow exited non-zero. The loop logs each attempt + exits success on the first match.

### Fixed

- **No more `Node.js 20 actions are deprecated` workflow annotations**. Bumped `actions/checkout@v4` → `@v6`, `actions/setup-node@v4` → `@v6`, `actions/upload-artifact@v4` → `@v7` across all three workflows (`publish.yml`, `package-ci.yml`, `visual-regression.yml`). GitHub Actions force-upgrades Node 20 → Node 24 on June 2 2026 and removes Node 20 entirely on Sept 16 2026; this bump gets us ahead of both deadlines.

### Added

- `npm test --workspace create-book` step in `publish.yml` (10 scaffold tests join the toolkit's 47 in the publish gate). Pre-v3.6.5 only the toolkit's own tests ran; create-book had no gate at publish time.

### Release policy

- **D12 lock-step preserved**: `@brandon_m_behring/create-book@3.6.5` ships alongside the toolkit.
- Pre-publish smoke caught nothing this release (clean ship from v3.6.4); future publishes get the same gate.

## [3.6.4] — 2026-05-22

Patch release fixing the validator failure surfaced by the v3.6.3 end-to-end smoke test. With the bibliography parsing finally working (v3.6.3), `book-scaffold validate` ran and caught a different issue: the scaffolded academic demo chapter referenced `<Cite key="example-key2024" />` but the placeholder bibliography (added in v3.6.1) only defined `placeholder2026`. Every new academic book failed validate with "Unknown bibkey" on the first build.

This is the last step of the v3.6 bootstrap-experience regression chain. With v3.6.4, a fresh academic scaffold completes `npx create-book → npm install → npm run build` cleanly out of the box. Verified end-to-end against a local-tarball smoke test before shipping.

### Fixed

- **Demo academic chapter Cite key now references the placeholder bibkey** (`placeholder2026` instead of `example-key2024`). The demo `<Cite>` now actually demonstrates a working citation that resolves through the BibTeX pipeline.
- "What's next" prose updated to point at the actual `placeholder2026` entry name.

### Tests strengthened

- **`v3.6.4` regression test** added: parses bibkeys from generated `bibliography.bib`, parses Cite keys from generated demo chapter, asserts every Cite key has a matching bibkey. Catches "demo chapter cites bibkey X but bib defines bibkey Y" at scaffold-template-generation time.

### Process change

- **Pre-publish local-tarball smoke test added to the release workflow** (manual for now; tracked for future automation). Pattern: `cd package && npm pack`, scaffold a fresh book via the local create-book bin, edit its `package.json` to install the toolkit from `file:./brandon_m_behring-book-scaffold-astro-X.Y.Z.tgz`, run `npm install && npm run build`. Confirms the full bootstrap path works against an in-progress version BEFORE the OIDC publish makes anything irreversible.

### Release policy

- **D12 lock-step preserved**: `@brandon_m_behring/create-book@3.6.4` ships alongside the toolkit.
- **v3.6 bootstrap chain summary**: v3.6.0 had a hidden first-build crash (empty bib). v3.6.1–v3.6.3 chased the bib parsing problem through three citation-js antipatterns. v3.6.4 closes the loop by fixing the demo chapter's Cite reference + adding pre-publish smoke as a process gate.

## [3.6.3] — 2026-05-22

Patch release fixing the v3.6.2 fix for [#39](https://github.com/brandon-behring/book-scaffold-astro/issues/39). Caught again by the post-publish smoke test within 60 seconds of v3.6.2 shipping.

### Root cause (deepened)

`@citation-js/plugin-bibtex` tokenizes **any `@<word>` token** inside `%`-prefixed comment lines as an entry start — not just `@<word>{` (the v3.6.1 antipattern) and not just full `% @article{...}` blocks. v3.6.2's template included a prose mention `% for the supported BibTeX entry shapes (@article, @book, @inproceedings, ...)` — those bare `@article` / `@book` tokens (no `{`) also crashed the parser.

### Fixed

- **`bibliography.bib` template now contains zero `@<word>` tokens in comments**. Removed the "supported BibTeX entry shapes" listing from the comment block; the link to `recipes/02-bibliography-pipeline.md` remains as the discovery path.

### Tests strengthened

- **`#39 (v3.6.3)` regression test** widened: now flags `^%.*@\w+` (any `@word` token in a comment), not just `^%.*@\w+\{` (v3.6.2's narrower pattern). Comment in the test documents the v3.6.0 → v3.6.1 → v3.6.2 → v3.6.3 trail so future maintainers understand WHY the regex is so broad.

### Release policy

- **D12 lock-step preserved**: `@brandon_m_behring/create-book@3.6.3` ships alongside the toolkit.
- **Post-publish smoke caught its own bug twice in a row**. Process win: the failure mode is now fully characterized + locked behind a stricter regression test.

## [3.6.2] — 2026-05-22

Patch release fixing the v3.6.1 fix for [#39](https://github.com/brandon-behring/book-scaffold-astro/issues/39) (caught immediately by the post-publish smoke test). The v3.6.1 `bibliography.bib` template added a parseable `@misc{placeholder...}` entry but also included a trailing block of **commented-out** `@article` example syntax. `@citation-js/plugin-bibtex` tokenizes `@<entrytype>` tokens even inside `%`-prefixed lines — so the post-entry block still crashed the grammar parser, leaving v3.6.1 with the same first-build crash as v3.6.0.

### Fixed

- **`bibliography.bib` template no longer contains commented `@article` example block**. Replaced with a link to `recipes/02-bibliography-pipeline.md` for entry shape reference. The placeholder `@misc` entry remains; everything around it is plain-prose `%` comments with no `@<word>` tokens.

### Added

- **`create-book/tests/scaffold.test.mjs`**: new regression test (`#39 (v3.6.2): bibliography.bib must NOT contain commented-out @entry lines`) — fails the build if any line matches `^%.*@\w+\{`. Captures the anti-pattern at scaffold-template-generation time so this exact failure can't recur silently.

### Release policy

- **D12 lock-step preserved**: `@brandon_m_behring/create-book@3.6.2` ships alongside the toolkit.
- **Post-publish smoke catches its own bug**: the v3.6.1 issue was found within 60 seconds of publish by the planned end-to-end smoke test. Same loop would have caught the v3.6.0 first-build crash had it existed in v3.5.0's smoke. Process win for the release pipeline.

## [3.6.1] — 2026-05-22

Patch release closing the bootstrap-experience regression cycle surfaced by two consumers in 24 hours: the [`claude-books`](https://github.com/brandon-behring/claude-books) workspace and the [`double-ml-time-series`](https://github.com/brandon-behring/double-ml-time-series) pilot. Six issues closed, all in `create-book` or the LaTeX-mapping documentation.

### Fixed

- **`create-book` now scaffolds `src/pages/` routes** (closes [#28](https://github.com/brandon-behring/book-scaffold-astro/issues/28), surfaced by `claude-books`). Pre-v3.6.1 the scaffolded book emitted no `src/pages/index.astro` or `src/pages/chapters/[...slug].astro` — `npm run build` succeeded but produced zero per-chapter HTML, only auto-injected routes. Every new consumer had to manually add the two route files before the starter chapter rendered. Now `create-book` ships both files: a profile-appropriate landing page and the schema-agnostic chapter route, matching the working pattern from `package/tests/visual/fixture/src/pages/`.
- **Fresh academic scaffold's `bibliography.bib` no longer crashes `npm run build`** (closes [#39](https://github.com/brandon-behring/book-scaffold-astro/issues/39), surfaced by `double-ml-time-series` smoke test). The pre-v3.6.1 comments-only template crashed `@citation-js/plugin-bibtex` with a Grammar parse error on first `build:bib`. The template now ships a parseable `@misc{placeholder2026, ...}` entry with a clearly-marked "remove after adding real refs" note.
- **`LATEX_TO_MDX_MAPPING.md` documents practice tags + MarginNote API** (closes [#29](https://github.com/brandon-behring/book-scaffold-astro/issues/29) and [#30](https://github.com/brandon-behring/book-scaffold-astro/issues/30), both surfaced by `claude-books`). The `Tag` row now covers `\official` / `\practitioner` / `\convergence` (and the `\tag*` prefixed variants) for inline source-authority assertions, not just volatility chips. The `MarginNote` row's previously-empty Props column now lists `variant?: 'note' | 'warning' | 'tip'; label?: string` and surfaces the `\marginnotebox` / `\marginwarning` / `\margintip` multi-command mapping.
- **`XRef.astro` JSDoc reflects shipped Phase 2.6 validator behavior** (closes [#31](https://github.com/brandon-behring/book-scaffold-astro/issues/31), surfaced by `claude-books`). Pre-v3.6.1 the JSDoc said "the build doesn't fail" on unknown ids — but Phase 2.6 promoted unknown-id to a hard `book-scaffold validate` failure. The JSDoc now clearly separates the runtime placeholder (dev ergonomics) from the CI hard-fail (deploy gate), with a brief note on the bootstrapping pattern for porting books chapter-by-chapter.

### Added

- **`create-book --preset=NAME` flag** (closes [#38](https://github.com/brandon-behring/book-scaffold-astro/issues/38)). Canonical synonym of `--profile=NAME`, matching the v3.4.0 [#9](https://github.com/brandon-behring/book-scaffold-astro/issues/9) preset-vocabulary refactor that already covers `book-scaffold validate` + `defineBookConfig`. `--profile` keeps working as a backward-compatible alias. `--help` now lists `--preset` first.
- **`create-book/tests/scaffold.test.mjs`** — first test suite for the create-book package. Covers the three fixes above: scaffold emits the expected files, `--preset` and `--profile` produce identical output, generated `bibliography.bib` is non-empty and parseable.

### Release policy

- **D12 lock-step preserved**: `@brandon_m_behring/create-book@3.6.1` ships alongside the toolkit.
- **Consumer-driven evolution**: this patch credits the two consumers who surfaced the issues. `claude-books` filed 4 of the 6 (#28/#29/#30/#31); `double-ml-time-series` surfaced #39 via the v3.6.0 post-publish smoke test; #38 is internal cleanup from the v3.6.0 docs refresh.

## [3.6.0] — 2026-05-22

Minor release adding the third deliverable from the [double_ml_time_series](https://github.com/brandon-behring/double_ml_time_series/issues/1) pilot batch: a supported extension point for KaTeX macros, so non-SSM academic books can ship their own notation without forking the scaffold. Carries forward the v3.5.2 (chapters academic crash, [#24](https://github.com/brandon-behring/book-scaffold-astro/issues/24)) and v3.5.3 (validate .env, [#20](https://github.com/brandon-behring/book-scaffold-astro/issues/20)) hotfixes from the same pilot batch.

### Added

- **`katexMacros` option on `defineBookConfig`** (closes [#22](https://github.com/brandon-behring/book-scaffold-astro/issues/22)). Consumer-supplied macros are shallow-merged onto `ssmMacros` before being handed to `rehype-katex`. Consumer wins on key collision so a book can override a scaffold default if pedagogically motivated.

  ```ts
  defineBookConfig({
    site: '...',
    katexMacros: {
      '\\Var': '\\mathrm{Var}',
      '\\Cov': '\\mathrm{Cov}',
      '\\ate': '\\tau',
    },
  });
  ```

  Required for the first non-SSM academic consumer (DML book uses `\Var`, `\Cov`, `\ate`, `\propensity`, etc. that aren't in `ssmMacros`). Backward compatible — omitting the option yields the existing behavior.

### Tests added

- `package/tests/katex-macros.test.mjs` (4 tests): backward compatibility, consumer-merge, override semantics, tools-profile leakage check.

### Process note

Third deliverable from the inline-upstream-PR loop documented in the double_ml_time_series pilot plan (R3.Q2). Three fixes/features (chapters academic crash, validate .env, katex macros) shipped in 24 hours — surfaced by the consumer's bootstrap → smoke test → math-notation usage path.

### Release policy

- **D12 lock-step preserved**: `@brandon_m_behring/create-book@3.6.0` ships alongside the toolkit.

## [3.5.3] — 2026-05-22

Patch release surfaced by the [double_ml_time_series](https://github.com/brandon-behring/double_ml_time_series/issues/1) consumer pilot. First non-SSM academic-profile book through the scaffold; the `validate` CLI silently defaulted to `minimal` even when `.env` set `BOOK_PROFILE=academic`, hiding academic-only checks like Cite-key validation.

### Fixed

- `book-scaffold validate` now reads `.env` from the consumer's project root when neither `--preset` nor `BOOK_PRESET`/`BOOK_PROFILE` env vars are set (closes [#20](https://github.com/brandon-behring/book-scaffold-astro/issues/20)). Restores the convenience promised in `SKILL.md` and `src/types.ts:126-131` ("consumers who put `BOOK_PROFILE=…` in .env get it picked up without needing `node --env-file=.env` or `dotenv-cli`"). Validate now matches the resolution chain used by `defineBookConfig`/`defineBookSchemas` via `resolvePreset()` in `src/types.ts`.

### Tests added

- `tests/validate-root.test.mjs` — `.env BOOK_PROFILE is honored when no env or flag is set (closes #20)`.
- `tests/validate-root.test.mjs` — `BOOK_PROFILE env still wins over .env (closes #20)` (asserts the resolution chain still preserves env-var priority over `.env`).

### Process note

This is the second patch surfaced via the inline-upstream-PR loop documented in the double_ml_time_series pilot plan (R3.Q2). Originally bumped to 3.5.2 on the branch; rebased to 3.5.3 after v3.5.2 (chapters academic crash, [#24](https://github.com/brandon-behring/book-scaffold-astro/issues/24)) landed first.

### Release policy

- **D12 lock-step preserved**: `@brandon_m_behring/create-book@3.5.3` ships alongside the toolkit.

## [3.5.2] — 2026-05-22

Patch release fixing the academic-profile `/chapters` crash surfaced by the [`double-ml-time-series`](https://github.com/brandon-behring/double-ml-time-series) pilot (closes [#24](https://github.com/brandon-behring/book-scaffold-astro/issues/24)). Also tightens lock-step release publishing to OIDC trusted publishing on tag push, eliminating the `~/.npmrc` token requirement.

### Fixed

- **`/chapters` no longer crashes on academic profile when `routes.chapters: true`** ([#24](https://github.com/brandon-behring/book-scaffold-astro/issues/24)). The shipped `pages/chapters.astro` and `src/lib/chapters.ts:sortKey` were hardcoded to the tools-profile schema (numeric `part` × 1000 + numeric `chapter`); academic chapters (string-enum `part`, numeric `week`, no `chapter`) produced NaN sort keys and crashed the page render. `chapterSortKey` is now schema-aware and rendering is conditional on which fields the chapter exposes. Surfaced by `consumer:double-ml-time-series` after enabling `defineBookConfig({ profile: 'academic', routes: { chapters: true } })`.
- `create-book/package.json` bin path is normalized to `bin/create-book.mjs` (no leading `./`) to match what npm publishes and silence the per-publish `npm pkg fix` warning.

### Added

- Public export `chapterSortKey(data)` — pure-function sort key spanning both schemas; reusable in consumer-built chapter index pages.
- `.github/workflows/publish.yml` — OIDC trusted publishing via GitHub Actions. Fires on `v*.*.*` tag push (or `workflow_dispatch` for backfill). Publishes both packages in lock-step with hard version-match verification. No `NPM_TOKEN` secret needed; provenance attestation is automatic.

### Release policy

- **D12 lock-step preserved**: `@brandon_m_behring/create-book@3.5.2` ships alongside the toolkit.
- **First release published via OIDC trusted publishing** (workflow added in v3.5.2 cycle; v3.5.1 was the last release published manually via local `~/.npmrc` token).

## [3.5.1] — 2026-05-19

Patch release to put the post-v3.5.0 hygiene/build fixes behind a proper tag instead of leaving `v3.0` ahead of the latest release tag.

### Fixed

- Demo builds are reproducible from a fresh clone: the demo now explicitly uses the `academic` preset in Astro config, content schema config, and `book-scaffold validate`.
- Restored the missing `demo/public/figures/phase.svg` fixture referenced by the demo label-validation chapter.
- `package-lock.json` now matches the lock-step workspace release version.

### Changed

- `demo/src/data/references.json` is ignored as generated bibliography output.

### Release policy

- **D12 lock-step preserved**: `@brandon_m_behring/create-book@3.5.1` ships alongside the toolkit.

## [3.5.0] — 2026-05-19

Closes the last open issue from the v3.3.0 cycle: [#6](https://github.com/brandon-behring/book-scaffold-astro/issues/6) — `research-portfolio` preset. Unblocks downstream [`prompt-injection-portfolio`](https://github.com/brandon-behring/prompt-injection-portfolio) M1 book authoring. Adds the 5th preset, 4 new components, a recipe, a chapter template, and a third visual regression fixture.

### Added

- **New `'research-portfolio'` preset** (closes [#6](https://github.com/brandon-behring/book-scaffold-astro/issues/6)). Modernized union of academic + tools field shapes — `tags` (freeform string array, not the `tools_compared` enum), structured inline sources with T1/T2/T3/T4 short-form tiers, optional `freshness` enum (`experimental-result | literature-survey | theoretical | reference`), all hierarchy fields optional so chapters can mix academic-style (week + part-enum) and tools-style (chapter + part-number) shapes. KaTeX math wired on by default. `/frontmatter/[slug]` route auto-enabled (portfolios universally need title-page + AI-disclosure + pre-release-banner pages).

- **4 new components** for research-portfolio + general use:
  - **`PreReleaseBanner`** — site-wide banner declaring release state (`alpha | beta | rc | locked`). Configurable `dismissAt` tag + custom `message`. Color-coded via warm-tone palette.
  - **`PolicyRef`** — inline link to a repo-root policy document (ETHICS.md / SECURITY.md / GOVERNANCE.md / CODE_OF_CONDUCT.md / LICENSE). Auto-slugifies section anchors; explicit `href` override.
  - **`AICollaborationDisclosure`** — structured AI-collaboration disclosure block. Props-driven (`model`, `role`, `commit_attribution`) with optional slot for extra prose. YAML-driven config supported via consumer-side astro:content loading.
  - **`BlockedByCallout`** — declare upstream blockers (tool release, paper publication, dataset acquisition). Structured fields (`upstream`, `reason`, optional `url` + `unblockedAt`) plus slot for migration notes.

- **Recipe 13**: `recipes/13-research-portfolio-getting-started.md` — when to use the preset, frontmatter shape, the 4 components, migrating from a hand-rolled schema.

- **Chapter template**: `examples/chapter-template-research-portfolio.mdx` — working template exercising every new component + a Theorem + Cite + Sidenote.

- **`researchPortfolioChapterSchema`, `sourceTiersResearch`, `ResearchPortfolioChapter` type** exported from main entry + `/schemas` subpath.

### Changed (internal, non-breaking)

- **5-preset lineup**: `academic | tools | minimal | course-notes | research-portfolio`. PROFILES registry in `src/profiles/index.ts` adds the 5th file; `ChapterFor<P>` discriminated lookup extends accordingly.

- **Visual regression CI**: extended to 36 baselines (12 academic + 12 course-notes + 12 research-portfolio). The new fixture at `package/tests/visual/fixture-research-portfolio/` exercises all 4 new components AND the frontmatter route plumbing (issue #7) in one place — single-fixture coverage of v3.5.0's API surface.

- **`files` allowlist** in `package/package.json` now includes `examples/` (new chapter template ships in the published tarball).

### Migration

Consumers do not need to update any calls to consume v3.5.0. Existing presets unchanged. To use the new preset:

- `defineBookConfig({ preset: 'research-portfolio' })` — academic-style structure + tools-style provenance + portfolio components.
- Frontmatter pages: drop MDX files under `src/content/frontmatter/`, define the collection via `frontmatterCollection()` helper. Auto-route active by default for this preset.
- See `recipes/13-research-portfolio-getting-started.md` for the full migration guide from a hand-rolled portfolio schema.

### Release policy

- **D12 lock-step preserved**: `@brandon_m_behring/create-book@3.5.0` ships alongside the toolkit.

### Open issues

The toolkit's issue tracker is empty after v3.5.0 — every issue filed during the v3.3.0 + v3.4.0 cycles (#1-#14) is closed. Next cycle's batch will be driven by the next consumer-pilot dogfooding pass.

## [3.4.0] — 2026-05-19

Closes 8 of 9 open issues filed during the v3.3.0 release cycle (cross-consumer dogfooding). Introduces the `preset` vocabulary (with `profile` as backward-compat alias) and reaffirms D12 lock-step versioning between toolkit and `create-book`. Issue [#6](https://github.com/brandon-behring/book-scaffold-astro/issues/6) (research-portfolio profile + 3 new components) deferred to its own dedicated session due to size (~3-5 days) and cross-repo coordination needs with `prompt-injection-portfolio`.

### Fixed

- **`book-scaffold validate` now reads from consumer root, not package root** ([#8](https://github.com/brandon-behring/book-scaffold-astro/issues/8)). Pre-v3.4.0 the validator resolved `ROOT` from `import.meta.url`, pointing at the package's own directory inside `node_modules` — three reference consumers (post_transformers, book-template-astro, dlai-study-notes) all silently reported `0 chapter(s) checked` (false negative). Now uses `process.cwd()`. `BOOK_REPO_ROOT` env override preserved for CodeRef cross-repo line-number checks. Regression coverage via `tests/validate-root.test.mjs`.

- **`book-scaffold <subcommand> --help` is now non-mutating** ([#14](https://github.com/brandon-behring/book-scaffold-astro/issues/14)). Each subcommand (validate, build-labels, build-bib, build-figures, render-notebooks) prints usage + exits 0 on `--help` / `-h` before any FS reads/writes. Regression coverage via `tests/cli-help.test.mjs` (10 cases: 5 scripts × 2 flag forms).

- **Active package CI restored** ([#10](https://github.com/brandon-behring/book-scaffold-astro/issues/10)). Workflow moved from the never-discovered `package/.github/workflows/ci.yml` subdirectory to `.github/workflows/package-ci.yml`. Added a **consumer-root validate smoke** step that exercises the #8 fix in CI — spawns `npx book-scaffold validate` against the academic visual-regression fixture and asserts non-zero chapter count.

- **Stale Deploy workflow removed** ([#11](https://github.com/brandon-behring/book-scaffold-astro/issues/11)). The root `.github/workflows/deploy.yml` targeted a `book-template-astro` Cloudflare Pages project that doesn't exist for this repo (leftover from the v2.0 template-clone era). Failed on every push and obscured genuine CI signal. Recreate per `recipes/05-deploy-cloudflare.md` if a real deploy target emerges.

### Added

- **`preset` as the canonical vocabulary, `profile` as alias** ([#9](https://github.com/brandon-behring/book-scaffold-astro/issues/9)). The 4-profile enum (`academic | tools | minimal | course-notes`) is now also accessible as `BookPreset` + `BOOK_PRESETS`. `defineBookConfig({ preset: 'academic' })` is canonical; `defineBookConfig({ profile: 'academic' })` keeps working forever as an alias. Same shape applies to `defineBookSchemas`. Positions the toolkit for future composable-preset features (issue #6 research-portfolio being the natural test case).

- **Runtime + CLI preset propagation** ([#9](https://github.com/brandon-behring/book-scaffold-astro/issues/9)). The Integration sets `vite.define['import.meta.env.BOOK_PRESET']` AND `import.meta.env.BOOK_PROFILE` (both, for back-compat) to the resolved value during `astro:config:setup`. Consumer components reading either env var (e.g. `Base.astro`, `Sidebar.astro`) get the value `defineBookConfig` resolved, regardless of whether the env was set externally. **Single source of truth across config + runtime + CLI**. The `validate` subcommand also accepts a `--preset <name>` CLI flag (closes the gap for separate-process scripts that don't have access to the Astro config).

- **`frontmatterCollection(zodSchema)` helper + auto-injected `/frontmatter/[slug]/` route** ([#7](https://github.com/brandon-behring/book-scaffold-astro/issues/7)). Generic primitive for books that need title-page / disclosure / banner / acknowledgments / exec-summary pages. Consumer wires the schema via the helper in `content.config.ts`, opts into the route via `defineBookConfig({ routes: { frontmatter: true } })`, drops MDX files under `src/content/frontmatter/`. The auto-injected route renders entries through the consumer's `mdx-components.ts` registry (issue #2 plumbing). Default `false` per profile — explicit opt-in is debuggable.

- **`resolvePreset()` exported** as the canonical resolver. Accepts both `preset` and `profile` explicit args; reads `BOOK_PRESET` (preferred) and `BOOK_PROFILE` (alias) env vars; `.env` lookups for both. `resolveProfile()` kept as alias.

### Release policy

- **D12 lock-step versioning reaffirmed** ([#12](https://github.com/brandon-behring/book-scaffold-astro/issues/12)). Toolkit + `create-book` always ship at matching versions, including cosmetic bumps. `@brandon_m_behring/create-book@3.4.0` ships alongside `@brandon_m_behring/book-scaffold-astro@3.4.0`. The `create-book` generated `package.json` pins `^${selfVersion}`, keeping consumer scaffolds aligned with the toolkit version that authored them. Root monorepo `package.json` also bumped to `3.4.0` as a marker.

### Migration

Consumers do not need to update any calls to consume v3.4.0:
- `defineBookConfig({ profile: 'academic' })` keeps working (alias).
- `BOOK_PROFILE` env keeps working (alias).
- `resolveProfile()` keeps working (alias).
- All existing route toggles work; `frontmatter` is a new optional toggle (default false).

To opt into new features:
- Use `preset` instead of `profile` in new code (forward-looking name).
- Add `routes: { frontmatter: true }` + define the collection via `frontmatterCollection()` for title-page / disclosure / acknowledgments routes.
- Run `book-scaffold <cmd> --help` for non-mutating usage.
- `book-scaffold validate` now actually validates your consumer's chapters (was a false-negative no-op before v3.4.0).

### Verification

- Tests: 30 node:test cases (8 existing build-labels + 9 freshness + 10 cli-help + 3 validate-root). All pass.
- Visual regression CI: 24 baselines (12 academic + 12 course-notes) still pass at AE=0 (no rendering change in v3.4.0).
- New `package-ci` workflow active at `.github/workflows/package-ci.yml`; old `Deploy` workflow removed.
- Lock-step published: `npm view @brandon_m_behring/book-scaffold-astro@3.4.0 version` + `npm view @brandon_m_behring/create-book@3.4.0 version` both return `3.4.0`.

### Docs

- README updated to v3.4.0 + 4 profiles + preset terminology + links to LATEX_TO_MDX_MAPPING.md + new recipe 12.
- New `recipes/12-where-to-file-issues.md` — documents the consumer-driven evolution feedback loop.
- PACKAGE_DESIGN.md deep refresh deferred to v3.4.1; v3.3.0 added §17 (LATEX migration) but the §1 Q1-Q6 framing needs an "historical decisions" wrapper.

## [3.3.0] — 2026-05-19

Closes 5 issues filed from the DLAI knowledge-graphs-rag pilot consumer (cross-consumer dogfooding loop). Adds a new profile + two new `defineBookConfig` options + a comprehensive LaTeX migration doc. Architecture refactor (profile-module registry) is internal and backward-compatible.

### Added

- **New `'course-notes'` profile** (closes [#4](https://github.com/brandon-behring/book-scaffold-astro/issues/4)). Designed for course-derived study notes (DLAI, Coursera, Manning, ...). Schema fields:
  - Identity: `title`, `chapter`, `part`, `description`
  - Attribution: `course`, `instructor`, `source_url`
  - Pedagogy: `learning_outcomes: Array<{id, verb, text}>`, `tags: string[]` (freeform)
  - Provenance: `last_verified`, `volatility`, `sources`, `draft`

  Auto-injects `/references`, `/search`, `/print` (no `/chapters` — the multi-book consumer pattern routes via `[book]/[slug]` itself). Multi-book corpus support: extend schema consumer-side via Zod `.extend()` with a `book` discriminator.

- **`defineMdxComponents<T>()` helper** (closes [#2](https://github.com/brandon-behring/book-scaffold-astro/issues/2)). Consumers create `src/mdx-components.{ts,js,mjs}` at project root; toolkit auto-detects and threads the components through all auto-injected routes via a Vite virtual module (`virtual:book-scaffold/mdx-components`). Custom components (`<AnkiCard>`, `<NarrativeBox>`, ...) now render correctly on `/print` and future `/pdf`, `/epub` without consumer-side route shadowing. Override path with `defineBookConfig({ mdxComponentsModule: '...' })`.

- **`defineBookConfig({ routes: { ... } })` per-route override** (closes [#3](https://github.com/brandon-behring/book-scaffold-astro/issues/3)). Object-key override of profile-default auto-injected routes:
  ```ts
  defineBookConfig({
    profile: 'course-notes',
    routes: { chapters: true },   // override the profile default
  });
  ```
  Shape: `Partial<{ references, search, print, chapters, convergence }>` with full TS autocomplete + typo-catching (e.g., `convergance: false` errors).

- **`defineProfile<S>()` helper + `PROFILES` registry** (internal). Each profile lives in `src/profiles/<name>.ts` and declares its schema + routes + styles via `defineProfile()`. Adding the 5th, 6th, Nth profile is a single-file change. Exposed publicly for consumers writing their own profile modules.

- **Inferred chapter types** exported per profile: `AcademicChapter`, `ToolsChapter`, `MinimalChapter`, `CourseNotesChapter`. Plus generic `ChapterFor<P extends BookProfile>` for profile-parametrized helpers. All derived from Zod schemas via `z.infer<>` — single source of truth.

- **`LATEX_TO_MDX_MAPPING.md`** (closes [#5](https://github.com/brandon-behring/book-scaffold-astro/issues/5)). Comprehensive `.tex → .mdx` migration reference: 38-component mapping table + extension candidates not shipped (Problem/Solution, Vignette, DecisionTree, AnkiCard, Term, etc.) + common conversion mistakes (NarrativeBox vs SkillBox, KeyConcept vs KeyIdea, ...). Cross-linked from README and PACKAGE_DESIGN.md.

### Fixed

- **`getFreshness()` no longer crashes on undefined `last_verified`** (closes [#1](https://github.com/brandon-behring/book-scaffold-astro/issues/1)). Signature changes from `(Date, VolatilityLevel) → Freshness` to `(Date | undefined, VolatilityLevel) → Freshness | null`. `freshnessLabel()` accepts `Freshness | null` and returns `'Verification status unknown'` sentinel for null input. Callers compose with optional chaining: `getFreshness(d.last_verified, d.volatility)?.status`.

### Changed (internal, non-breaking)

- **Profile/route logic refactored** from monolithic conditionals in `integration.ts` to per-profile modules in `src/profiles/{academic,tools,minimal,course-notes}.ts`. Each module declares its schema + routes + styles + (optional) katex flag. `bookScaffoldIntegration` consumes `PROFILES[profile]` instead of branching on profile string. Adding the 5th/6th/Nth profile is a single-file change.

- **Zod schemas remain consolidated in `schemas.ts`** (single import of `astro/zod`). Per-profile modules re-export the inferred types. Rationale: rollup-plugin-dts can't resolve Zod v4's dual CJS/ESM `default` export when the same Zod import appears in multiple entry-graph files. This is the only architectural concession in the registry pattern.

- **`/schemas` subpath unchanged** — existing consumer imports (`@brandon_m_behring/book-scaffold-astro/schemas`) continue to work without modification.

### Migration

Consumers do not need to update any calls to consume v3.3.0. To opt into new features:

- **Custom MDX components on scaffold-injected routes**: create `src/mdx-components.ts` (see [LATEX_TO_MDX_MAPPING.md](./package/LATEX_TO_MDX_MAPPING.md#consumer-side-extensions-definemdxcomponents)).
- **Disable an auto-injected route**: `defineBookConfig({ routes: { chapters: false } })`.
- **Switch to course-notes content shape**: set `BOOK_PROFILE=course-notes` (env or `.env`) and align frontmatter with `courseNotesChapterSchema`.
- **Use inferred chapter types**: `import type { AcademicChapter } from '@brandon_m_behring/book-scaffold-astro'` — derived from the Zod schema, always in sync.

### Verification

- **CI**: `.github/workflows/visual-regression.yml` now exercises both the existing academic fixture AND a new course-notes fixture (which uses `defineMdxComponents` to register a custom `<NarrativeBox>` component, exercising the issue #2 virtual-module plumbing end-to-end). 24/24 cases pass at AE=0.
- **Tests**: 17 node:test cases (8 existing build-labels + 9 new freshness) all pass.
- **DOM**: production verification grep for `data-companion` (v3.2.0 marker) still succeeds — academic profile rendering unchanged.

## [3.2.0] — 2026-05-19

### Fixed

- **`ChapterHeader` narrow-viewport regression (closes the long-tail of the v3.1.0 regression cycle)**.
  v3.1.0 shipped `<aside class="chapter-companions"><ul>…</ul></aside>` with no CSS coverage. UA-default `<ul>` block layout added ~80–110px of vertical header height at <=1280px viewports vs the v2.0 baseline, producing a uniform top-to-bottom pixel shift on all academic chapter pages (~860–990k differing pixels per chapter at 1280px; heatmap confirmed the diff was uniform, not localized). The earlier hypothesis that `roadmap_lines` frontmatter triggered the shift was a red herring (defined in schemas.ts:74 but never consumed by any component).

### Changed

- **`ChapterHeader.astro` — companions render inline.** Companion artifacts (code path, tests path, notebook path) now emit as `<span class="chapter-companion" data-companion="code|tests|notebook">` elements directly inside the existing `.chapter-meta` flex row. No `<aside>`, no `<ul>`, no "Companion artifacts:" label. Zero added vertical height by construction. The `data-companion` attribute preserves introspection (e.g., future Markdown export of companions can query `[data-companion]`).
- **Notebook link text simplified.** Previously rendered the full transformed path (`/notebooks/<basename>.html`); now renders just the word "Notebook" — the path was meta-noise inside the header.

### Added

- **`.chapter-companion` CSS class.** Inline-chip styling (font-code, muted color, dotted underline on links) matching the existing `.chapter-meta` aesthetic. ~12 lines in `styles/chapter.css`. Uses existing design tokens only — no new tokens introduced.
- **Visual regression CI** at `package/tests/visual/`. Synthetic fixture Astro consumer (academic profile, 2 fixture chapters) builds via `npm run build`, served on localhost:4173, screenshotted via chrome-headless at 768/1280/1440/1920 px viewports, pixel-diffed against committed baselines with ImageMagick `compare -metric AE` against a 50000-pixel threshold. Single-file bash runner at `package/tests/visual/run.sh`; baselines committed at `package/tests/visual/baselines/`. Tooling chosen for portability — Playwright's bundled chromium-headless-shell isn't built for every Linux distro (Ubuntu 26.04 at time of writing); chrome + ImageMagick are pre-installed on `ubuntu-latest` GitHub runners and on most dev machines. Runs as `.github/workflows/visual-regression.yml` on every PR + push touching `package/**`.

### Migration notes

Consumers do not need to change anything to consume v3.2.0 — the rendering change is internal to `ChapterHeader.astro`. Any consumer that wrote CSS targeting `.chapter-companions` (the old aside class) or `aside.chapter-companions strong` (the old label) will lose those rules silently; both reference consumers (`post_transformers`, `book-template-astro`) have no such CSS.

### Verification

- `@brandon_m_behring/book-scaffold-astro@3.2.0` published at `latest` tag.
- `post_transformers/guides/web` rebuilds locally + on Cloudflare with `^3.2.0` semver pin.
- Production verification: `curl https://post-transformers-guide.brandon-m-behring.workers.dev/chapters/week01/ | grep 'data-companion'` returns 3 matches (code + tests + notebook) — confirms the new inline rendering is live.
- Visual regression CI baselines committed at `package/tests/visual/__snapshots__/`.

### Out of scope (deferred to a future release)

- Tools-profile visual coverage (current fixture is academic-only; the regression class was academic-specific).
- Pre-existing CI workflow path issue: `package/.github/workflows/ci.yml` is in a sub-path GitHub Actions doesn't discover; tracked separately.

## [3.1.0] — 2026-05-19

### Added — academic ChapterHeader flavor (closes post-ship narrow-viewport regression)

- **`ChapterHeader.astro` — Roman-numeral part labels** for academic profile. Internal `ACADEMIC_PART_LABELS` map renders `foundations → Part I · Foundations`, `ssm-core → Part II · SSM Core`, etc. Tools profile + minimal fallback paths unchanged. Restores v2.0 post_transformers conventions verbatim.
- **`ChapterHeader.astro` — StatusBadge integration**. The internal `<StatusBadge>` component (already shipped since 3.0.0) is now mounted in the meta row when `hasAcademicMeta && data.status` is set. Visual treatment matches v2.0's colored-pill 3-state public translation.
- **`ChapterHeader.astro` — companion-artifacts block**. New `<aside class="chapter-companions">` rendered when an academic chapter has any of `code_path`, `tests_path`, or `notebook_path` frontmatter. Uses existing `<CodeRef>` component for code/tests; notebook path is transformed via generic basename strip (`.replace(/^.*\//, '').replace(/\.ipynb$/, '')`) → `/notebooks/<basename>.html`, portable across academic books.

### Changed

- **`ChapterHeader.astro`** no longer renders a raw `<span class="status-badge">` for academic chapters — `<StatusBadge>` replaces it. CSS class `.status-badge` was already styled in package's chapter.css (verbatim v2.0 port) so no additional CSS work required.

### Fixed

- **Narrow-viewport chapter render diff** vs v2.0 production. The schema-agnostic minimal ChapterHeader shipped in 3.0.0 produced ~800k–1M differing pixels per chapter at 1280 / 1440 / 768 widths (pixel-identical at 1920). Restoring the v2.0 academic content density (Roman labels + StatusBadge + companion block) closes the gap. Tracked at `~/tmp/v3-visual-diff/diff-report.txt`; pass criteria documented in the v3.1.0 plan.

### Verification

`@brandon_m_behring/book-scaffold-astro@3.1.0` + `@brandon_m_behring/create-book@3.1.0` published at `latest` tag. post_transformers/guides/web rebuilds locally + on Cloudflare with `^3.1.0` semver pin (auto-picks via existing `^3.0.1` pin). Diff report comparing v2.0 reference (`~/tmp/v3-visual-diff/v2.0/`) vs v3.1.0 production saved as `diff-report-3.1.0.txt`.

### Out of scope (deferred)

- `/chapters/` index page restructure (~30k diff at desktop) — separate v3.x scope.
- `/references/` auto-injected restructure (~30k diff) — same.
- Phase F test additions (validate.test.mjs, build-bib.test.mjs, .pre-commit-config.yaml).

## [3.0.0] — 2026-05-19

### Added

- **npm package pivot**: ships as [`@brandon_m_behring/book-scaffold-astro`](https://www.npmjs.com/package/@brandon_m_behring/book-scaffold-astro) (toolkit) + [`@brandon_m_behring/create-book`](https://www.npmjs.com/package/@brandon_m_behring/create-book) (bootstrap CLI), at lock-step versions (D12). Consumers thin to ~50 lines of book-side config; bug fixes propagate via `npm update`.
- **`defineBookConfig({ site, profile?, extraIntegrations?, extraStyles?, markdown? })`** — Astro config helper. Threads `BOOK_PROFILE` env, wires MDX + Preact + `bookScaffoldIntegration`, applies profile-conditional KaTeX. Returns an `AstroUserConfig`.
- **`defineBookSchemas({ profile?, chaptersBase? })`** at `/schemas` subpath — closed-surface Content Collections helper. Returns `{ collections: { chapters, sources, changelog, patterns } }`. Tools-collateral collections register conditionally on file existence. Consumer extends via standard JS spread + Zod `.extend()`.
- **`bookScaffoldIntegration`** — dual-purpose Astro Integration that does:
  - Style auto-injection (Option α, Phase A.5-verified): `injectScript('page-ssr', "import '@brandon_m_behring/book-scaffold-astro/styles/X.css'")` for each profile-resolved stylesheet. Cross-profile escape hatch via `extraStyles` array.
  - Route auto-injection (`injectRoute`): `/references`, `/search`, `/print` for all profiles; `/chapters`, `/convergence` for tools profile. Consumer overrides by creating their own `src/pages/<route>.astro` (Astro user-routes-win precedence).
- **`book-scaffold` single-dispatcher CLI** with sub-commands: `validate`, `build-labels` (new — emits `src/data/labels.json` for `<XRef>`), `build-bib`, `build-figures`, `render-notebooks`. Per master plan D4: zero external CLI deps; `node --test`-built; ~50 lines.
- **Pre-compiled `.tsx` islands** (ToolFilter, VersionSelector) via tsup + preact JSX preset — Vite doesn't reach into `node_modules` for JSX transform, so they ship as compiled `.mjs`.
- **Schema-agnostic `ChapterHeader`** — renders only the fields present on the chapter data; works for academic + tools profile schemas without crashing.
- **`.env` auto-loading** in `resolveProfile` — picks up `BOOK_PROFILE` from `./.env` if not set in `process.env`. Astro's Node-context config loading doesn't auto-populate process.env from .env; this fills the gap without needing `node --env-file=.env`.
- **`./package.json` export** — exposes the manifest for consumer tools (`npm view --json`, linters, build introspection).
- **`./schemas` separate entry** — defineBookSchemas lives at a Vite-only subpath (Node's ESM loader can't resolve the `astro:content` virtual module that schemas-entry imports; content.config.ts IS Vite-processed, so the subpath works there).
- **Sources / changelog / patterns collections** register only when backing files exist on disk (academic books no longer see noisy `File not found` errors).
- **Cross-package style auto-injection POC** (Phase A.5) archived at `~/.claude/plans/poc-archive/v3-poc-outcome.md`.
- **`PACKAGE_DESIGN.md`** — 18-section design doc serving as Phase B spec + consumer API reference. 934 lines.
- **`PUBLISHING.md`** — npm setup walkthrough (account, 2FA / granular token with bypass-2FA, registry verification, common snags).
- **CI workflow** at `package/.github/workflows/ci.yml`: tests, build, exports-map verification, npm pack dry-run, smoke build of the in-repo demo workspace.
- **`build-labels.mjs`** test suite (`tests/build-labels.test.mjs`, 8 tests, node:test) — covers per-chapter per-type counter, `label=` prop override, href shape, empty corpus, deterministic output.

### Changed

- **Repo layout** — monorepo with npm workspaces. `package/` (toolkit), `create-book/` (CLI), `demo/` (in-repo Astro demo via workspace link). Root `package.json` declares workspaces; `main` branch stays on v2.0 until merge of `v3.0`.
- **Component layout** — all 38 components at one flat level (`./components/<Name>.astro`); v2.0's `callouts/{academic,tools}/` subdirectories removed. Profile categorization moves from import paths to doc prose.
- **`Base.astro`** — no longer hard-imports KaTeX CSS; that's now profile-conditional via the Integration. Islands imported via package path (not relative) so the exports map routes to compiled `.mjs`.
- **Demo workspace** — root `src/` becomes `demo/src/`; root `astro.config.mjs` etc. reduce to consumer-shaped 2-line configs. Demo serves as the in-repo smoke target and reference scaffold.

### Reference consumers

- [`post_transformers/guides/web`](https://post-transformers-guide.brandon-m-behring.workers.dev) (academic, 6 chapters) → 12 pages, 9 MB dist.
- [`book-template-astro`](https://github.com/brandon-behring/book-template-astro) — *Agentic Coding* (tools, 23 chapters) → 29 pages, 3.3 MB dist.

Both consumers migrated on `v3-migration` branches; merge to main after Cloudflare deploy + visual diff.

### Migration from v2.0

The v2.0 GitHub-template-clone model stays viable indefinitely via the [`v2.0.0`](https://github.com/brandon-behring/book-scaffold-astro/releases/tag/v2.0.0) tag. Existing v2.0 books migrate to v3.0 by:

1. Replace `astro.config.mjs` with the 2-line `defineBookConfig` wrapper.
2. Replace `src/content.config.ts` with the 2-line `defineBookSchemas` call (via `/schemas` subpath).
3. Add `.env` with `BOOK_PROFILE=academic|tools|minimal`.
4. Delete `src/{components,layouts,lib,styles}`, `scripts/`, plus any auto-injected pages (`/chapters`, `/print`, `/references`, `/search`, `/convergence`).
5. Update chapter MDX imports: `'../../components/X.astro'` → `'@brandon_m_behring/book-scaffold-astro/components/X.astro'` (flat per Q1).
6. `npm install` + `npm run build`.

Per master plan Phase E + G, both reference books took ~2 days each end-to-end including alpha bumps. Per-book diff: ~3500 deletions, ~300 insertions.

### Phase A planning decisions

The v3.0 architecture adds 6 design decisions (Q1–Q6) on top of v2.0's 15. See [`PACKAGE_DESIGN.md`](PACKAGE_DESIGN.md) §1 for the full ledger.

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
