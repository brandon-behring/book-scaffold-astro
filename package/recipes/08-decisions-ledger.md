# Recipe 08 — Decisions ledger

**Profile**: any (this recipe documents the scaffold-level decisions, not per-book).

**TL;DR**: The scaffold encodes 15 design decisions from the v2.0 cross-book consolidation (2026-05-18). This recipe lists each decision, the reasoning, and when to deviate.

The full master plan with discussion lives at `~/.claude/plans/i-want-to-investigate-recursive-yao.md`. The decisions ledger below is the operational summary.

> **Scaffold ledger vs. consumer decision log.** This file is the *scaffold's own* design ledger. Separately, since v4.12.0 (#90) `create-book` scaffolds every new book with a `decisions/` directory (numbered ADRs + `ADR_TEMPLATE.md` + `README.md`) so each book keeps its own decision log by construction. The two are independent: this ledger explains why the scaffold is shaped as it is; a book's `decisions/` explains why that book is shaped as it is.

## Strategic decisions (Round 1)

### D1. Canonical repo
**Decision**: `book-scaffold-astro` is the evolved canonical template (not a new repo).
**Reasoning**: One source of truth across multiple book projects.
**Deviate when**: Never, while v2.0 is current. If you want a different scaffold, fork.

### D2. Scope
**Decision**: Full backport — KaTeX + asset pipelines + academic callouts. Opt-in via `BOOK_PROFILE`.
**Reasoning**: Future academic books would otherwise have to re-invent the wheel.
**Deviate when**: You want a strictly-minimal scaffold without the academic surface — pick `BOOK_PROFILE=tools` or `minimal`.

## Cross-book decisions (Round 2)

### D3 — Recipe shape (Q1)
**Decision**: `BOOK_PROFILE` env var + `recipes/` markdown how-tos.
**Reasoning**: Single repo, profile-aware integrations, human-readable docs.
**Deviate when**: You need a `book.config.ts` file — document the migration in this ledger.

### D4 — Citation workflow (Q2)
**Decision**: Both BibTeX pipeline and YAML source manifest ship. `academic` defaults to BibTeX; `tools` defaults to YAML.
**Deviate when**: You can override the profile default at any time — both are always available.

### D5 — Callouts (Q3)
**Decision**: Two callout families coexist. Authors `import` what they want.
**Reasoning**: Don't force migration of book-template-astro's tools family or post_transformers' academic family.
**Deviate when**: You want a single family — just don't import from the other.

### D6 — Status taxonomy (Q4)
**Decision**: Both schemas. `academic` → 7-state status; `tools` → volatility + T1-T4 source tiers.
**Deviate when**: Your book needs neither — pick `minimal` and add your own frontmatter (schema is forgiving).

### D7 — Chapter shapes (Q5)
**Decision**: Two skeleton templates in `examples/`. Recipe 07 explains when to use which.
**Deviate when**: Build your own shape — both templates are starting points, not laws.

### D8 — Tufte width (Q6)
**Decision**: Three-tier breakpoints: 65ch (default) → 80ch at 90rem → 90ch at 120rem.
**Reasoning**: Empirically tuned via Playwright at 1280/1440/1920px — see recipe 06.
**Deviate when**: Your book has unusually short or long content — edit `tokens.css` directly.

### D9 — Deploy default (Q7)
**Decision**: Cloudflare Workers + Static Assets via `wrangler.toml`.
**Reasoning**: Cloudflare's official path post-Pages deprecation.
**Deviate when**: Self-host / GitHub Pages / Vercel — `dist/` is a vanilla static bundle, swap the deploy mechanism. Legacy Pages OAuth flow still documented in recipe 05.

### D10 — License (Q8)
**Decision**: Dual — `LICENSE` (MIT, code) + `LICENSE-CONTENT` (CC-BY-4.0, prose).
**Reasoning**: Matches post-transformers; reasonable defaults for tech books.
**Deviate when**: You want different license — overwrite both files.

## Distribution decisions (Round 3)

### D11 — Migration path (Q9)
**Decision**: Existing books (post-transformers, book-template-astro) freeze on current code. v2.0 is for new books only.
**Reasoning**: Zero churn for existing books; low cost of bug-fix divergence.
**Deviate when**: A third book project needs to consume scaffold patterns → trigger v3.0 (npm package).

### D12 — AI authoring guides (Q10)
**Decision**: Both `CLAUDE.md` (Claude Code auto-loads) + `AGENTS.md` (cross-tool) at scaffold root.
**Deviate when**: Never — both stay. AGENTS.md can be a 3-line pointer to CLAUDE.md to avoid drift.

### D13 — Recipe format (Q11)
**Decision**: Terse pointers, 50-100 lines per recipe.
**Reasoning**: Solo-author time budget; readers follow pointers into canonical code.
**Deviate when**: A recipe genuinely needs more depth (the validator one is long because the design rationale matters).

### D14 — Sample content (Q12)
**Decision**: One profile-aware demo chapter (`week01-hello-world.mdx`) shipped by `create-book.sh`.
**Reasoning**: Concrete starting point; reader deletes and replaces.
**Deviate when**: Never — the demo is intentional even if the user deletes it immediately.

## Polish decisions (Round 4)

### D15 — Cross-project conventions (Q13)
**Decision**: Scaffold's `CLAUDE.md` references the hub at `~/Claude/lever_of_archimedes/patterns/`.
**Reasoning**: Hub stays canonical; scaffold inherits via reference.
**Deviate when**: Your environment doesn't use the lever-of-archimedes hub — strip the inheritance block from CLAUDE.md.

### D16 — Validation (Q14)
**Decision**: `scripts/validate.mjs` ships at v2.0 (not deferred). ~150 lines. Wired into prebuild + recommended pre-commit.
**Reasoning**: XRef/Figure/bibkey typos are common and silent — the validator is the only safety net.
**Deviate when**: Never — disable individual checks via environment if needed (e.g. unset `BOOK_REPO_ROOT` to skip CodeRef path checks).

### D17 — Custom domain (Q15)
**Decision**: `recipes/10-custom-domain.md` ships at v2.0.
**Deviate when**: Always include this recipe — custom domain is the most common post-deploy ask.

## v3.0 (deferred)

Not in v2.0:
- npm package distribution (`@brandon-behring/book-scaffold-astro`) — trigger: third book OR external consumer
- Profile-conditional subpath exports
- Migration of post-transformers + book-template-astro to consume the package

Until v3.0 triggers, accept that bug fixes don't auto-flow to existing books. Both books are currently low-churn.

## How to use this ledger

When a future change in the scaffold contradicts a decision above, update this ledger first. Don't change behavior silently — the ledger is the durable record of "why this is shaped like it is."

Each decision has an issue-trail in `~/.claude/plans/i-want-to-investigate-recursive-yao.md` if you need full reasoning.
