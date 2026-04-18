# book-template-astro

Scaffold for long-form technical books with Tufte-inspired typography, typed pedagogical callouts, mobile-first responsive design, and PDF export from the same source.

This is the **template repository** — future books will be bootstrapped from this scaffold and customize content. The scaffold itself is maintained here as the canonical artifact.

## Status — Stage 0 complete

All 19 commits of Stage 0 have landed. Tagged as `v0.1-stage0-complete`.

- ✅ Astro 6 + MDX + Preact
- ✅ Warm Tol palette as CSS custom properties (light + dark)
- ✅ Tufte 2-column desktop layout; inline-flow asides on mobile (CSS-only)
- ✅ 9 typed callout components (Skill / CaseStudy / Concept / KeyIdea / TryThis / Recovery / Convergence / Divergence / Citation)
- ✅ 4 content collections with Zod schemas (chapters / sources / changelog / patterns)
- ✅ Dynamic chapter routing + prev/next nav + collapsed TOC
- ✅ Shiki syntax highlighting in CSS-variables mode
- ✅ Pagefind static search
- ✅ Preact island proof (version selector)
- ✅ Paged.js PDF pipeline
- ✅ Cloudflare Pages deploy workflow (pending account setup)

Next: Stage 1 ports Ch 5 "Context as Currency" from the LaTeX book to
validate the pedagogy on real content. See
`~/.claude/plans/i-believe-this-project-generic-sphinx.md` for the full
roadmap.

## Architecture (planned)

- **Astro** + **MDX** — content as structured components
- **Content Collections** with Zod schemas — frontmatter validation
- **Tufte-inspired 2-column layout** — main text + right-margin sidenotes on desktop; inline-flow asides on mobile (CSS-only, no JS)
- **9 typed MDX callout components** — SkillBox, CaseStudy, ConceptBox, Convergence, Divergence, KeyIdea, TryThis, Recovery, Citation
- **Pagefind** — static search, <100KB in-browser index
- **Shiki** in CSS-variables mode — syntax highlighting mapped to warm palette
- **Paged.js** — PDF export from the same HTML/CSS
- **Cloudflare Pages** — hosting, free, unlimited bandwidth
- **Version branches → subpath deploys** — `/v1.0/`, `/v1.1/`, old versions stay live

## Commands

```sh
npm run dev        # localhost:4321 (Astro dev server)
npm run build      # Astro build + Pagefind indexing → dist/
npm run preview    # preview the built site locally
npm run pdf        # boot preview, run Paged.js against /print/,
                   # output dist-pdf/book.pdf
```

## Hosting (Cloudflare Pages)

Deploy via the committed GitHub Action at `.github/workflows/deploy.yml`.
One-time setup:

1. Create a Cloudflare Pages project named `book-template-astro`.
2. Create a Cloudflare API token with the **Edit Cloudflare Pages**
   permission (Cloudflare Dashboard → My Profile → API Tokens).
3. Add the following secrets to the GitHub repo (Settings → Secrets
   and variables → Actions):
   - `CLOUDFLARE_API_TOKEN` — the token from step 2
   - `CLOUDFLARE_ACCOUNT_ID` — visible on any Cloudflare dashboard page
4. Push to `main`. The workflow builds, indexes with Pagefind, and
   uploads to Cloudflare Pages. Subsequent pushes to `v*` branches
   deploy as versioned preview URLs.

## First book built on this scaffold

`agentic-coding-best-practices` — at `~/Claude/agentic-coding-best-practices/` (to be bootstrapped from this template in Stage 3).
