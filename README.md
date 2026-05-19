# book-scaffold-astro

**GitHub template** for long-form technical books. Astro + MDX + Paged.js + Pagefind with Tufte-inspired typography, profile-aware pedagogy (academic vs tools-comparative), KaTeX math, BibTeX citations, and Cloudflare Workers + Static Assets deploy.

**v2.0 (2026-05-18)**: profile-aware architecture. Pick `academic` / `tools` / `minimal` via `BOOK_PROFILE`. See [`recipes/08-decisions-ledger.md`](recipes/08-decisions-ledger.md) for the 15 design decisions.

## Use this template

Click **Use this template** above (or the green "Use this template" button on the repo's main page on GitHub) to create a new repository from this scaffold. Or run the Claude skill that wraps the bootstrap:

```bash
~/.claude/skills/book-scaffold-astro/create-book.sh <your-book-name> --profile=<academic|tools|minimal>
```

Then start with [`recipes/00-getting-started.md`](recipes/00-getting-started.md).

## What's in the box

- **Astro 6 + MDX** content collections with Zod-validated frontmatter
- **Profile-aware schema dispatch** (academic 7-state status / tools volatility + T1-T4 source tiers)
- **Tufte-inspired three-tier layout** — 65ch (default) / 80ch (≥90rem) / 90ch (≥120rem) main column; pure-CSS sidenote reflow on mobile
- **Left chapter-nav sidebar** (≥1024px), profile-aware grouping
- **KaTeX math** with 36-macro library (academic profile, opt-in)
- **BibTeX citation pipeline** via citation-js (academic profile)
- **PDF figure + Jupyter notebook pipelines** (graceful-skip when tools missing)
- **18 typed callouts** across two pedagogical families (tools 8 / academic 10) + unified `Theorem` component
- **Pre-flight validator** — catches typo'd bibkeys / XRef ids / Figure paths / internal links before they ship
- **Pagefind full-text search** + **Paged.js PDF export**
- **Cloudflare Workers + Static Assets** deploy via `wrangler.toml` (legacy Pages OAuth flow also documented)
- **Warm Tol 5-hue palette** (colorblind-safe; light + dark modes via `data-theme`)
- **Author guides** — `CLAUDE.md` + `AGENTS.md` at root, hub-referenced

## Recipes

Eleven terse pointers (≤100 lines each) covering every common workflow. See [`recipes/README.md`](recipes/README.md) for the index. Highlights:

- [00 — Getting started](recipes/00-getting-started.md)
- [04 — Component library](recipes/04-component-library.md)
- [05 — Deploy to Cloudflare](recipes/05-deploy-cloudflare.md)
- [07 — Chapter shapes](recipes/07-chapter-shapes.md)
- [08 — Decisions ledger](recipes/08-decisions-ledger.md)

## Pedagogy

Two chapter-shape doctrines coexist:

1. **Week-based** (academic profile) — Overview / Theory / Examples / Reflections / Forward-map. See [`examples/chapter-template-academic.mdx`](examples/chapter-template-academic.mdx).
2. **Koller-Friedman** (tools profile) — Representation / Operation / Evolution. See [`examples/chapter-template-tools.mdx`](examples/chapter-template-tools.mdx) and [`pedagogy/kf-chapter-shape.md`](pedagogy/kf-chapter-shape.md).

Methodology references:

- [`pedagogy/volatility-classes.md`](pedagogy/volatility-classes.md) — stable-principle (365d) / architectural-pattern (180d) / feature-surface (90d)
- [`pedagogy/source-tiers.md`](pedagogy/source-tiers.md) — T1-official / T2-release-notes / T3-practitioner / T4-conjecture

## Reference implementations

- **Academic profile**: [`~/Claude/post_transformers/guides/web/`](https://post-transformers-guide.brandon-m-behring.workers.dev) — 6 chapters of post-transformer architecture content, deployed.
- **Tools profile**: [`~/Claude/book-template-astro/`](https://github.com/brandon-behring/book-template-astro) — *Agentic Coding: Principles and Practices*, 23 chapters.

## Commands

```sh
npm install            # once, after cloning
npm run dev            # localhost:4321 (with prebuild assets + validate)
npm run build          # Astro build + Pagefind index → dist/
npm run validate       # pre-flight content checks (recipe 09)
npm run build:bib      # rebuild references.json after .bib edit
npm run preview        # preview the built site locally
npm run pdf            # boot preview + Paged.js → dist-pdf/book.pdf
```

Set `BOOK_PROFILE=academic` (or `tools` / `minimal`) in `.env` or shell to pick the profile.

## Provenance

Extracted from the book *Agentic Coding: Principles and Practices* at v0.2-stage3-complete (2026-04-18). The v2.0 consolidation (2026-05-18) backported KaTeX, BibTeX pipeline, academic callouts, left sidebar, and three-tier Tufte width from `post_transformers/guides/web/` — see [`recipes/08-decisions-ledger.md`](recipes/08-decisions-ledger.md) for the full delta and the 15 design decisions.

## License

Dual:

- [`LICENSE`](LICENSE) — MIT, applies to code, scripts, and configuration.
- [`LICENSE-CONTENT`](LICENSE-CONTENT) — CC-BY-4.0, applies to prose and book content under `src/content/`.
