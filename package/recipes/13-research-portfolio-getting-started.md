# Recipe 13 — Research-portfolio getting started

The `research-portfolio` preset (v3.5.0+) is for books that combine:

- **Academic structure**: week/part/status, KaTeX math, BibTeX citations, Theorem family
- **Tools-style provenance**: volatility class, T1–T4 tier-tagged sources, required `last_verified` date
- **Portfolio-specific affordances**: pre-release banner, AI collaboration disclosure, blocked-by-upstream callouts, structured ethics/policy references

If your book is primarily a weekly curriculum, use [`academic`](07-chapter-shapes.md#academic). If primarily AI-CLI comparison content, use [`tools`](07-chapter-shapes.md#tools). If a course-derived study notebook, use [`course-notes`](07-chapter-shapes.md#course-notes). Research portfolios sit at the intersection of all three and get their own preset.

## When to use this preset

Choose `research-portfolio` if your book:

- Reports on research the author conducted directly (experimental results, theoretical analysis, literature surveys with original synthesis)
- Has an evolving release state — chapters land at different times, the book passes through alpha → beta → rc states
- Cites primary sources directly inline per-chapter (vs the tools-profile pattern of a central sources collection)
- Discloses AI collaboration / dual-use considerations / governance per repo policy
- Tracks upstream blockers (waiting on a tool release, a paper publication, a dataset)

Reference (forthcoming) consumer: [`prompt-injection-portfolio`](https://github.com/brandon-behring/prompt-injection-portfolio).

## Quickstart

```bash
npx @brandon_m_behring/create-book my-portfolio --preset=research-portfolio
cd my-portfolio
npm install
npm run dev
```

This scaffolds:

- `astro.config.mjs` with `defineBookConfig({ preset: 'research-portfolio' })`
- `src/content.config.ts` with the `researchPortfolioChapterSchema`
- A sample chapter at `src/content/chapters/01-introduction.mdx`
- Frontmatter pages at `src/content/frontmatter/` (title-page, ai-disclosure, banner)
- A `bibliography.bib` stub for citations

## Chapter frontmatter shape

Two fields are **required** by the schema; everything else is optional.

| Field | Required? | Notes |
|---|---|---|
| `title` | **required** | Non-empty string |
| `last_verified` | **required** | YAML date (`2026-05-19`); used by freshness reports + the v4.6 prevalidate hook |
| All other fields | optional | See annotations in the template below |

### `status` vs `freshness` — two distinct axes

These look similar but mean different things. Authors often confuse them — getting `freshness` wrong fails the schema with `InvalidContentEntryDataError`.

| Field | Concept | Enum values | Mental check |
|---|---|---|---|
| `status` | **Authoring state** — where am I in writing this chapter? | `scaffolded`, `prose_only`, `code_only`, `chapter_only`, `reading_only`, `implemented`, `planned` | "Have I written it?" |
| `freshness` | **Epistemic type** — what kind of evidence does this chapter rest on? | `experimental-result`, `literature-survey`, `theoretical`, `reference` | "What kind of knowledge is this?" |

A chapter can be `status: scaffolded` (not yet written) AND `freshness: theoretical` (will be a mathematical argument). They're orthogonal.

If you want to mark a chapter as "not written yet", use `status: scaffolded` or `status: planned`. `freshness` has no value for that — it describes the chapter's content type, not its progress.

### Template

```yaml
---
# required
title: "Chapter title"
last_verified: 2026-05-19         # YAML date (no quotes); becomes a JS Date

# optional — hierarchy (use whichever fits; all three may be omitted)
slug: ch01-introduction           # defaults to filename
chapter: 1                        # tools-style numeric
part: 1                           # either number OR academic-style string enum
week: 1                           # only if you use weekly cadence

# optional — authoring state + epistemic type
status: prose_only                # 'scaffolded'|'prose_only'|'code_only'|'chapter_only'|'reading_only'|'implemented'|'planned'
freshness: experimental-result    # 'experimental-result'|'literature-survey'|'theoretical'|'reference'

# optional — provenance
volatility: feature-surface       # 'stable-principle'|'architectural-pattern'|'feature-surface'
tags:                             # freeform string array (NOT the tools_compared enum)
  - prompt-injection
  - red-team
  - CVE-2025-32711
sources:                          # structured inline; tier ∈ {T1, T2, T3, T4}
  - tier: T1
    url: https://nvd.nist.gov/vuln/detail/CVE-2025-32711
    label: NVD CVE-2025-32711 (primary advisory)
  - tier: T2
    url: https://arxiv.org/abs/2406.00799
    label: TaskTracker (Wallace et al. 2024)

# optional — SEO / OpenGraph (v4.6+)
description: "..."                # used by Base.astro meta tags
author: "Brandon Behring"
published: 2026-05-01
updated: 2026-05-19
image: "/og/ch01.png"

draft: false
---
```

All hierarchy fields (`part`, `week`, `chapter`) are optional — chapters can use whichever shape fits. The route templates dispatch on which is set.

## The 4 portfolio-specific components

Shipped in v3.5.0 alongside the preset:

### `<PreReleaseBanner>` — declare release state

```astro
---
import PreReleaseBanner from '@brandon_m_behring/book-scaffold-astro/components/PreReleaseBanner.astro';
---
<PreReleaseBanner state="alpha" />
<PreReleaseBanner state="beta" dismissAt="v0.7.0" />
<PreReleaseBanner state="rc" message="Final review pass; please file issues." />
<PreReleaseBanner state="locked" />
```

Place at the top of a layout to surface site-wide, or inline at the top of a specific chapter. Four states: `'alpha' | 'beta' | 'rc' | 'locked'`. Each has a default message + color treatment; override with `message`.

### `<PolicyRef>` — inline link to a repo-root policy doc

```astro
---
import PolicyRef from '@brandon_m_behring/book-scaffold-astro/components/PolicyRef.astro';
---
See <PolicyRef file="ETHICS.md" section="§1 Dual-use disclosure" label="our ethics policy" />
for the dual-use review process.

Per <PolicyRef file="SECURITY.md" /> the disclosure timeline is 90 days.
```

Resolves to `/<file>#<slug-of-section>` by default (assumes consumer ships the markdown at site root via `public/` or an Astro page). Override the href with `href="..."`.

### `<AICollaborationDisclosure>` — render an AI-collab paragraph

```astro
---
import AICollaborationDisclosure from '@brandon_m_behring/book-scaffold-astro/components/AICollaborationDisclosure.astro';
---
<AICollaborationDisclosure
  model="Claude Opus 4.7 + Sonnet 4.6 (Anthropic)"
  role="research collaborator + writing collaborator"
  commit_attribution="Co-Authored-By: Claude <noreply@anthropic.com>"
>
  All factual claims independently verified by the human author; AI contributions
  reviewed line-by-line before merge.
</AICollaborationDisclosure>
```

Three required props (`model`, `role`, `commit_attribution`); optional slot for prose. For YAML-driven config, load the YAML consumer-side and spread props:

```astro
---
import disclosure from '../data/ai-collaboration.yaml';
---
<AICollaborationDisclosure {...disclosure} />
```

(The scaffold doesn't bundle a YAML parser; use `astro:content` file loader with `yaml()` or similar consumer-side.)

### `<BlockedByCallout>` — declare upstream blockers

```astro
---
import BlockedByCallout from '@brandon_m_behring/book-scaffold-astro/components/BlockedByCallout.astro';
---
<BlockedByCallout
  upstream="book-scaffold-astro v3.5.0"
  url="https://github.com/brandon-behring/book-scaffold-astro/issues/6"
  reason="research-portfolio preset + 3 new components"
  unblockedAt="2026-05-19"
>
  Once the preset ships, this chapter's frontmatter migrates from the
  hand-rolled schema to the upstream `research-portfolio` shape.
</BlockedByCallout>
```

Use for chapters/sections waiting on external work — a tool release, a paper publication, a dataset acquisition. The structured fields produce a scannable card; slot content holds migration notes / workaround prose.

## Frontmatter pages

The `research-portfolio` preset enables `/frontmatter/[slug]/` by default. Drop MDX files under `src/content/frontmatter/` (each needs `slug`, `title`, `order` per `frontmatterCollection()` — see [recipe 04](04-component-library.md) or PACKAGE_DESIGN.md §17).

Common frontmatter pages for a portfolio:

- `title-page.mdx` — book title + author + version + license
- `ai-collaboration-disclosure.mdx` — wraps `<AICollaborationDisclosure>`
- `pre-alpha-banner.mdx` (or similar) — author's note on release state
- `executive-summary.mdx` — 1-page overview for skim readers
- `acknowledgments.mdx` — collaborators + funding + dataset providers
- `ethics-policy.mdx` — wraps `<PolicyRef>` to other ETHICS docs

## Migrating from a hand-rolled schema

If you previously rolled your own schema (e.g., for `prompt-injection-portfolio` pre-v3.5.0), migration is mostly mechanical:

1. **Replace your `defineCollection` for chapters** with `defineBookSchemas({ preset: 'research-portfolio' }).collections.chapters`.
2. **Rename `tools_compared` → `tags`** in frontmatter across chapters (the new schema uses freeform `tags`; the rename is a global find-and-replace).
3. **Restructure `sources`** to the new inline shape `{ tier: 'T1', url, label }` — if you were using the tools-profile `sources` collection (referenced by string keys), inline them per chapter.
4. **Replace ad-hoc PreReleaseBanner / EthicsRef / AIAssistanceDisclosure** components with the scaffold-shipped versions (delete your local copies; update imports).
5. **Bump pin to `^3.5.0`** in your `package.json`.

See `package/CHANGELOG.md` §3.5.0 for the full additive list.

## See also

- [Recipe 04 — Component library](04-component-library.md) — full component reference (38+ now with v3.5.0 additions)
- [Recipe 07 — Chapter shapes](07-chapter-shapes.md) — choosing between presets
- [Recipe 12 — Where to file issues](12-where-to-file-issues.md) — feedback loop for new portfolios
- [`LATEX_TO_MDX_MAPPING.md`](../LATEX_TO_MDX_MAPPING.md) — converting a LaTeX research book
- [`PACKAGE_DESIGN.md`](../PACKAGE_DESIGN.md) — full API contract
