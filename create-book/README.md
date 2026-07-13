# `@brandon_m_behring/create-book`

Bootstrap a thin Astro book that consumes
`@brandon_m_behring/book-scaffold-astro`:

```bash
npx @brandon_m_behring/create-book my-book --preset=academic --author="Ada Lovelace"
cd my-book
npm install
npm run dev
```

The five presets are `academic`, `tools`, `minimal`, `course-notes`, and
`research-portfolio`. `--profile` remains a backward-compatible alias for
`--preset`. Author metadata accepts `--author=NAME` or `--author NAME`; omitted
authors default to the neutral `Book contributors`.

Every generated book includes:

- a matching toolkit dependency and preset-aware configuration;
- content, page, bibliography/source, and decision-log starters;
- `CLAUDE.md` plus an `AGENTS.md` cross-tool pointer;
- scoped MIT and CC BY 4.0 license files with the generated author metadata;
- `npm run pdf`, which builds the book and renders `dist-pdf/book.pdf`.

The CLI and toolkit release in lock-step under decision D12.

## Licensing

The executable and generated code/configuration templates are MIT-licensed.
Substantive prose templates are CC BY 4.0. See `LICENSE` and
`LICENSE-CONTENT` in this package; generated books carry their own scoped
copies.
