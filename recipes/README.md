# Recipes

Terse pointers into canonical code for the most common book-authoring workflows. Each recipe is 50–100 lines; the canonical implementation lives in the scaffold itself.

## Index

| # | Recipe | Profile | What it covers |
|---|---|---|---|
| 00 | [Getting started](00-getting-started.md) | any | Pick a profile, bootstrap, customize, deploy |
| 01 | [Add math (KaTeX)](01-add-math.md) | academic | KaTeX 36-macro library, strict mode, `$x^2$` and `$$\int$$` |
| 02 | [Bibliography pipeline](02-bibliography-pipeline.md) | academic | BibTeX → `references.json` via citation-js |
| 03 | [Asset pipelines](03-asset-pipelines.md) | any | Figures (PDF→SVG) + notebooks (ipynb→HTML), graceful-skip |
| 04 | [Component library](04-component-library.md) | any | Two callout families, Theorem, utility components |
| 05 | [Deploy to Cloudflare](05-deploy-cloudflare.md) | any | Workers + Static Assets via `wrangler.toml` |
| 06 | [Mobile-first layout](06-mobile-first-layout.md) | any | Three-tier Tufte width + left sidebar |
| 07 | [Chapter shapes](07-chapter-shapes.md) | profile-aware | Week-based vs Koller-Friedman skeletons |
| 08 | [Decisions ledger](08-decisions-ledger.md) | any | 15 design decisions explained |
| 09 | [Pre-flight validation](09-validation.md) | any | `validate.mjs` catches bibkey/XRef/Figure typos |
| 10 | [Custom domain](10-custom-domain.md) | any | Cloudflare dashboard, apex vs subdomain |

## How to read recipes

Each recipe follows the same shape (per decisions ledger D13 — Q11 locked):

1. **Profile** — when this applies
2. **TL;DR** — single-paragraph summary
3. **Sections** with concrete commands and file paths
4. **Common gotchas** — failure modes the recipe maintainer hit
5. **Canonical files** — line refs into the scaffold for full code
6. **Reference implementation** — a real book using this pattern

Recipes don't repeat what the code says — they explain *why* the code is shaped that way, *when* to deviate, and *where to look*.

## How to add a recipe

When you discover a non-obvious pattern worth preserving:

1. Pick a recipe number (next available unused number).
2. Copy `recipes/00-getting-started.md` as a starting template.
3. Add the recipe to the index above.
4. Open a PR or commit directly.

Recipes are cheap to write and cheap to maintain. The cost-per-line is low because canonical code lives elsewhere; the recipe is just signal-posts.
