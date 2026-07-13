# Package Design — `@brandon_m_behring/book-scaffold-astro` v4

> **Status**: living v4 API contract, updated through v4.31.0.
> **Origin**: the v3.0 npm-package pivot designed on 2026-05-18; historical
> branch `v3.0` forked `main`@`529205b` (`v2.0.0`).
> **Master plan**: `~/.claude/plans/i-want-to-investigate-recursive-yao.md` (12 D-decisions).
> **Phase A plan**: `~/.claude/plans/1-cd-claude-book-scaffold-astro-polymorphic-kernighan.md` (6 Q-decisions + spike outcome).
> **POC**: `~/.claude/plans/poc-archive/v3-poc-outcome.md` (Outcome A, cross-package `.astro` + Zod + style auto-injection all verified).

## Audience

This doc speaks to **two readers**:

1. **Phase B implementer** (future-Brandon-or-Claude) — concrete spec to translate into code. No "TBD"s.
2. **Consumers** (authors of `post_transformers`, `book-template-astro`, `double_ml_time_series`, future books, external users) — canonical API reference; the document against which they file feedback issues when behavior diverges from documentation. Mirrors the pattern proven with `runpod-deploy` and `evaltool-kit`: high-quality docs enable consumer feedback loops, which compound API quality over many books.

Every API section includes signature + behavior + error cases + at least one copy-pasteable consumer example.

## Contents

1. [Decisions ledger (D1–D12, Q1–Q6)](#1-decisions-ledger)
2. [Repo layout](#2-repo-layout)
3. [`package/package.json#exports` map](#3-exports-map)
4. [`defineBookConfig` API](#4-definebookconfig-api)
5. [`defineBookSchemas` API](#5-definebookschemas-api)
6. [`bookScaffoldIntegration` — the dual-purpose Integration](#6-bookscaffoldintegration)
7. [`peerDependencies` and what ships bundled](#7-peerdependencies)
8. [`book-scaffold` CLI](#8-book-scaffold-cli)
9. [Consumer config snippets](#9-consumer-config-snippets)
10. [MDX import patterns for chapter authors](#10-mdx-import-patterns)
11. [TypeScript story](#11-typescript-story)
12. [Style distribution mechanism (RESOLVED)](#12-style-distribution)
13. [Pre-publish verification recipe](#13-pre-publish-verification)
14. [Files inherited from v2.0](#14-files-inherited)
15. [Open questions deferred to Phase B](#15-open-questions)
16. [Consumer feedback channel](#16-consumer-feedback-channel)

---

## 1. Decisions ledger

**Master plan (D1–D12)** — rationale in `~/.claude/plans/i-want-to-investigate-recursive-yao.md`:

| ID | Decision |
|---|---|
| D1 | v2.1 polish scope lands inside v3.0 package code; not separately released |
| D2 | Labels: per-chapter counter + per-type display (`Theorem 4.1`); optional `label` prop overrides |
| D3 | XRef strictness: validator-only (component keeps silent-degrade for dev ergonomics) |
| D4 | Test framework: `node:test` built-in (zero new deps) |
| D5 | Package boundary: thin consumer (package owns components, scripts, styles, default pages, recipes, KaTeX macros) |
| D6 | Registry: public npm `@brandon_m_behring/book-scaffold-astro` |
| D7 | Bootstrap UX: sibling CLI `npx @brandon_m_behring/create-book <name> --profile=…` |
| D8 | Migration sequence: design → alpha → dogfood `post_transformers` → cut 3.0.0 → migrate remaining books |
| D9 | Phase 0 spike before Phase B (DONE — Outcome A) |
| D10 | Profile surfaces live in main package; conditional mounting |
| D11 | Monorepo with npm workspaces — `package/` + `create-book/` + `demo/` |
| D12 | Lock-step versioning: toolkit and CLI always ship at the same version |

**Phase A planning (Q1–Q6)** — rationale in `~/.claude/plans/1-cd-claude-book-scaffold-astro-polymorphic-kernighan.md`:

| ID | Decision |
|---|---|
| Q1 | Component path layout: **flat** for individually exported components (`./components/<Name>.astro`); the composed demo kit is grouped behind `./demo`, with no profile nesting |
| Q2 | Default pages: **Astro Integration auto-injects** via `injectRoute`; consumer overrides by creating own `src/pages/<route>.astro` |
| Q3 | Style scoping: **profile-conditional** — 6 always-on + 2 tools-only; `extraStyles` array escape hatch |
| Q4 | Bin CLI: **single dispatcher** `book-scaffold <sub>` |
| Q5 | Schema extensibility: **closed** — `defineBookSchemas` returns fixed set; consumer extends via JS spread + Zod `.extend()` |
| Q6 | TypeScript: **TS source + tsup** — author `src/*.ts`; `dist/*.{mjs,d.ts}` generated at publish |

---

## 2. Repo layout

D11 monorepo. Three workspaces, root coordinates.

```
book-scaffold-astro/
  package.json              # workspaces: ["package", "create-book", "demo"]
  package/                  # @brandon_m_behring/book-scaffold-astro  (this doc)
  create-book/              # @brandon_m_behring/create-book          (Phase D)
  demo/                     # in-repo Astro demo via workspace link
```

`package/` interior (Phase B builds this):

```
package/
  src/
    index.ts                # exports: defineBookConfig, defineBookSchemas, bookScaffoldIntegration, profile constants
    schemas.ts              # academic + tools Zod schemas (verbatim port of v2.0 src/content.config.ts)
    integration.ts          # bookScaffoldIntegration (route + style injection)
    config.ts               # defineBookConfig
    lib/
      katex-macros.ts       # ported verbatim from v2.0
  dist/                     # generated by tsup at publish time; NOT committed
    index.mjs
    index.d.ts
    demo.mjs                # opt-in interactive-demo barrel (#143)
    demo.d.ts
    lib/...
  components/               # 70 public .astro/.tsx entry files (Q1 flat)
    demo/                    # DemoFrame, Slider, StatCards, useThemeColors
  styles/                   # 13 .css files
    demo.css                # explicitly imported; never profile-loaded
  layouts/
    Base.astro
    Chapter.astro
  scripts/
    validate.mjs
    build-labels.mjs        # NEW Phase C
    build-bib.mjs
    build-figures.mjs
    render-notebooks.mjs
  bin/
    book-scaffold.mjs       # single dispatcher (Q4)
  recipes/                  # 11 recipes + Phase C adds 11-cross-references.md
  pedagogy/
  examples/
  tsup.config.mjs
  package.json
  CLAUDE.md
  AGENTS.md
  README.md
```

---

## 3. Exports map

`package/package.json#exports` uses explicit entries rather than an untested glob. The manifest is the count/source of truth; compiled Preact islands and the demo barrel pair runtime imports with declarations.

```jsonc
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs"
    },

    "./components/ChapterHeader.astro":   "./components/ChapterHeader.astro",
    "./components/ChapterNav.astro":      "./components/ChapterNav.astro",
    "./components/ChapterTOC.astro":      "./components/ChapterTOC.astro",
    "./components/Citation.astro":        "./components/Citation.astro",
    "./components/Cite.astro":            "./components/Cite.astro",
    "./components/CodeBlock.astro":       "./components/CodeBlock.astro",
    "./components/CodeRef.astro":         "./components/CodeRef.astro",
    "./components/Figure.astro":          "./components/Figure.astro",
    "./components/MarginNote.astro":      "./components/MarginNote.astro",
    "./components/PatternTimeline.astro": "./components/PatternTimeline.astro",
    "./components/Sidebar.astro":         "./components/Sidebar.astro",
    "./components/Sidenote.astro":        "./components/Sidenote.astro",
    "./components/SourceArchive.astro":   "./components/SourceArchive.astro",
    "./components/StatusBadge.astro":     "./components/StatusBadge.astro",
    "./components/Tag.astro":             "./components/Tag.astro",
    "./components/Theorem.astro":         "./components/Theorem.astro",
    "./components/ToolFilter":            "./components/ToolFilter.tsx",
    "./components/VersionSelector":       "./components/VersionSelector.tsx",
    "./components/WeekRef.astro":         "./components/WeekRef.astro",
    "./components/XRef.astro":            "./components/XRef.astro",

    "./demo": {
      "types": "./dist/demo.d.ts",
      "import": "./dist/demo.mjs"
    },

    "./components/CaseStudy.astro":     "./components/CaseStudy.astro",
    "./components/ConceptBox.astro":    "./components/ConceptBox.astro",
    "./components/Convergence.astro":   "./components/Convergence.astro",
    "./components/CounterBox.astro":    "./components/CounterBox.astro",
    "./components/Divergence.astro":    "./components/Divergence.astro",
    "./components/DynConnect.astro":    "./components/DynConnect.astro",
    "./components/ExampleBox.astro":    "./components/ExampleBox.astro",
    "./components/InsightBox.astro":    "./components/InsightBox.astro",
    "./components/KeyIdea.astro":       "./components/KeyIdea.astro",
    "./components/NoteBox.astro":       "./components/NoteBox.astro",
    "./components/OpenQuestion.astro":  "./components/OpenQuestion.astro",
    "./components/PaperBox.astro":      "./components/PaperBox.astro",
    "./components/Recovery.astro":      "./components/Recovery.astro",
    "./components/ResultBox.astro":     "./components/ResultBox.astro",
    "./components/SkillBox.astro":      "./components/SkillBox.astro",
    "./components/TipBox.astro":        "./components/TipBox.astro",
    "./components/TryThis.astro":       "./components/TryThis.astro",
    "./components/WarnBox.astro":       "./components/WarnBox.astro",

    "./styles/tokens.css":       "./styles/tokens.css",
    "./styles/layout.css":       "./styles/layout.css",
    "./styles/callouts.css":     "./styles/callouts.css",
    "./styles/chapter.css":      "./styles/chapter.css",
    "./styles/typography.css":   "./styles/typography.css",
    "./styles/print.css":        "./styles/print.css",
    "./styles/convergence.css":  "./styles/convergence.css",
    "./styles/tool-filter.css":  "./styles/tool-filter.css",
    "./styles/demo.css":         "./styles/demo.css",

    "./layouts/Base.astro":    "./layouts/Base.astro",
    "./layouts/Chapter.astro": "./layouts/Chapter.astro",

    "./lib": {
      "types": "./dist/lib/index.d.ts",
      "import": "./dist/lib/index.mjs"
    }
  },
  "files": [
    "dist",
    "components",
    "styles",
    "layouts",
    "scripts",
    "bin",
    "recipes",
    "pedagogy",
    "examples",
    "CLAUDE.md",
    "AGENTS.md",
    "README.md"
  ]
}
```

**Notes:**

- Q1 flat: no `callouts/{academic,tools}/` nesting; profile relevance is doc prose (§10), not path structure.
- No `./pages/*` entries (Q2 Integration auto-injects routes; consumer can override by creating own `src/pages/<route>.astro` which Astro precedence handles).
- `.tsx` islands (`ToolFilter`, `VersionSelector`) omit the `.tsx` suffix from the exports key (Astro/Vite resolves component-extension by content).
- The demo substrate is grouped behind `./demo` because its shell, controls, and theme hook are composed together. Its CSS remains a separate explicit import; no profile mounts or styles demos automatically.

---

## 4. `defineBookConfig` API (v4.0.0)

Wraps Astro's `defineConfig`; composes a Style chain, threads the resolved profile, registers the dual-purpose Integration, and applies profile-conditional KaTeX wiring.

**v4.0.0 BREAKING CHANGE**: the v3.x `preset:` / `profile:` shorthand was removed. Pass styles via `styles: [<presetName>Style]` instead. See [`MIGRATION-v3-to-v4.md`](package/MIGRATION-v3-to-v4.md) for the migration recipe and [`recipes/15-defining-styles.md`](package/recipes/15-defining-styles.md) for the Style composition pattern.

**v5.0.0 BREAKING CHANGES**: a valid preset must resolve explicitly and the
inert `deploy` configuration field is removed. See
[`MIGRATION-v4-to-v5.md`](package/MIGRATION-v4-to-v5.md).

### Signature

```ts
import type { AstroUserConfig, AstroIntegration } from 'astro';
import type { Style, PartialRouteToggles } from '@brandon_m_behring/book-scaffold-astro';

export type BookPreset = 'academic' | 'tools' | 'minimal' | 'course-notes' | 'research-portfolio';

export interface SiblingBookDescriptor {
  /** Deployment base, including an optional path prefix. */
  url: string;
  /** Vendored labels.json path, relative to the consumer project root. */
  labels?: string;
}

export type SiblingBooks = Record<string, string | SiblingBookDescriptor>;

export interface BookConfigOptions extends Omit<AstroUserConfig, 'integrations' | 'markdown'> {
  /** v4.0.0 NEW: array of Style objects composed left-to-right.
   *  Each style's fields are merged per the per-key strategy table (see §4a). */
  styles?: readonly Style[];

  /** Optional. Book's deployed origin. Required at runtime — supply here OR in a Style. */
  site?: string;

  /** Optional. Cross-profile route opt-ins (chapters / convergence / frontmatter).
   *  frontmatter is widened to `boolean | { enabled, prefix? }` for #49. */
  routes?: PartialRouteToggles;

  /** Optional. Consumer-supplied KaTeX macros merged on top of ssmMacros (#22). */
  katexMacros?: Readonly<Record<string, string>>;

  /** Optional. Cross-profile CSS escape hatch. Basenames only. Array concat. */
  extraStyles?: readonly string[];

  /** Optional. Astro integrations appended after the package list. Array concat. */
  extraIntegrations?: readonly AstroIntegration[];

  /** Optional. Override mdx components module path. */
  mdxComponentsModule?: string;

  /** Optional. Spread-merged into package-provided markdown config (plugin arrays concat). */
  markdown?: AstroUserConfig['markdown'];

  /** Optional. Build-time Cloudflare `_headers` policy (#188). Omit to emit
   *  audited defaults; false emits no scaffold file; an object replaces only
   *  the CSP. A consumer public/_headers file always wins unchanged. */
  securityHeaders?: false | {
    contentSecurityPolicy?: string;
  };

  /** Cross-book registry (#96/#147). URL strings are runtime-compatible;
   *  descriptors let validate check literal path/fragment targets against a
   *  vendored sibling labels index. */
  siblingBooks?: SiblingBooks;

  /** Base-relative chapter route tokens; build-labels and nav share this resolver. */
  chapterRoute?: string;
  /** Frontmatter field supplying :book and :slug route-token context. */
  bookField?: string;

}

export function defineBookConfig(opts: BookConfigOptions): Promise<AstroUserConfig>;
```

### Behavior

1. Detect v3 API usage (`preset` or `profile` at top level) → throw `BookConfigError` with auto-suggested replacement: exact `styles: [<presetName>Style]` line + missing import, plus link to MIGRATION-v3-to-v4.md.
2. Compose the Style chain via `composeStyles(opts.styles ?? [])`, applying the per-key merge strategy (see §4a).
3. Apply top-level `opts` fields on top of composed style (consumer per-book override wins).
4. Resolve a required `preset` from the composed Style, corpus manifest,
   environment, or `.env`; throw `BookConfigError` if absent or unknown.
5. Require `site` to be set after composition; throw otherwise.
6. Build the package's integration list: `[mdx(), preact(), bookScaffoldIntegration({ preset, routes, extraStyles, mdxComponentsModule, securityHeaders })]`.
7. Thread `securityHeaders`, `siblingBooks`, `chapterRoute`, and `bookField` to the integration without forwarding them to Astro's own config. Security-header omission means defaults, `false` means no scaffold emission, and `{ contentSecurityPolicy }` replaces only the default CSP. Non-enumerable resolved metadata exposes the evaluated sibling registry and chapter-route contract to CLI tooling, avoiding source-text parsing of computed/spread config.
8. If `PROFILES[preset]?.katex === true` (academic + research-portfolio), dynamically import `remark-math`, `rehype-katex`, and `ssmMacros`; merge `katexMacros` on top; append to `markdown.remarkPlugins` / `markdown.rehypePlugins`.
9. Concatenate `extraIntegrations` after the package list.
10. Spread-merge `opts.markdown` over package markdown config (plugin arrays concat).
11. Return final `AstroUserConfig` via Astro's `defineConfig`.

### Errors / common mistakes

- **`BookConfigError: v3 API detected. Replace this: ... With this: ...`** — passed `preset:` or `profile:` at top level. The error includes the exact replacement code. See MIGRATION-v3-to-v4.md.
- **`BookConfigError: no book preset was resolved`** — add a built-in Style,
  pass the same explicit preset to `defineBookSchemas`, share a corpus manifest,
  or set `BOOK_PRESET`.
- **`BookConfigError: v5 removed ... { deploy }`** — delete the inert field
  and configure `wrangler.toml` or the deployment platform directly. See
  MIGRATION-v4-to-v5.md.
- **`BookConfigError: site is required`** — neither top-level `site` nor any composed Style provided one. Add `site: 'https://...'` to the call or to a shared Style.
- **`BookConfigError: unknown preset "X"`** — composed Style's `preset` field is invalid. Use one of the 5 built-in styles or `defineStyle({ preset: 'academic', ... })`.
- **Consumer adds remark/rehype plugin via `markdown.remarkPlugins`**: package list ordering matters; consumer plugins run **after** package's KaTeX plugins. If you need a different order, choose a non-katex preset (e.g., `toolsStyle`) and wire math manually.

### Consumer examples

```js
// astro.config.mjs (academic book, minimum case — 3 lines)
import { defineBookConfig, academicStyle } from '@brandon_m_behring/book-scaffold-astro';
export default await defineBookConfig({
  styles: [academicStyle],
  site: 'https://my-book.example.com',
});
```

```js
// astro.config.mjs (cross-profile additions + sitemap)
import { defineBookConfig, academicStyle } from '@brandon_m_behring/book-scaffold-astro';
import sitemap from '@astrojs/sitemap';

export default await defineBookConfig({
  styles: [academicStyle],
  site: 'https://my-book.example.com',
  extraIntegrations: [sitemap()],
  extraStyles: ['convergence.css'],   // academic book that uses <Convergence>
  katexMacros: { '\\Var': '\\mathrm{Var}' },
});
```

```js
// astro.config.mjs (workspace pattern: shared style + per-book override)
import { defineBookConfig, researchPortfolioStyle } from '@brandon_m_behring/book-scaffold-astro';
import { guidesFamilyStyle } from '../shared/styles/guides-family.js';

export default await defineBookConfig({
  styles: [researchPortfolioStyle, guidesFamilyStyle],
  // No per-book site; guidesFamilyStyle provides it (the workspace shares one domain).
});
```

---

## 4a. `defineStyle` API (v4.0.0)

Identity helper that creates a typed, branded, composable Style. Zero runtime overhead beyond an object spread + version marker.

### Signature

```ts
import type { AstroIntegration, AstroUserConfig } from 'astro';

declare const StyleBrand: unique symbol;

export interface Style {
  /** Type-only brand (set by defineStyle); prevents confusion with Partial<BookConfigOptions>. */
  readonly [StyleBrand]: true;
  /** Version marker for forward compatibility; auto-set to 1 by defineStyle. */
  readonly __styleVersion: 1;

  // ===== All fields below are OPTIONAL =====
  readonly name?: string;
  readonly preset?: BookPreset;
  readonly site?: string;
  readonly routes?: PartialRouteToggles;
  readonly katexMacros?: Readonly<Record<string, string>>;
  readonly extraStyles?: readonly string[];
  readonly extraIntegrations?: readonly AstroIntegration[];
  readonly mdxComponentsModule?: string;
  readonly markdown?: AstroUserConfig['markdown'];
  /** Scoped consumer-side metadata; ignored by toolkit; survives merge as shallow override.
   *  Preserves typo protection on known fields (closed shape — no public index signature). */
  readonly extra?: Readonly<Record<string, unknown>>;
}

export type StyleInput = Omit<Style, typeof StyleBrand | '__styleVersion'>;

export function defineStyle(opts: StyleInput): Style;
```

### Behavior

Returns `{ __styleVersion: 1, ...opts }` cast to `Style`. The brand is type-only (no runtime symbol overhead). Pure; idempotent; safe to call at module scope.

### Per-key merge strategy

When `composeStyles([s1, s2, s3])` runs (left-to-right; top-level `defineBookConfig` fields win over the whole chain):

| Field | Strategy |
|---|---|
| `name`, `preset`, `site`, `mdxComponentsModule` | Shallow override (last wins) |
| `routes` | Per-route spread |
| `routes.frontmatter` | Per-route spread; later value (boolean OR object) wholly replaces earlier |
| `katexMacros` | Object spread (per-macro override) |
| `extra` | Object spread (per-key consumer-metadata override) |
| `extraStyles`, `extraIntegrations` | Array concat (additive — no dedup) |
| `markdown.remarkPlugins`, `markdown.rehypePlugins` | Array concat (additive) |
| Unknown future fields | Default: shallow override |

### Built-in styles

```ts
import {
  academicStyle, toolsStyle, minimalStyle, courseNotesStyle, researchPortfolioStyle,
  BUILTIN_STYLES,  // Record<BookPreset, Style>
} from '@brandon_m_behring/book-scaffold-astro';
```

Each built-in matches one preset. `BUILTIN_STYLES['academic']` resolves to the specific styled type via `as const satisfies Record<BookPreset, Style>` (TS 4.9+ narrow inference).

### Consumer example

```ts
// shared/styles/guides-family.ts
import { defineStyle } from '@brandon_m_behring/book-scaffold-astro';

export const guidesFamilyStyle = defineStyle({
  name: 'guides-family',
  site: 'https://guides.brandon-behring.dev/',
  routes: { frontmatter: { enabled: true, prefix: '' } },
  extra: { pedagogyTier: 'experimental' },  // typo-safe consumer metadata
});
```

See [`recipes/15-defining-styles.md`](package/recipes/15-defining-styles.md) for the full pattern catalog.

---

## 5. `defineBookSchemas` API

Returns the fixed `collections` object. Closed surface per Q5: consumer composes extensions via standard JS spread + Zod `.extend()`, not hidden merge semantics.

### Signature

```ts
import type { z } from 'astro/zod';
import type { CollectionConfig } from 'astro:content';

export interface BookSchemasOptions {
  /** Canonical (v3.7+). One of: 'academic' | 'tools' | 'minimal' | 'course-notes' | 'research-portfolio'. */
  preset?: BookPreset;
  /** Backward-compat alias for `preset` (pre-v3.7). Same precedence as defineBookConfig. */
  profile?: BookProfile;
  /** Optional. Defaults to `'./src/content/chapters'`. */
  chaptersBase?: string;
}

export interface BookCollections {
  chapters:  CollectionConfig;
  sources:   CollectionConfig;
  changelog: CollectionConfig;
  patterns:  CollectionConfig;
}

export function defineBookSchemas(opts?: BookSchemasOptions): {
  collections: BookCollections;
};
```

### Behavior

- Resolves `preset` the same way as `defineBookConfig`. `profile` is accepted as a backward-compat alias (v3.7 → v4.x deprecation window).
- Returns `{ collections: { chapters, sources, changelog, patterns } }`:
  - `chapters` — schema dispatched by preset: `academicChapterSchema` (academic), `toolsChapterSchema` (tools/minimal), `courseNotesChapterSchema` (course-notes), or `researchPortfolioChapterSchema` (research-portfolio). Loader uses `glob({ pattern: ['**/*.{md,mdx}', '!**/_*'], base: chaptersBase })`.
  - `sources`, `changelog`, `patterns` — tools-profile collateral collections (`file()` / `glob()` loaders against `sources/manifest.yaml`, `changelog/tools/*.yaml`, `changelog/patterns.yaml`). Defined unconditionally; render no-op under non-tools presets.

Exact schema fields (verbatim from v2.0 `src/content.config.ts:83-177`, reproduced here so consumers don't need to grep package source):

```ts
// academicChapterSchema
{
  week:          z.number().int().min(1).max(99),
  part:          z.enum(['foundations','ssm-core','beyond-ssm','integration','synthesis']),
  title:         z.string().min(1),
  status:        z.enum(['implemented','chapter_only','reading_only','prose_only',
                         'code_only','scaffolded','planned']),
  roadmap_lines: z.tuple([z.number().int(), z.number().int()]).optional(),
  code_path:     z.string().optional(),
  tests_path:    z.string().optional(),
  notebook_path: z.string().optional(),
  description:   z.string().optional(),
  draft:         z.boolean().default(false),
}

// toolsChapterSchema
{
  title:          z.string().min(1),
  part:           z.number().int().min(0).max(10),
  chapter:        z.number().int().min(0).max(99),
  volatility:     z.enum(['stable-principle','architectural-pattern','feature-surface']),
  tools_compared: z.array(z.enum(['claude-code','gemini-cli','codex-cli','cross-tool'])).min(1),
  last_verified: z.date(),
  sources:        z.array(z.string()).default([]),
  description:    z.string().optional(),
  draft:          z.boolean().default(false),
  updated:        z.date().optional(),
}

// researchPortfolioChapterSchema (v3.5.0+) — hybrid academic + tools provenance.
// Two required fields; everything else optional. `status` (authoring state) and
// `freshness` (epistemic type) are ORTHOGONAL — see Recipe 13 for the distinction.
{
  // required
  title:         z.string().min(1),
  last_verified: z.date(),

  // optional — hierarchy (use whichever fits)
  slug:          z.string().optional(),
  description:   z.string().optional(),
  part:          z.union([z.number().int().min(0).max(20), z.string()]).optional(),
  week:          z.number().int().min(0).max(99).optional(),
  chapter:       z.number().int().min(0).max(99).optional(),

  // optional — authoring state vs epistemic type (DO NOT CONFLATE)
  status:    z.enum(['implemented','chapter_only','reading_only','prose_only',
                     'code_only','scaffolded','planned']).optional(),
  freshness: z.enum(['experimental-result','literature-survey',
                     'theoretical','reference']).optional(),

  // optional — provenance + inline T1-T4 sources
  volatility: z.enum(['stable-principle','architectural-pattern','feature-surface']).optional(),
  tags:       z.array(z.string()).default([]),
  sources:    z.array(z.object({
                tier:  z.enum(['T1','T2','T3','T4']),
                url:   z.string().url(),
                label: z.string().min(1),
              })).default([]),

  // optional — dates + draft
  updated: z.date().optional(),
  draft:   z.boolean().default(false),

  // optional — SEO / OpenGraph article:* (v4.6+)
  author:    z.string().optional(),
  published: z.date().optional(),
  image:     z.string().optional(),
}
```

### Errors / common mistakes

- **Astro reports `chapters → <id> data does not match collection schema`** at content-sync time (POC Test 3). Run `book-scaffold validate` for richer error context — points to specific MDX file + field.
- **Frontmatter date strings**: Zod `z.date()` accepts JS `Date` objects, which Astro frontmatter parses from ISO strings (`2026-05-18`). Quoting matters in YAML — bare `2026-5-18` is parsed but loses leading-zero invariants downstream; quote dates if uncertain.
- **Tools-collection files missing**: `sources/manifest.yaml`, `changelog/tools/*.yaml`, `changelog/patterns.yaml` are optional. When absent the collections sync as empty arrays (no errors).

### Consumer example — default (3 lines)

```ts
// src/content.config.ts
import { defineBookSchemas } from '@brandon_m_behring/book-scaffold-astro';
export const { collections } = defineBookSchemas();
```

### Consumer example — add a book-specific collection

```ts
// src/content.config.ts (interview prep book with a glossary)
import { defineBookSchemas } from '@brandon_m_behring/book-scaffold-astro';
import { defineCollection, z, file } from 'astro:content';

const { collections: base } = defineBookSchemas();

const glossary = defineCollection({
  loader: file('content/glossary.yaml'),
  schema: z.object({
    term: z.string().min(1),
    definition: z.string().min(1),
  }),
});

export const collections = { ...base, glossary };
```

### Consumer example — extend chapter frontmatter

```ts
// src/content.config.ts (academic book with extra interview_topic field)
import { defineBookSchemas } from '@brandon_m_behring/book-scaffold-astro';
import { z } from 'astro:content';

const { collections: base } = defineBookSchemas();

export const collections = {
  ...base,
  chapters: {
    ...base.chapters,
    schema: base.chapters.schema.extend({
      interview_topic: z.string().optional(),
    }),
  },
};
```

---

## 5a. Custom collections + YAML date types (v4.1.0, #61)

When consumers define their own content collections beyond the built-in `chapters` / `sources` / `changelog` / `patterns`, a YAML-date pitfall surfaces immediately. This section documents the gotcha + 2 safe patterns.

### The gotcha

A naive custom collection like:

```ts
const poc = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/poc' }),
  schema: z.object({
    title: z.string(),
    last_updated: z.string(),  // ← unsafe: see below
  }),
});
```

paired with a naive MDX frontmatter:

```yaml
---
title: "Day 1"
last_updated: 2026-05-23   # ← unquoted YYYY-MM-DD
---
```

fails at build time with:

```
Expected type 'string', received 'object'
```

Cause: YAML auto-parses unquoted `YYYY-MM-DD` to a JavaScript `Date` object, which then fails Zod's `z.string()` schema. The scaffold's built-in `chapters` schema works because it uses `z.date()` for `last_verified` (`schemas.ts:94, 146, 228, 252`).

### Pattern A (RECOMMENDED): `z.date()` in the custom schema

```ts
const poc = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/poc' }),
  schema: z.object({
    title: z.string(),
    last_updated: z.date(),   // ← accepts native YAML Date
  }),
});
```

Astro auto-parses unquoted `YYYY-MM-DD` to `Date`; `z.date()` accepts it. Matches all built-in schemas in the scaffold.

### Pattern B: quote the date in MDX frontmatter

```yaml
---
title: "Day 1"
last_updated: "2026-05-23"   # ← quoted → stays string
---
```

paired with `z.string()` in the schema works because the quotes prevent YAML auto-parsing. Adopt this only when the field is genuinely a free-form identifier rather than a date you'll compute on.

### Anti-pattern: `z.string()` for date-shaped fields

If the field semantically IS a date, use `z.date()` and let Astro do the parsing. Reserve `z.string()` for fields where the value is not date-shaped (slug, kind, tag identifier).

### Helper export

A `zodDateString` helper that coerces both shapes is intentionally **not** exported in v4.1.0. One consumer hit the gotcha; docs solve it. If a second consumer asks, the helper joins the API surface in v4.2.0 — file an issue at https://github.com/brandon-behring/book-scaffold-astro/issues with the `consumer:<workspace>` label.

---

## 6. `bookScaffoldIntegration`

The single Astro Integration that does both **route injection** (Q2) and **style injection** (Q3). Phase A.5 spike confirmed Option α (Integration + `injectScript`) works cleanly cross-package; see `~/.claude/plans/poc-archive/v3-poc-outcome.md` "Phase A.5 follow-up spike".

### Signature

```ts
import type { AstroIntegration } from 'astro';

export interface BookScaffoldIntegrationOptions {
  profile: BookProfile;
  extraStyles?: string[];
  securityHeaders?: false | {
    contentSecurityPolicy?: string;
  };
}

export function bookScaffoldIntegration(
  opts: BookScaffoldIntegrationOptions
): AstroIntegration;
```

Normally registered by `defineBookConfig`. Consumers do **not** call this directly.

### Behavior — `astro:config:setup` hook

Pseudocode:

```ts
const alwaysOnStyles = [
  'tokens.css', 'layout.css', 'callouts.css',
  'chapter.css', 'typography.css', 'print.css',
];
const toolsOnlyStyles = ['convergence.css', 'tool-filter.css'];

const styles = profile === 'tools'
  ? [...alwaysOnStyles, ...toolsOnlyStyles, ...(extraStyles ?? [])]
  : [...alwaysOnStyles, ...(extraStyles ?? [])];

// 1. Style injection (Option α — verified by spike)
for (const sheet of styles) {
  injectScript(
    'page-ssr',
    `import '@brandon_m_behring/book-scaffold-astro/styles/${sheet}';`
  );
}

// 2. Route injection (profile-conditional per D10)
const defaultRoutes: Array<[string, string]> = [
  ['/chapters',   'package/pages/chapters.astro'],
  ['/references', 'package/pages/references.astro'],
  ['/print',      'package/pages/print.astro'],
  ['/search',     'package/pages/search.astro'],
];
if (profile === 'tools') {
  defaultRoutes.push(['/convergence', 'package/pages/convergence.astro']);
}

for (const [pattern, entrypoint] of defaultRoutes) {
  injectRoute({ pattern, entrypoint });
}
```

### Behavior — `astro:build:done` hook

The integration writes a Cloudflare-compatible `dist/_headers` file after
every successful Astro build. The default policy applies HSTS,
`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and a CSP
that permits the toolkit's inline theme/drawer code, Astro's inline component
styles, Pagefind WebAssembly, Cloudflare Web Analytics, and images from
`'self'`, `data:`, or `https:` sources.

`securityHeaders: false` suppresses scaffold emission. Passing
`securityHeaders: { contentSecurityPolicy: "..." }` substitutes the complete
CSP value while retaining the other four defaults. If Astro has already
copied a consumer-owned `public/_headers` into the output, the integration
does not write or merge anything; that file wins byte-for-byte.

### Override semantics

Astro user routes win over `injectRoute`d routes (standard Astro precedence). To override `/chapters`, the consumer just creates `src/pages/chapters.astro`. No package opt-out needed.

Security headers use whole-file precedence rather than route precedence:
create `public/_headers` to own every rule, use `securityHeaders: false` when
the deployment platform or another integration owns them, or provide only a
replacement CSP through `securityHeaders.contentSecurityPolicy`.

### Errors / common mistakes

- **CSS missing from build output**: most often a typo in `extraStyles`. The basename must match a file shipped by the package (see §3 exports map under `./styles/*`).
- **Default route doesn't render** under academic profile: `/convergence` is tools-only. To enable in an academic book, override by creating your own `src/pages/convergence.astro` that imports tools components.

### Spike evidence

```
$ grep -r 'v3-poc-sentinel' dist/
dist/test/index.html:<!DOCTYPE html>...<head>...<style>:root{--v3-poc-sentinel: probe-value}
```

Single-rule sheet inlines; multi-rule sheets emit a linked `<style>` block. Either way the rules land in the consumer's `<head>` with zero CSS imports in `astro.config.mjs`.

---

## 7. `peerDependencies`

What consumers must install themselves; what the package ships bundled.

```jsonc
{
  "peerDependencies": {
    "astro":             "^6.1.7",
    "@astrojs/mdx":      "^5.0.3",
    "@astrojs/preact":   "^5.1.1",
    "preact":            "^10.29.1"
  },
  "peerDependenciesMeta": {
    "katex":         { "optional": true },
    "rehype-katex":  { "optional": true },
    "remark-math":   { "optional": true }
  },
  "dependencies": {
    "@astrojs/markdown-remark":  "^7.1.2",
    "@citation-js/core":         "^0.7.21",
    "@citation-js/plugin-bibtex": "^0.7.21",
    "@fontsource-variable/roboto":           "^5.2.10",
    "@fontsource-variable/source-code-pro":  "^5.2.7",
    "pagefind":                   "^1.5.2"
  },
  "devDependencies": {
    "tsup":          "^8.x",
    "typescript":    "^5.x",
    "@types/node":   "^22.x"
  }
}
```

**Rationale:**

- **Peers (required)**: Astro 6, MDX, Preact, and `preact` package proper. Consumers import these in their own code (e.g., to extend integrations). Bundling them would cause version mismatches.
- **Peers (optional)**: KaTeX trio. Only academic profile needs them; `npm install --no-optional` skips them; consumer install fails loudly if `BOOK_PROFILE=academic` but KaTeX missing.
- **Bundled deps**: Astro's Markdown processor (used by `book-scaffold build-labels` so heading text/slug behavior matches Astro), citation-js (used by `book-scaffold build-bib`), fonts (CSS-imported by `tokens.css`), and Pagefind (used at build time for search index). These are package-internal; consumers should never import them directly.
- **Dev deps**: `tsup` for compiling `src/*.ts` → `dist/*.{mjs,d.ts}`. Not installed by consumers.

**Optional system dependencies** (NOT npm packages — install via OS package manager):

- `pdftocairo` + `pdftoppm` (poppler-utils) — used by `book-scaffold build-figures` to convert PDF figures to SVG. Without them, `build-figures` warns and serves committed SVGs/PNGs as-is. Install: `brew install poppler` (macOS) / `apt-get install poppler-utils` (Debian/Ubuntu).
- `pdflatex` (TeX Live) — v4.2.0+ adds TikZ standalone `.tex` → `.pdf` → `.svg` compilation. Only needed if you author figures as TikZ sources (not for pre-built PDF figures). Install: `brew install --cask basictex` (macOS) / `apt-get install texlive-base texlive-pictures` (Debian/Ubuntu). See `recipes/16-tikz-figures.md`.

---

## 8. `book-scaffold` CLI

Single bin entry, sub-command dispatcher (Q4). Mirrors `git`, `wrangler`, `gh`.

```jsonc
// package/package.json
{
  "bin": { "book-scaffold": "./bin/book-scaffold.mjs" }
}
```

### Sub-commands

| Command | Action | Source |
|---|---|---|
| `book-scaffold validate` | Pre-flight content validator | `scripts/validate.mjs` (port of v2.0) |
| `book-scaffold build-labels` | Emit `src/data/labels.json` for `<XRef>` / `<Theorem>` component IDs and `<BookLink>` h2–h6 anchors | `scripts/build-labels.mjs` (**Phase C**) |
| `book-scaffold build-bib` | BibTeX → CSL JSON | `scripts/build-bib.mjs` (port of v2.0) |
| `book-scaffold build-figures` | PDF → SVG via pdftocairo with PNG fallback; v4.2.0+ also auto-compiles TikZ standalone `.tex` → `.pdf` via pdflatex first (see [recipe 16](package/recipes/16-tikz-figures.md)) | `scripts/build-figures.mjs` |
| `book-scaffold render-notebooks` | ipynb → HTML via Jupyter nbconvert | `scripts/render-notebooks.mjs` (port of v2.0) |
| `book-scaffold --help` | List sub-commands + brief usage | dispatcher |
| `book-scaffold --version` | Print package version | dispatcher |

### Dispatcher implementation (target)

```js
// package/bin/book-scaffold.mjs (~30 lines, no external CLI lib)
#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const handlers = {
  validate:           '../scripts/validate.mjs',
  'build-labels':     '../scripts/build-labels.mjs',
  'build-bib':        '../scripts/build-bib.mjs',
  'build-figures':    '../scripts/build-figures.mjs',
  'render-notebooks': '../scripts/render-notebooks.mjs',
};

const [, , sub, ...rest] = process.argv;

if (!sub || sub === '--help' || sub === '-h') {
  console.log('Usage: book-scaffold <sub>\n  sub: validate | build-labels | build-bib | build-figures | render-notebooks');
  process.exit(sub ? 0 : 1);
}
if (sub === '--version' || sub === '-v') {
  const pkg = await import('../package.json', { with: { type: 'json' } });
  console.log(pkg.default.version); process.exit(0);
}
if (!(sub in handlers)) {
  console.error(`Unknown sub-command: ${sub}`); process.exit(2);
}

const here = path.dirname(fileURLToPath(import.meta.url));
process.argv = [process.argv[0], path.resolve(here, handlers[sub]), ...rest];
await import(path.resolve(here, handlers[sub]));
```

### Consumer `package.json` scripts

```jsonc
{
  "scripts": {
    "prebuild":       "npm run build:assets && npm run validate",
    "predev":         "npm run build:assets",
    "build:assets":   "npm run build:bib && npm run build:labels && npm run build:figures && npm run build:notebooks",
    "build:bib":      "book-scaffold build-bib",
    "build:labels":   "book-scaffold build-labels",
    "build:figures":  "book-scaffold build-figures",
    "build:notebooks":"book-scaffold render-notebooks",
    "validate":       "book-scaffold validate",
    "dev":            "astro dev",
    "build":          "astro build && pagefind --site dist"
  }
}
```

### Errors / common mistakes

- **`book-scaffold: command not found`** — package not installed locally, or `node_modules/.bin/` not on PATH. Run from package.json scripts (npm puts `.bin` on PATH for you) or use `npx book-scaffold validate`.
- **Sub-command exits with code 2** = unknown sub-command (typo).
- **`build-figures` skips silently** when `pdftocairo` and `pdftoppm` are both unavailable (Cloudflare build container case). Committed SVGs are used instead. Not a bug.

### Preset + chaptersBase resolution (v4.7.0+, closes #75)

`validate` and `build-labels` resolve both the active **preset** and the **chapters base directory** by consulting multiple sources in this order. The first source that yields a value wins:

**Preset chain** (`validate` only — `build-labels` does not currently use preset):

1. `--preset <name>` CLI flag
2. `BOOK_PRESET` env var
3. `BOOK_PROFILE` env var (backward-compat alias)
4. `.env` file `BOOK_PRESET`
5. `.env` file `BOOK_PROFILE`
6. `defineBookSchemas({ preset })` in `src/content.config.{ts,mjs,js}`
7. `defineBookSchemas({ profile })` in `src/content.config.ts` (alias)

If all seven sources are absent, v5 exits with an actionable configuration
error. It never selects `minimal` implicitly.

**chaptersBase chain** (both `validate` and `build-labels`):

1. `BOOK_CHAPTERS_DIR` env var
2. Raw Astro form: `chapters: defineCollection({ loader: glob({ base: '...' }) })` in `content.config.*`
3. v4.5+ form: `defineBookSchemas({ chaptersBase: '...' })` in `content.config.*`
4. `'./src/content/chapters'` default

Both chains parse the consumer's config file via regex (string literals only — template literals and dynamic expressions fall back to the next source). The helpers are exported from `package/scripts/walk-mdx.mjs`:

```js
import { readChaptersBase, readBookSchemaConfig } from '@brandon_m_behring/book-scaffold-astro/...';
// readBookSchemaConfig(projectRoot) → { preset, chaptersBase }  (both nullable)
// readChaptersBase(projectRoot)     → string (always returns a resolved abs path)
```

Separately, `validate` and `build-labels` evaluate the consumer's real Astro
config through Vite and read the scaffold integration's non-enumerable metadata.
This supplies composed/computed `numberStyle` and `siblingBooks` values, plus
`chapterRoute` and `bookField`. `build-labels` feeds each nested content entry
through the same `chapterHref` resolver used by navigation and indexes Astro's
h2–h6 GitHub-style heading slugs (including duplicate suffixes). Heading keys
are opaque/path-qualified and sibling validation resolves exact href values, so
the same fragment in multiple chapters is lossless. The legacy defaults remain
shared numbering and `/chapters/:id/`, and component ID keys are unchanged.

**Astro base resolution (#190).** `validate` separately evaluates the actual
`astro.config.*` through Vite and reads `config.base` via
`scripts/resolve-book-config.mjs`; this works with computed configuration and
does not require the scaffold integration to be present. Omission resolves to
`/`. Under a non-root base, literal authored Markdown/HTML/JSX `href` and `src`
targets that start at the host root but fall outside the base are errors. The
validator uses structural Markdown/MDX/HTML parsing, evaluates decoded static
string literals, and suggests a browser-normalized contained target. It never
rewrites content and adds no configuration or `rel=` opt-out.

---

## 9. Consumer config snippets

The complete consumer-side config for an academic book using v3.0:

`astro.config.mjs` (2 lines):

```js
import { defineBookConfig } from '@brandon_m_behring/book-scaffold-astro';
export default defineBookConfig({ site: 'https://my-book.example.com' });
```

`src/content.config.ts` (2 lines):

```ts
import { defineBookSchemas } from '@brandon_m_behring/book-scaffold-astro';
export const { collections } = defineBookSchemas();
```

`.env`:

```
BOOK_PROFILE=academic
BOOK_TITLE=My Book
```

`package.json` (excerpt — full template in `create-book/templates/`):

```jsonc
{
  "name": "my-book",
  "type": "module",
  "dependencies": {
    "@brandon_m_behring/book-scaffold-astro": "^3.0.0",
    "astro": "^6.1.7",
    "@astrojs/mdx": "^5.0.3",
    "@astrojs/preact": "^5.1.1",
    "preact": "^10.29.1",
    "katex": "^0.16.11",
    "rehype-katex": "^7.0.1",
    "remark-math": "^6.0.0"
  },
  "scripts": { /* see §8 */ }
}
```

`wrangler.toml`, `bibliography.bib`, `src/content/chapters/*.mdx` — book-specific content the consumer owns.

---

## 10. MDX import patterns

Chapter authors import components from the package at one flat level (Q1):

```mdx
---
week: 1
part: foundations
title: Hello world
status: implemented
---
import Theorem  from '@brandon_m_behring/book-scaffold-astro/components/Theorem.astro';
import Cite     from '@brandon_m_behring/book-scaffold-astro/components/Cite.astro';
import XRef     from '@brandon_m_behring/book-scaffold-astro/components/XRef.astro';
import Figure   from '@brandon_m_behring/book-scaffold-astro/components/Figure.astro';
import NoteBox  from '@brandon_m_behring/book-scaffold-astro/components/NoteBox.astro';

# Chapter 1 — Hello world

<NoteBox title="Welcome">
  All callouts ship at one path level; profile relevance is documented below, not in the import path.
</NoteBox>

<Theorem id="w1:thm:hello" type="theorem">
  For any greeting $g \in G$, $\exists\, r \in R$ such that $r$ responds.
</Theorem>

See <XRef id="w1:thm:hello" /> and <Cite key="example-key2024" />.
```

### Component → profile mapping (doc prose, not path structure)

| Profile relevance | Components |
|---|---|
| Always available | Cite, XRef, Figure, MarginNote, Sidenote, CodeBlock, CodeRef, Theorem, Tag, WeekRef, ChapterHeader, ChapterNav, ChapterTOC, Sidebar, Citation, StatusBadge |
| Academic-flavored callouts | NoteBox, ExampleBox, DynConnect, InsightBox, WarnBox, CounterBox, TipBox, OpenQuestion, PaperBox, ResultBox |
| Tools-flavored callouts | SkillBox, KeyIdea, Convergence, Divergence, CaseStudy, ConceptBox, TryThis, Recovery |
| Tools-oriented components | ToolFilter, PatternTimeline, SourceArchive; VersionSelector (manual prop-driven opt-in) |
| Research-portfolio primitives (v3.5.0) | PreReleaseBanner, PolicyRef, AICollaborationDisclosure, BlockedByCallout |
| Opt-in interactive demos (#143) | `DemoFrame`, `Slider`, `StatCards`, `useThemeColors` from the `/demo` barrel |

Mixing across categories is allowed — see `defineBookConfig({ extraStyles: ['convergence.css'] })` for the cross-profile escape hatch (§4).

Interactive demos are authored as consumer-owned Preact islands, then hydrated
from Astro with `client:visible` or another appropriate directive. Import
`styles/demo.css` on that page. The public substrate deliberately excludes
domain kernels, chart primitives, and demo-data loaders; Recipe 23 is the
canonical composition and accessibility reference.

### Component prop reference (v3.5.0+)

Prop tables for components added in v3.5.0. The Props interface lives in each component's `.astro` file under `package/components/`. Source of truth is the file; this table is a quick lookup.

#### `VersionSelector`

An opt-in Preact island for books that actually publish multiple deployed
versions. `Base.astro` does not mount it. The consumer passes
`versions?: readonly VersionEntry[]`; an omitted or empty list renders nothing.

| Entry field | Type | Required | Description |
|---|---|---|---|
| `href` | `string` | yes | Fully resolved destination for the deployed version |
| `label` | `string` | yes | Human-readable release label |
| `date` | `string` | yes | Human-readable release date |
| `current` | `boolean` | no | Marks the version represented by the current page; otherwise the first entry is used |

#### `PreReleaseBanner`

Site-wide banner declaring the book's release state.

| Prop | Type | Required | Description |
|---|---|---|---|
| `state` | `'alpha' \| 'beta' \| 'rc' \| 'locked'` | yes | Visible release-state chip + default message text |
| `dismissAt` | `string` | no | Version tag indicating when this state expires (e.g., `'v0.7.0'`); informational, no auto-dismiss behavior |
| `message` | `string` | no | Override the default per-state message text |

Default messages per state:
- `alpha` → `"This book is in alpha — expect breaking changes and partial coverage."`
- `beta` → `"This book is in beta — most sections stable; minor changes possible."`
- `rc` → `"Release candidate — finalizing content; substantive feedback welcome."`
- `locked` → `"This release is frozen. See CHANGELOG for the next iteration."`

#### `PolicyRef`

Inline link to a repo-root policy document (`ETHICS.md`, `SECURITY.md`, `GOVERNANCE.md`, etc.).

| Prop | Type | Required | Description |
|---|---|---|---|
| `file` | `string` | yes | Filename of the policy doc at site root (e.g., `'ETHICS.md'`) |
| `section` | `string` | no | Optional section name; auto-slugified into `#anchor` appended to the href |
| `label` | `string` | no | Visible link text; defaults to `section` if present, otherwise `file` |
| `href` | `string` | no | Explicit href override (otherwise computed from `file` + `section`) |

Slot: optional inline text content overrides the computed label.

#### `AICollaborationDisclosure`

Structured AI-collaboration disclosure block.

| Prop | Type | Required | Description |
|---|---|---|---|
| `model` | `string` | yes | Model name(s) + vendor (e.g., `'Claude Opus 4.7 + Sonnet 4.6 (Anthropic)'`) |
| `role` | `string` | yes | Role description (e.g., `'research collaborator + writing collaborator'`) |
| `commit_attribution` | `string` | no | Git trailer text used in commits (e.g., `'Co-Authored-By: Claude <noreply@anthropic.com>'`) |

Slot (`default`): optional prose appended after the model/role line (e.g., `"All factual claims independently verified by …"`).

#### `BlockedByCallout`

Declare an upstream dependency that's blocking a chapter / section / experiment.

| Prop | Type | Required | Description |
|---|---|---|---|
| `upstream` | `string` | yes | Short name of the blocker (e.g., `'book-scaffold-astro v3.5.0'`) |
| `reason` | `string` | yes | Brief explanation of what the upstream provides |
| `url` | `string` | no | Tracking URL (issue, PR, paper, release notes) |
| `unblockedAt` | `string` | no | Date or version tag when the blocker was resolved (e.g., `'2026-05-19'`) |

Slot (`default`): optional prose under the structured fields — typical placement for migration notes or workaround instructions.

---

## 11. TypeScript story

Q6 — TS source, tsup compiles. Standard modern npm-package shape.

### Author side (`package/src/`)

```ts
// src/index.ts (entry; ~60 lines incl. type re-exports)
export { defineBookConfig } from './config.js';
export { defineBookSchemas } from './schemas.js';
export { bookScaffoldIntegration } from './integration.js';
export type {
  BookProfile, BookConfigOptions, BookSchemasOptions, BookCollections,
  BookScaffoldIntegrationOptions,
} from './types.js';
export {
  academicParts, chapterStatus, toolSlugs, volatilityLevels, sourceTiers,
} from './schemas.js';
```

### Build (`package/tsup.config.mjs`)

```js
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/lib/katex-macros.ts'],
  format: ['esm'],
  dts: true,
  outDir: 'dist',
  clean: true,
  splitting: false,
  sourcemap: false,
  target: 'node22',
});
```

`prepublishOnly: "npm run build"` ensures `dist/` is fresh before every publish.

### Consumer side

Consumer's `tsconfig.json` (unchanged from v2.0):

```jsonc
{
  "extends": "astro/tsconfigs/strict"
}
```

`defineBookConfig`, `defineBookSchemas`, and all profile constants are fully typed; IDE autocomplete works for `BookConfigOptions` keys (`profile`, `extraIntegrations`, `extraStyles`).

`.astro` component prop types are auto-derived by Astro's TS integration — consumers don't need to do anything.

### `.gitignore`

Add `package/dist/` (generated artifact; rebuilt on every publish).

---

## 12. Style distribution

**RESOLVED 2026-05-18** — Option α confirmed by Phase A.5 spike. See `~/.claude/plans/poc-archive/v3-poc-outcome.md` and §6 of this doc.

Mechanism: `bookScaffoldIntegration` calls `injectScript('page-ssr', "import '@brandon_m_behring/book-scaffold-astro/styles/<name>.css';")` for each resolved CSS basename in the profile's list (plus `extraStyles`). Astro's Vite resolver follows `package.json#exports` for the CSS subpaths; the rules land in the consumer's built `<head>` with zero CSS imports in `astro.config.mjs`.

The always-loaded Roboto body face remains self-hosted through Fontsource, but
its package-owned `font-display: swap` declarations are transformed to
`optional` (#187). `Base.astro` preloads the Latin variable face, so normal
connections retain Roboto while a slow cold load keeps the system fallback
instead of swapping after paint. The transform matches only Fontsource's
Roboto entry module; Source Code Pro, KaTeX, and consumer font CSS keep their
own display policies.

### Figure palette ownership (#161, #164)

`tokens.css` exposes two deliberately separate public token families:

- Warm–Tol `--fig-blue|rose|green|plum|gold|crimson` plus
  `--fig-ink|paper|grid` carry semantic meaning and may change value between
  light and dark themes.
- Okabe–Ito `--series-1..8` are stable categorical ordinals, never semantic
  good/bad roles. Series 1–7 retain their canonical chromatic values; series 8
  follows figure ink so canonical export black remains visible on dark paper.

The pure `package/src/lib/figure-palette.mjs` manifest is the sole authored
palette record. It distinguishes an export color from a rendered theme value
(notably canonical Warm–Tol gold `#C09840` versus the darker light-theme
`--fig-gold`) and records the unavoidable series-8/structural-black PDF
collision. `figure.mjs` derives exact SVG-color mappings and standalone SVG
theme defaults from that manifest. The manifest also renders the delimited
figure-token block committed in `tokens.css`; `check:figure-tokens` and the
package tests fail if that generated CSS drifts. Do not hand-edit that block.

`build-figures` maps canonical authored colors back to these variables while
leaving the original SVG attributes as fallbacks. Pale semantic fills must use
the canonical base color plus a separate opacity; pre-blended tints have lost
their role by the time PDF export produces RGB. The backward-compatible
`--diagram-ink|paper|grid` aliases remain the neutral mapping surface.

Option β (consumer side-effect imports CSS in `astro.config.mjs`) was the fallback if Option α failed. Not needed.

---

## 13. Pre-publish verification

Phase B opens its first alpha with this recipe. Runs from the `package/` workspace (`cd package/` first, or use `npm publish -w package` from the repo root).

```bash
# 1. Build the TS lib + types
npm run build              # tsup; emits dist/

# 2. See exactly what npm will publish
npm pack --dry-run         # lists every file in the tarball

# 3. Inspect the tarball (sanity check; nothing weird)
npm pack && tar -tzf brandon-behring-book-scaffold-astro-*.tgz | head -50

# 4. First alpha
npm publish --tag alpha    # @brandon_m_behring/book-scaffold-astro@3.0.0-alpha.0

# 5. Verify the registry
npm view @brandon_m_behring/book-scaffold-astro versions
```

### End-to-end smoke (run after first alpha)

```bash
# In a fresh temp dir, NOT under ~/Claude/
mkdir -p /tmp/v3-smoke && cd /tmp/v3-smoke
npm init -y
npm install astro@^6.1.7 @astrojs/mdx@^5 @astrojs/preact@^5 preact@^10
npm install @brandon_m_behring/book-scaffold-astro@alpha
npm install katex@^0.16 rehype-katex@^7 remark-math@^6   # academic only

mkdir -p src/content/chapters
echo "BOOK_PROFILE=academic" > .env
cat > astro.config.mjs <<'EOF'
import { defineBookConfig } from '@brandon_m_behring/book-scaffold-astro';
export default defineBookConfig({ site: 'https://example.invalid' });
EOF
cat > src/content.config.ts <<'EOF'
import { defineBookSchemas } from '@brandon_m_behring/book-scaffold-astro';
export const { collections } = defineBookSchemas();
EOF
cat > src/content/chapters/test.mdx <<'EOF'
---
week: 1
part: foundations
title: Smoke test
status: scaffolded
---
import NoteBox from '@brandon_m_behring/book-scaffold-astro/components/NoteBox.astro';
<NoteBox title="Hello">It builds.</NoteBox>
EOF

npx astro build
# Verify <head> contains the injected styles + the chapter renders.
```

---

## 14. Files inherited from v2.0

Phase B moves these from `src/` (the v2.0 demo project layout) into `package/` (the new npm package layout). No content changes — Phase B is mechanical relocation + import-path adjustment.

| v2.0 path | v3.0 path | Count |
|---|---|---|
| `src/components/*.astro` (top level) | `package/components/` | 18 |
| `src/components/*.tsx` | `package/components/` | 2 |
| `src/components/callouts/*.astro` | `package/components/` (flat) | 18 |
| `src/styles/*.css` | `package/styles/` | 8 |
| `src/lib/*.ts` | `package/src/lib/` (TS sources) | 6 |
| `scripts/*.mjs` | `package/scripts/` | 4 |
| `recipes/*.md` | `package/recipes/` | 11 + 1 new (Phase C) |
| `pedagogy/*.md` | `package/pedagogy/` | — |
| `examples/chapter-template-*.mdx` | `package/examples/` | 2 |
| `bibliography.bib` (empty placeholder) | `package/bibliography.bib` | 1 |
| `CLAUDE.md` | `package/CLAUDE.md` | 1 |
| `AGENTS.md` | `package/AGENTS.md` | 1 |

**Phase B also creates:**

- `package/src/{index,config,schemas,integration,types}.ts` (new TS sources)
- `package/bin/book-scaffold.mjs` (new dispatcher)
- `package/tsup.config.mjs`
- `package/package.json` with `exports` map per §3
- Root `package.json` with `workspaces: ["package", "create-book", "demo"]`
- `demo/` (relocated `src/` of current scaffold)
- `create-book/` (placeholder; populated in Phase D)

---

## 15. Open questions

Resolved by Phase A.5 spike:

- ✓ Style auto-injection across package boundary (Option α confirmed)

Phase B follow-ups (low-risk implementation details; not architecture-changing):

- Style ordering when multiple CSS files are injected (8 in the real package). If order matters for cascade, the Integration must call `injectScript` in a deterministic order; `tokens.css` first is the safe default.
- Pagefind indexing of content rendered from cross-package-imported components — likely fine since Pagefind walks the built static HTML, not the source tree.
- Paged.js PDF rendering across the package boundary — PDF generation also walks built HTML; should work.
- HMR during `astro dev` with workspace-linked package source changes — Vite generally handles workspace symlinks; verify on first dev session.
- TypeScript types crossing the `.astro` boundary — Astro's auto-derived types should propagate; verify with `astro check` after Phase B.

Open at the package-publishing level (handled at Phase B start):

- npm scope claim for `@brandon_m_behring` (free for individual users; first publish auto-creates).
- `npm whoami` returning `ENEEDAUTH` — user action: `npm adduser`.

---

## 15a. Deferred scope (post-v4.x)

The package is in its v4.x **iteration window** — small additive changes triggered by consumer signal. Anything architecturally invasive ships in v5.x or later, and only after repeated independent demand. Items deferred during the v4.x cycle:

### Multi-book corpus routing + schema (#80, accepted for v5)

The second-consumer trigger fired through `guides-ai-engineering`, alongside the
DLAI Study Notes pilot. The decision-complete public contract now lives in
[`docs/plans/active/v5-corpus-contract.md`](docs/plans/active/v5-corpus-contract.md).

The accepted direction is one app / one build / one homogeneous preset, with a
shared `defineBookCorpus` manifest, path-derived book identity, canonical
Recipe 21 URLs (`/chapters/<book>/<slug>/`), per-book indexes, book-scoped
artifacts and diagnostics, and a single Pagefind index with book filters.
Single-book behavior remains compatible; corpus behavior is opt-in. #158 and
#157 consume the corpus identity contract after the v5 core rather than
expanding the v5.0 implementation gate.

### AnkiCard component + extract-cards CLI (closed #16, deferred)

**Requested shape**: ship `<AnkiCard>` MDX component + `book-scaffold extract-cards` CLI from the DLAI pilot to the scaffold.

**Why deferred**:
- The component is feasible (one-line export, no profile coupling, ~100 LOC). The CLI is harder: it depends on #15's per-book grouping, and adds a non-trivial runtime dependency (a `.apkg` builder — Python `anki` library or a Node port).
- The scaffold's scope is "books as MDX + Astro + pluggable profiles". Deck-export sync is a workflow-specific feature, more like "export to Notion" or "sync to Roam" than infrastructure every consumer needs.
- Until DLAI proves the pattern out in production, the right home is a consumer-side recipe ([Recipe 20](package/recipes/20-anki-export.md)) describing how to roll your own `<AnkiCard>` component + a project-local `scripts/extract-anki.mjs` using `getCollection('chapters')`.

**Re-evaluate when**: a 2nd consumer asks for it. At that point, consider shipping a light `build-anki` script (scan-and-emit JSON, no `.apkg`) following the `build-tips` / `build-exercises` pattern.

---

## 16. Consumer feedback channel

Issue tracker: **https://github.com/brandon-behring/book-scaffold-astro/issues**

If something in this document doesn't match the package's actual behavior, **that's a bug worth filing**. Documentation drift is the single highest-impact failure mode for an npm package: a consumer who finds the doc unreliable stops reading it.

### Label conventions

Mirrors the [[runpod-deploy-consumer-feedback]] pattern proven across `runpod-deploy` and `evaltool-kit`:

- `consumer:<repo>` — which downstream repo hit this (e.g., `consumer:post_transformers`, `consumer:book-template-astro`).
- `kind:doc-drift` — doc and behavior diverge.
- `kind:api-friction` — API works but is awkward in practice; needs a recipe or a small surface refinement.
- `kind:bug` — straightforward broken behavior.
- `kind:enhancement` — request for new capability.

### Issue template

```
**Section**: PACKAGE_DESIGN.md §<N>
**Consumer**: <repo name>
**Package version**: <`@brandon_m_behring/book-scaffold-astro@x.y.z`>
**Astro version**: <`astro@x.y.z`>

**What the doc says**:

> <quote the relevant passage>

**What actually happened**:

<repro steps + observed behavior>

**Workaround (if any)**:

<…>
```

### Triage convention

One issue per friction point. Trivial fixes (1-line config typos, missing semicolons) can be PR'd directly without an issue.

---

*End of PACKAGE_DESIGN.md.*
