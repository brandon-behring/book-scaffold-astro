# book-scaffold-astro — template bootstrap guide

This repository is a **GitHub template** for long-form technical books.
A new book is created from it via "Use this template" → "Create a new
repository" on GitHub, or via the `book-scaffold-astro` Claude skill:

```bash
~/.claude/skills/book-scaffold-astro/create-book.sh <your-book-name>
```

This file is the one-page orientation for someone starting a new book.
The rest of the scaffold is self-documenting; follow the links below
when you reach that part of your setup.

---

## What you get

- **Astro 6 + MDX** content collections with Zod-validated frontmatter.
- **Tufte-inspired typography**: 2-column desktop layout, always-visible
  sidenotes (Gwern's "no effort" principle), warm Tol 5-hue palette.
- **Koller-Friedman chapter structure**: every chapter uses the
  Representation / Operation / Evolution skeleton. See
  `pedagogy/kf-chapter-shape.md`.
- **8 pedagogical callouts**: SkillBox, CaseStudy, ConceptBox, KeyIdea,
  TryThis, Recovery, Convergence, Divergence.
- **Freshness badges**: each chapter's `volatility` + `last_verified`
  frontmatter drives a green/gold/rose staleness badge. See
  `pedagogy/volatility-classes.md`.
- **Tool filter**: chapter-level filtering by `tools_compared`
  frontmatter; Preact island persists to localStorage.
- **Source archive**: Appendix D's `<SourceArchive />` component renders
  `sources/manifest.yaml` grouped by tier. Tier methodology in
  `pedagogy/source-tiers.md`.
- **Convergence dashboard**: `/convergence/` joins `changelog/patterns.yaml`
  + `changelog/tools/*.yaml` for per-pattern adoption timelines.
- **Paged.js PDF export** + **Pagefind full-text search** + **dark mode**.
- **Cloudflare Pages deploy workflow** at `.github/workflows/deploy.yml`.

---

## Bootstrap checklist

After cloning your new book repo:

### 1. Install + verify

```bash
npm install
npm run dev              # localhost:4321
npx astro preview --host # phone on LAN (after build)
```

### 2. Customize top-level config

- `package.json`: `name`, `description`, `repository` — all set to
  template placeholders right now; replace.
- `astro.config.mjs`: set `site` to your eventual URL; adjust `base` if
  deploying to a subpath.
- `README.md`: replace with your book's public README.
  `TEMPLATE_README.md` (this file) can be deleted once you've read it.

### 3. Read the exemplar chapter

`src/content/chapters/_example-chapter.mdx` is a worked KF-pedagogy
walkthrough with every callout type, both Citation examples, and fully-
filled frontmatter. Read it once.

Then delete it:

```bash
rm src/content/chapters/_example-chapter.mdx
```

The leading underscore and `draft: true` keep it out of the build
already, but removing the file keeps your repo tidy.

### 4. Decide on convergence tracking

The scaffold ships with a `/convergence/` dashboard and supporting
helpers (`src/lib/patterns.ts`, `src/components/PatternTimeline.astro`).

**If your book tracks patterns across tools** (e.g., a comparative
practice guide): fill in `changelog/patterns.yaml` + `changelog/tools/
*.yaml` with your patterns and tool adoption timelines. The dashboard
renders automatically.

**If your book does not track patterns**: you can remove convergence
infrastructure in 3 steps:

```bash
rm src/pages/convergence.astro
rm src/components/PatternTimeline.astro
rm src/lib/patterns.ts
rm -r changelog/
```

Then remove the `changelog` and `patterns` collections from
`src/content.config.ts`, and the `/convergence/` link from
`src/pages/index.astro` + `src/pages/chapters.astro`.

### 5. Reset sources

`sources/manifest.yaml` keeps two template entries (gwern-sidenote,
tufte-css) that are cited by `_example-chapter.mdx`. Replace them with
your book's real sources as chapters leave draft.

If your book has no external citations (unusual), empty the manifest
to `[]` and remove `<SourceArchive />` usage from Appendix D (or
delete the appendix entirely).

### 6. Set up deploy

Cloudflare Pages deploy is pre-wired. One-time setup:

1. Create a Cloudflare Pages project named after your book.
2. Create an API token with "Edit Cloudflare Pages" permission.
3. Add two secrets to your GitHub repo (`Settings → Secrets and
   variables → Actions`):
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
4. Push to `main`. The workflow builds and deploys.

If you're not using Cloudflare, delete `.github/workflows/deploy.yml`
and wire your preferred host.

### 7. Start writing

The book's structure:

```
src/content/chapters/*.mdx    ← one chapter per file, KF skeleton
src/pages/                    ← static routes (don't add unless structural)
src/components/               ← shared callouts + chrome
src/layouts/Base.astro        ← HTML shell
src/styles/                   ← tokens, typography, layout, callouts, print
sources/manifest.yaml         ← citation targets
changelog/                    ← convergence data (if tracking patterns)
```

Every chapter's frontmatter requires:

```yaml
---
title: "Chapter title"
part: 1               # which Part (0-10)
chapter: 1            # chapter number within the part
volatility: feature-surface   # stable-principle | architectural-pattern | feature-surface
tools_compared: [cross-tool]  # or [claude-code, gemini-cli, codex-cli]
last_verified: 2026-04-18
sources: [my-source-slug]     # optional; entries in sources/manifest.yaml
draft: true                   # flip to false when ready to ship
description: "One-paragraph meta description for search and social."
---
```

Zod validates at build time. Any missing or malformed field fails with
a precise error pointing to the offending file.

---

## Pedagogy references

Three short reference docs live under `pedagogy/`:

- `pedagogy/kf-chapter-shape.md` — the Representation / Operation /
  Evolution structure and why it defends against drift.
- `pedagogy/volatility-classes.md` — the three classes that drive
  freshness badges + re-verification cadence.
- `pedagogy/source-tiers.md` — the T1-T4 tier system for citations.

These are not arbitrary conventions; each one is load-bearing for a
specific invariant the scaffold enforces. Read them before your first
real chapter ships.

---

## Architecture reference

- **Astro 6** + **MDX 5** + **Preact 10** (islands `client:idle`).
- **Content Collections** with Zod schemas: `chapters`, `sources`,
  `changelog`, `patterns`.
- **Pagefind 1.5** static search (4MB of HTML → ~200KB index).
- **Paged.js** PDF export via `npm run pdf`.
- **Cloudflare Pages** deploy via `.github/workflows/deploy.yml`.

---

## What to delete from this README

This file is template-specific orientation. Your book's actual readers
don't need it. After finishing the checklist above, delete it:

```bash
rm TEMPLATE_README.md
git commit -am "chore: remove template bootstrap notes"
```

The real `README.md` at the repo root is where your book's public-
facing intro lives.
