# Recipe 03 — Asset pipelines (figures + notebooks)

**Profile**: any (build:figures and build:notebooks both graceful-skip when source dirs / tools are absent).

**TL;DR**: Put PDFs in `figures/`, Jupyter notebooks in `notebooks/`, then run
`npm run build:figures` and `npm run build:notebooks` explicitly. Output:
`public/figures/*.svg` (PDF→SVG via `pdftocairo`) and
`public/notebooks/*.html` (ipynb→HTML via `uv run jupyter nbconvert`). These
optional system-tool pipelines are not part of `prebuild`; generated books run
validation there instead.

## How each pipeline works

### Figures — `scripts/build-figures.mjs`

- **Source**: `figures/` at scaffold root (override via `BOOK_FIGURES_PATH` env var; e.g. `BOOK_FIGURES_PATH=../shared/figures` to share with a LaTeX sibling)
- **Output**: `public/figures/<same-subdir-structure>/<stem>.svg`
- **Tool**: `pdftocairo` (poppler-utils) with `pdftoppm` fallback for malformed SVG
- **Theming**: canonical Warm–Tol / Okabe–Ito colors and neutral paints are mapped to theme-aware CSS variables; see [Recipe 24](24-figure-authoring-standard.md)
- **Idempotency**: skips when SVG mtime >= PDF mtime
- **Graceful skip**: if `pdftocairo` or `pdftoppm` not on PATH (Cloudflare build container), warns and exits 0 — committed SVGs under `public/figures/` are served as-is

### Notebooks — `scripts/render-notebooks.mjs`

- **Source**: `notebooks/*.ipynb` at scaffold root (override via `BOOK_NOTEBOOKS_PATH`)
- **Output**: `public/notebooks/<stem>.html`
- **Tool**: `uv run jupyter nbconvert --template=basic` (override the `uv` working dir via `BOOK_UV_CWD` if your venv lives elsewhere)
- **Style scoping**: each rendered notebook wrapped in `<div class="notebook-frame">` to prevent nbconvert's embedded `<style>` from bleeding into site CSS
- **Stub skipping**: notebooks under 1500 bytes (configurable via `NOTEBOOK_STUB_BYTES`) are skipped — useful for placeholder notebooks that haven't been authored yet
- **Graceful skip**: if `uv` not on PATH, warns and exits 0

## Use figures in chapter MDX

After build, link to the SVG via `<Figure>`:

```mdx
import Figure from '../../components/Figure.astro';

<Figure
  src="/figures/intro/eigenvalues.svg"
  caption="Eigenvalue structure of the example matrix."
  id="intro-fig-eigenvalues"
/>
```

`Figure` is a CORE component (recipe 04). The validator (recipe 09) checks that every `<Figure src="...">` exists on disk after build.

## Link to notebook companions

The `ChapterHeader` component (recipe 04) accepts a `notebook_path` frontmatter field that auto-links to the rendered HTML:

```yaml
---
title: "Chapter 1"
notebook_path: notebooks/chapter01.ipynb
---
```

Renders a "View executable companion" link in the chapter header.

## Cloudflare deploy quirk: committed artifacts

Cloudflare Workers build containers don't have `pdftocairo` or `uv` installed. Two options for academic books deploying there:

1. **Commit derived artifacts** (recommended for low-friction deploy):
   - Edit `.gitignore`: remove the `public/figures/` and `public/notebooks/` lines.
   - Run `npm run build:figures` and `npm run build:notebooks` locally; commit
     the generated outputs.
   - CI serves the committed artifacts without needing either optional system tool.
   - Trade-off: ~3 MB of binary artifacts in git history.

2. **Install poppler + uv in CI**: prepend `apt-get install -y poppler-utils && curl -LsSf https://astral.sh/uv/install.sh | sh && ...` to the build command. More setup; cleaner repo.

post_transformers chose option 1 (see commit `f7fa75d`).

## Common gotchas

- **Notebooks should be output-free** for a clean rendered HTML — clear outputs before committing, or use `nbstripout` as a pre-commit hook. Cells with embedded outputs render those outputs in the HTML; this may or may not be what you want.
- **Stub-size threshold** at 1500 bytes is empirical from post_transformers — adjust via `NOTEBOOK_STUB_BYTES` if your placeholder notebooks are larger.
- **`pdftocairo` produces a tiny SVG** for some PDF inputs (vector layers ungrouped, etc.). The script auto-falls back to `pdftoppm -r 200 -png` at 200 DPI when SVG output is < 200 bytes.
- **Do not pre-blend semantic fills** (`warmblue!13`, for example). Export the canonical base color with a separate opacity so the SVG rewrite can preserve its role in dark mode. Recipe 24 has TikZ and matplotlib examples.

## Canonical files

- `scripts/build-figures.mjs:23-32` — path resolution + env overrides
- `scripts/render-notebooks.mjs:30-46` — same
- `package.json` `build:figures` / `build:notebooks` — explicit authoring commands
- `.gitignore` — toggles whether artifacts are committed

## Reference implementation

[`~/Claude/post_transformers/guides/web/`](../) ships both pipelines pointed at `../figures/` and `../notebooks/` via env vars in its `package.json` scripts. The post_transformers repo commits its generated `public/figures/` and `public/notebooks/` (the Cloudflare workaround), see commit `f7fa75d`.
