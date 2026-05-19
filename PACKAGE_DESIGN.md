# Package Design — `@brandon_m_behring/book-scaffold-astro` v3.0

> **Status**: design document for `book-scaffold-astro` v3.0 (npm package pivot).
> **Date**: 2026-05-18.
> **Branch**: `v3.0` (forks `main`@`529205b` = tag `v2.0.0`).
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
| Q1 | Component path layout: **flat** — `./components/<Name>.astro` for all 38 components, no profile nesting |
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
    lib/...
  components/               # 38 .astro/.tsx files at one level (Q1 flat)
  styles/                   # 8 .css files
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

`package/package.json#exports` — 50 entries (1 root + 38 components + 8 styles + 2 layouts + 1 lib). POC verified per-file pattern; glob untested, not used.

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

---

## 4. `defineBookConfig` API

Wraps Astro's `defineConfig`; threads the resolved profile, registers the dual-purpose Integration, and applies profile-conditional KaTeX wiring.

### Signature

```ts
import type { AstroUserConfig, AstroIntegration } from 'astro';

export type BookProfile = 'academic' | 'tools' | 'minimal';

export interface BookConfigOptions extends Omit<AstroUserConfig, 'integrations' | 'markdown'> {
  /** Required. Book's deployed origin (used by sitemap, Pagefind, canonical links). */
  site: string;
  /**
   * Optional. Falls back to `process.env.BOOK_PROFILE`, then `'minimal'`.
   * Explicit param always wins over env (locked precedence).
   */
  profile?: BookProfile;
  /** Optional. Appended to package-provided integration list. */
  extraIntegrations?: AstroIntegration[];
  /**
   * Optional. Cross-profile CSS escape hatch (Q3). Basenames only, e.g.
   * `['convergence.css']` to opt an academic book into a tools-flavored callout.
   */
  extraStyles?: string[];
  /** Optional. Spread-merged into the package-provided markdown config. */
  markdown?: AstroUserConfig['markdown'];
}

export function defineBookConfig(opts: BookConfigOptions): AstroUserConfig;
```

### Behavior

1. Resolve `profile = opts.profile ?? process.env.BOOK_PROFILE ?? 'minimal'`.
2. Throw `BookConfigError` if `profile` is not in `{ 'academic', 'tools', 'minimal' }`.
3. Build the package's integration list: `[mdx(), preact(), bookScaffoldIntegration({ profile, extraStyles })]`.
4. If `profile === 'academic'`, dynamically import `remark-math`, `rehype-katex`, and the bundled `ssmMacros`; append them to `markdown.remarkPlugins` / `markdown.rehypePlugins` (Astro 6 strict-mode KaTeX).
5. Concatenate `extraIntegrations` after the package list.
6. Spread-merge `opts.markdown` over the package-provided markdown config (consumer override wins for keys they set; everything else inherits).
7. Return the final `AstroUserConfig` via Astro's `defineConfig`.

### Errors / common mistakes

- **`BookConfigError: profile must be one of academic | tools | minimal (got "X")`** — invalid value for `profile` or `BOOK_PROFILE`. Check `.env` typos.
- **Warn: `BOOK_PROFILE not set; falling back to 'minimal'.`** — emitted to stderr at config-load time. Fix by adding `BOOK_PROFILE=academic` (or `tools`) to `.env`.
- **Consumer adds remark/rehype plugin via `markdown.remarkPlugins`**: package list ordering matters; consumer plugins run **after** package's KaTeX plugins. If you need a different order, opt out of academic profile (set `profile: 'minimal'` explicitly) and wire math manually.

### Consumer example

```js
// astro.config.mjs (academic book, default case — 2 lines)
import { defineBookConfig } from '@brandon_m_behring/book-scaffold-astro';
export default defineBookConfig({ site: 'https://my-book.example.com' });
```

```js
// astro.config.mjs (with additional integrations + cross-profile callout opt-in)
import { defineBookConfig } from '@brandon_m_behring/book-scaffold-astro';
import sitemap from '@astrojs/sitemap';

export default defineBookConfig({
  site: 'https://my-book.example.com',
  extraIntegrations: [sitemap()],
  extraStyles: ['convergence.css'],   // academic book that uses <Convergence>
});
```

---

## 5. `defineBookSchemas` API

Returns the fixed `collections` object. Closed surface per Q5: consumer composes extensions via standard JS spread + Zod `.extend()`, not hidden merge semantics.

### Signature

```ts
import type { z } from 'astro/zod';
import type { CollectionConfig } from 'astro:content';

export interface BookSchemasOptions {
  /** Optional. Same precedence as defineBookConfig. */
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

- Resolves `profile` the same way as `defineBookConfig`.
- Returns `{ collections: { chapters, sources, changelog, patterns } }`:
  - `chapters` — schema dispatched by profile: `academicChapterSchema` (academic) or `toolsChapterSchema` (tools/minimal). Loader uses `glob({ pattern: ['**/*.{md,mdx}', '!**/_*'], base: chaptersBase })`.
  - `sources`, `changelog`, `patterns` — tools-profile collateral collections (`file()` / `glob()` loaders against `sources/manifest.yaml`, `changelog/tools/*.yaml`, `changelog/patterns.yaml`). Defined unconditionally; render no-op under academic.

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

## 6. `bookScaffoldIntegration`

The single Astro Integration that does both **route injection** (Q2) and **style injection** (Q3). Phase A.5 spike confirmed Option α (Integration + `injectScript`) works cleanly cross-package; see `~/.claude/plans/poc-archive/v3-poc-outcome.md` "Phase A.5 follow-up spike".

### Signature

```ts
import type { AstroIntegration } from 'astro';

export interface BookScaffoldIntegrationOptions {
  profile: BookProfile;
  extraStyles?: string[];
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

### Override semantics

Astro user routes win over `injectRoute`d routes (standard Astro precedence). To override `/chapters`, the consumer just creates `src/pages/chapters.astro`. No package opt-out needed.

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
- **Bundled deps**: citation-js (used by `book-scaffold build-bib`), fonts (CSS-imported by `tokens.css`), Pagefind (used at build time for search index). These are package-internal; consumers should never import them directly.
- **Dev deps**: `tsup` for compiling `src/*.ts` → `dist/*.{mjs,d.ts}`. Not installed by consumers.

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
| `book-scaffold build-labels` | Emit `src/data/labels.json` for `<XRef>` / `<Theorem>` cross-refs | `scripts/build-labels.mjs` (**Phase C**) |
| `book-scaffold build-bib` | BibTeX → CSL JSON | `scripts/build-bib.mjs` (port of v2.0) |
| `book-scaffold build-figures` | PDF → SVG via pdftocairo with fallback | `scripts/build-figures.mjs` (port of v2.0) |
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
| Tools-only islands | ToolFilter, VersionSelector, PatternTimeline, SourceArchive |

Mixing across categories is allowed — see `defineBookConfig({ extraStyles: ['convergence.css'] })` for the cross-profile escape hatch (§4).

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
