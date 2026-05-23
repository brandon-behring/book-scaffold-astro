# Changelog

All notable changes to `book-scaffold-astro`. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [SemVer](https://semver.org/).

## [4.1.1] — 2026-05-23

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
