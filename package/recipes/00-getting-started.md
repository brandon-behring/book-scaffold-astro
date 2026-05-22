# Recipe 00 — Getting started

**Profile**: any (the recipe picks one based on your answer below).

**TL;DR**: Pick a preset (`academic` / `tools` / `minimal` / `course-notes` / `research-portfolio`). Set `BOOK_PROFILE` in your shell or `.env`. Edit content under `src/content/chapters/`. `npm run dev` to preview.

## 1. Choose a preset

The scaffold ships **five presets** as of v3.5.0. `BOOK_PROFILE` (or its canonical alias `BOOK_PRESET`, v3.4.0+) is read at startup by `astro.config.mjs` and `src/content.config.ts`.

| Preset | Use when | Frontmatter schema | Default callouts | Math | Bibliography |
|---|---|---|---|---|---|
| `academic` | Textbook, research report, lecture notes | `week`, `part`(enum), `status`(7-state) | NoteBox, Theorem family, ExampleBox … | KaTeX with 36 macros (consumer can extend via `katexMacros`, v3.6.0+) | BibTeX → `src/data/references.json` |
| `tools` | Comparative practitioner book (multiple tools tracked) | `chapter`, `part`(numeric), `volatility`, `tools_compared`, `sources` | SkillBox, KeyIdea, Convergence, Divergence … | off | YAML manifest at `sources/manifest.yaml` |
| `minimal` | Single-author manifesto, essays, mixed-form work | falls back to `tools` schema | tools-family | off | manual references page |
| `course-notes` (v3.3.0, #4) | Course-derived study notes (DLAI, Coursera, Manning) | `chapter`+`part`(numeric), `course`, `instructor`, `learning_outcomes`, freeform `tags` | tools-family | off | freeform `sources` array |
| `research-portfolio` (v3.5.0, #6) | Research portfolio with mixed prose + experiments | optional `week` OR `chapter`, `status`, `freshness`(evidence-type enum), T1–T4 inline sources | both families | KaTeX on by default | structured inline `sources` (no separate collection) |

If unsure: pick `minimal` and switch later — schemas are forgiving as long as required fields are set.

## 2. Set the profile

Either:

```bash
# Shell-level (one session):
export BOOK_PROFILE=academic
npm run dev

# Or in package.json scripts:
"dev": "BOOK_PROFILE=academic astro dev"

# Or in .env (recommended for committed defaults):
echo "BOOK_PROFILE=academic" >> .env
```

The profile is read by `import.meta.env.BOOK_PROFILE` at build time. Re-run `npm install` if you change the profile and see stale type errors.

## 3. Bootstrap a new book (recommended path)

```bash
~/.claude/skills/book-scaffold-astro/create-book.sh my-book-name --preset=academic
cd ~/Claude/my-book-name
npm install
npm run dev
```

That creates a GitHub repo from this template, clones to `~/Claude/`, sets `BOOK_PROFILE` in `.env`, and copies the matching `week01-hello-world.mdx` demo chapter. Visit `localhost:4321`.

## 4. Customize for your book

- **package.json**: set `name`, `description`, `author`, `repository`
- **wrangler.toml**: replace `name = "your-book-name"` with your project name (hyphens only)
- **src/components/Sidebar.astro** (top of file): edit `siteTitle` / `siteSubtitle`
- **bibliography.bib** (academic profile): replace placeholder with your refs
- **src/content/chapters/week01-hello-world.mdx**: replace with your first chapter (or delete and start over)

## 5. Pick a chapter shape

The scaffold ships two skeleton templates:

- `examples/chapter-template-academic.mdx` — week-based (Overview / Theory / Examples / Reflections / Forward-map)
- `examples/chapter-template-tools.mdx` — Koller-Friedman (Representation / Operation / Evolution)

See recipe 07 for the full rationale. Copy whichever matches your profile to `src/content/chapters/` and start writing.

## 6. Deploy

When ready, follow `recipes/05-deploy-cloudflare.md` to push to Cloudflare Workers + Static Assets. URL: `https://<book-name>.<account>.workers.dev` after first deploy.

## What next

- **Adding math**: `recipes/01-add-math.md` (academic profile only)
- **Adding citations**: `recipes/02-bibliography-pipeline.md`
- **Adding figures / notebooks**: `recipes/03-asset-pipelines.md`
- **Using components**: `recipes/04-component-library.md`
- **Layout tweaks**: `recipes/06-mobile-first-layout.md`
- **Custom domain**: `recipes/10-custom-domain.md`
- **All decisions explained**: `recipes/08-decisions-ledger.md`
