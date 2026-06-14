# Recipe 16 — TikZ figures (v4.2.0+)

`book-scaffold build-figures` (v4.2.0+) auto-compiles TikZ standalone `.tex` sources to PDF via `pdflatex`, then converts the PDF to SVG via the existing pdf2svg pipeline. Closes [#17](https://github.com/brandon-behring/book-scaffold-astro/issues/17).

## TL;DR

Drop `figures/<topic>/diagram.tex` (standalone TikZ source). Run `npm run build:figures` (or it's wired into `prebuild`). Get `public/figures/<topic>/diagram.svg` ready to reference in MDX as `<Figure src="/figures/<topic>/diagram.svg" />`.

## The TikZ source

Use the `standalone` document class; configure for SVG via `tikz` option. Recommended:

```latex
\documentclass[tikz,border=2mm]{standalone}
\usepackage{tikz}
\usetikzlibrary{positioning, shapes, arrows}  % whichever libraries you need
\begin{document}
\begin{tikzpicture}
  \node (a) at (0,0) {Hello};
  \node (b) at (3,0) {World};
  \draw[->] (a) -- (b);
\end{tikzpicture}
\end{document}
```

The `border=2mm` adds a small margin around the figure so it doesn't crop right at the edge.

## Discovery rule

`build-figures` walks `figures/` (or `BOOK_FIGURES_PATH`) for both `.pdf` and `.tex` files. For each `.tex` source:

- If no sibling `.pdf` exists → compile.
- If `.pdf` exists but `.tex` is newer → recompile.
- If `.pdf` is newer than (or equal in mtime to) `.tex` → skip (use the existing PDF).

This means consumers who ship pre-compiled `.pdf` figures alongside their `.tex` sources don't pay the compilation cost on every build.

## Working directory

`pdflatex` runs in `figures/<topic>/` (the directory containing the source). This makes TikZ `\input{}` relative paths work correctly and keeps intermediate files (`.aux`, `.log`) alongside the source for easy debugging.

## Gitignore intermediate files

Add to your project's `.gitignore`:

```gitignore
figures/**/*.aux
figures/**/*.log
figures/**/*.fdb_latexmk
figures/**/*.fls
figures/**/*.synctex.gz
```

The intermediate `.pdf` files generated from `.tex` SHOULD be committed — they let consumers without TeX Live still see your figures (the SVGs still get generated from the committed PDFs).

## Required: TeX Live install

`pdflatex` is a system dependency (not an npm package). Install:

- **macOS**: `brew install --cask mactex` (full) or `brew install --cask basictex` (minimal — add packages via `tlmgr`)
- **Ubuntu/Debian**: `sudo apt-get install texlive-base texlive-pictures` (minimal for TikZ)
- **Other**: https://www.tug.org/texlive/

If `pdflatex` is missing but `.tex` files are present, `build-figures` prints a clear ERROR with the install link and continues processing any `.pdf`-only topics. Doesn't crash the build.

## CI workflow note

If your CI builds rely on regenerating SVGs from `.tex` sources (rather than just serving committed SVGs), add TeX Live to your CI workflow:

```yaml
- name: Install TeX Live for TikZ figures
  run: sudo apt-get install -y texlive-base texlive-pictures
```

This adds ~200 MB to the runner — only do it if your figures actually change between commits. The recommended pattern is to commit both `.tex` AND the generated `.pdf`/`.svg`, treating regeneration as a local-dev concern.

## Debugging compilation failures

When pdflatex fails on a `.tex` source, `build-figures` prints the stderr (and falls back to stdout) and continues with the remaining figures. Don't fail the whole build for one broken figure.

To debug interactively:

```bash
cd figures/<topic>/
pdflatex diagram.tex
# read diagram.log for the full error trace
```

Common failures:
- **Missing package**: `! LaTeX Error: File 'tikz-cd.sty' not found.` → install with `tlmgr install tikz-cd` (macOS/Linux Tex Live) or `sudo apt-get install texlive-tikz-cd` (Debian).
- **Syntax error**: `! Undefined control sequence.` → check the `.log` file for the line number.
- **Compilation hang**: should auto-resolve via `-halt-on-error -interaction=nonstopmode` flags the scaffold uses.

## Feedback loop

If you hit friction with the TikZ pipeline (a TikZ feature that doesn't compile, an obscure error message, a workflow pattern that doesn't fit), file an issue at https://github.com/brandon-behring/book-scaffold-astro/issues with the `consumer:<your-workspace>` label. v4.x is the iteration window.

## Margin & full-width figure placement (1d)

Once a figure exists, three placements are available — all reuse the existing Tufte float + gutter technique (the same one `Sidenote`/SectionMap use); none introduce a grid.

**In the running text (default).** Plain `<Figure>` constrained to the main measure:

```mdx
<Figure src="/figures/topic/diagram.svg" caption="…" alt="…" id="fig-x" />
```

**In the right margin** — `<MarginFigure>` floats into the gutter at ≥64rem and reflows inline below on mobile. Same props as `<Figure>` (rendering is delegated to it); `width` defaults to `100%` of the ~28ch gutter column, and the caption shrinks:

```mdx
import MarginFigure from '@brandon_m_behring/book-scaffold-astro/components/MarginFigure.astro';

<MarginFigure src="/figures/topic/diagram.svg" caption="A small aside figure." alt="…" id="fig-x-margin" />
```

**Full-bleed** — a wide figure/table/code block that spans the gutter column too. Use the canonical `.wide` escape (or its alias `.column-page`):

```mdx
<Figure src="/figures/topic/wide-plot.svg" caption="…" alt="…" id="fig-wide" class="wide" />
```

**Generic gutter block** — to float a non-figure block (a small note, a key figure number) into the margin, add `class="column-margin"` to any element. It uses the identical gutter float.

### Per-page width knob: `layout: wide`

For a chapter that's figure- or table-heavy, widen the **main text measure** via an optional frontmatter field (closed enum `default` | `wide`, accepted by every profile):

```yaml
---
title: "Architecture Atlas"
layout: wide      # widens --measure-main to 80ch; omit (or 'default') for the standard 65ch
---
```

`Chapter.astro` threads this as `data-layout="wide"` on `<article class="prose">`, and `layout.css` maps `.prose[data-layout="wide"] { --measure-main: 80ch }`. Omitting the field (or setting `layout: default`) emits no attribute and applies no rule — existing chapters render unchanged. A value outside the enum fails the build at content load.

## See also

- `recipes/06-figures.md` — overall figure pipeline + matplotlib/svg sources
- `PACKAGE_DESIGN.md §7` — peer dependencies (lists `pdflatex` as optional system dep)
- `PACKAGE_DESIGN.md §8` — `book-scaffold` CLI reference (build-figures subcommand)
