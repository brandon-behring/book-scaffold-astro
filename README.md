# book-scaffold-astro

**GitHub template** for long-form technical books. Astro + MDX +
Paged.js + Pagefind with Tufte-inspired typography,
Koller-Friedman chapter pedagogy, and comparative-convergence
dashboards.

## Use this template

Click **Use this template** above (or the green "Use this template"
button on the repo's main page on GitHub) to create a new repository
from this scaffold. Or run the Claude skill that wraps the bootstrap:

```bash
~/.claude/skills/book-scaffold-astro/create-book.sh <your-book-name>
```

Then read [TEMPLATE_README.md](TEMPLATE_README.md) in your new repo
for the bootstrap checklist.

## What's in the box

- Astro 6 + MDX content collections with Zod-validated frontmatter
- Tufte-inspired 2-column desktop layout + Gwern-style inline mobile
  asides (pure CSS, no JS)
- 8 typed pedagogical callouts (SkillBox, CaseStudy, ConceptBox,
  KeyIdea, TryThis, Recovery, Convergence, Divergence)
- Freshness badges (volatility-aware staleness computation)
- Chapter index + tool filter UI (Preact island + CSS attribute
  filter)
- Auto-rendered source archive grouped by tier
- Convergence dashboard (per-pattern adoption timelines across tools)
- Warm Tol 5-hue palette (colorblind-safe; light + dark modes)
- Pagefind full-text search + Paged.js PDF export
- Cloudflare Pages deploy workflow

## Pedagogy

The scaffold encodes three opinionated decisions:

1. **Chapters follow Koller-Friedman structure**
   (Representation / Operation / Evolution) — see
   [`pedagogy/kf-chapter-shape.md`](pedagogy/kf-chapter-shape.md).
2. **Every chapter declares a volatility class** — see
   [`pedagogy/volatility-classes.md`](pedagogy/volatility-classes.md).
3. **Every source carries a trust tier** — see
   [`pedagogy/source-tiers.md`](pedagogy/source-tiers.md).

## Provenance

This scaffold was extracted from the book
*Agentic Coding: Principles and Practices* at v0.2-stage3-complete
(2026-04-18). Methodology for volatility classes and source tiers
migrated conceptually from the LaTeX book *Claude Best Practices* at
v2.9 (2026-03-27), now in maintenance-only mode.

## Commands

```sh
npm install            # once, after cloning
npm run dev            # localhost:4321
npm run build          # Astro build + Pagefind index → dist/
npm run preview        # preview the built site locally
npm run pdf            # boot preview + Paged.js → dist-pdf/book.pdf
```

## License

Pending — attach a `LICENSE` file to your bootstrapped repo.
