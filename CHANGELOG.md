# Changelog

All notable changes to `book-scaffold-astro`. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [SemVer](https://semver.org/).

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
