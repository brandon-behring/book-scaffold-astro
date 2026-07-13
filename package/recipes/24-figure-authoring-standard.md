# Recipe 24 — Figure authoring standard

**Profile**: any profile that publishes diagrams, plots, or TikZ figures.

**TL;DR**: Use `--fig-*` when a color means something and `--series-1` through
`--series-8` when colors only distinguish data series. Author exported figures
with the canonical hex plus a separate opacity; `build:figures` maps those
colors to theme-aware CSS variables. Every figure needs a useful caption and
accessible description, and color must never be the only way to read it.

## 1. Choose the right color contract

Semantic colors keep the same meaning across a book:

| Token | Meaning | Light | Dark | Export hex |
|---|---|---|---|---|
| `--fig-blue` | default, lightweight, informational | `#3B6FA0` | `#7297BB` | `#3B6FA0` |
| `--fig-green` | positive or successful outcome | `#4A7E3F` | `#7DA275` | `#4A7E3F` |
| `--fig-rose` | caution or problem | `#C06858` | `#D29287` | `#C06858` |
| `--fig-plum` | authority, control, or heaviest weight | `#8A4E82` | `#AB80A5` | `#8A4E82` |
| `--fig-gold` | packaging, coordination, or convergence | `#9D7D34` | `#D2B575` | `#C09840` |
| `--fig-crimson` | failure or severe problem | `#A03838` | `#BB7070` | `#A03838` |
| `--fig-ink` | labels, essential outlines, axes | `#1A1A19` | `#E8E5DD` | `#1A1A19` or black |
| `--fig-paper` | figure background | `#FDFCF9` | `#1A1816` | `#FDFCF9` or white |
| `--fig-grid` | essential gridlines and secondary structure | `#8C8981` | `#746E67` | `#B5B3AA` or a mid-neutral |

`--fig-gold` resolves to a slightly darker gold in the light theme so an
essential stroke clears 3:1 against `--fig-paper`. The export rewrite still
recognizes the canonical `#C09840` authoring value.

Categorical plots use the stable Okabe–Ito order:

| Ordinal | Token | Canonical color |
|---:|---|---|
| 1 | `--series-1` | orange `#E69F00` |
| 2 | `--series-2` | sky blue `#56B4E9` |
| 3 | `--series-3` | bluish green `#009E73` |
| 4 | `--series-4` | yellow `#F0E442` |
| 5 | `--series-5` | blue `#0072B2` |
| 6 | `--series-6` | vermillion `#D55E00` |
| 7 | `--series-7` | reddish purple `#CC79A7` |
| 8 | `--series-8` | theme ink (canonical authoring color: black) |

Series 1–7 use the same canonical value in light and dark; each already clears
3:1 against the dark figure paper. Series 8 changes with `--fig-ink`.

Assign series in that order and keep the ordinal attached to the same series
when a chart or theme changes. Never use `--series-*` to mean good, bad,
warning, or success; those meanings belong to `--fig-*`.

After PDF export, canonical series-8 black is indistinguishable from labels and
axes. The rewrite therefore maps it to structural ink; `--series-8` aliases the
same `--fig-ink` value, so it still renders correctly in both themes. Use
`var(--series-8)` directly in a CSS-native SVG if you need to override that
ordinal independently.

## 2. CSS-native SVG: the preferred hand-authored form

Use variables directly. Pale fills should be computed from the current figure
paper, while their solid borders carry the category:

```svg
<svg role="img" aria-labelledby="pipeline-title pipeline-desc"
     viewBox="0 0 420 140" xmlns="http://www.w3.org/2000/svg">
  <title id="pipeline-title">A three-stage publishing pipeline</title>
  <desc id="pipeline-desc">
    Draft flows to review and then publication. Review is the only caution stage.
  </desc>
  <style>
    .label { fill: var(--fig-ink); font: 16px sans-serif; }
    .edge { fill: none; stroke: var(--fig-ink); stroke-width: 2; }
    .draft {
      fill: color-mix(in srgb, var(--fig-blue) 14%, var(--fig-paper));
      stroke: var(--fig-blue);
    }
    .review {
      fill: color-mix(in srgb, var(--fig-rose) 14%, var(--fig-paper));
      stroke: var(--fig-rose);
    }
    .published {
      fill: color-mix(in srgb, var(--fig-green) 14%, var(--fig-paper));
      stroke: var(--fig-green);
    }
    .node { stroke-width: 3; }
  </style>
  <!-- geometry omitted -->
</svg>
```

When this is a local SVG rendered by `<Figure>`, the host page supplies the
variables and its light/dark toggle changes the figure immediately. An SVG
loaded from another origin cannot inherit host variables.

For a categorical chart, use `stroke: var(--series-1)`, then `--series-2`, and
so on. Give every line a second channel too: different dashes, markers, or a
direct text label.

## 3. TikZ and matplotlib exports

PDF cannot carry CSS variables. `build:figures` therefore recognizes the exact
Warm–Tol and Okabe–Ito authoring colors in the generated SVG and maps them back
to variables. Unknown saturated colors stay exactly as authored.

The important rule is **base color plus separate opacity**. Do not use a
pre-blended low-chroma color such as `figblue!13`: after PDF export it is only
an anonymous near-white RGB and can be mistaken for figure paper.

TikZ:

```latex
\definecolor{figblue}{HTML}{3B6FA0}
\definecolor{figrose}{HTML}{C06858}
\definecolor{seriesone}{HTML}{E69F00}

\node[
  draw=figblue,
  fill=figblue,
  fill opacity=.14,
  text opacity=1,
  line width=1.2pt,
] (draft) {Draft};
\node[draw=figrose, fill=figrose, fill opacity=.14, text opacity=1] (review) {Review};
\draw[seriesone, very thick, dashed] plot coordinates {(0,0) (1,2) (2,3)};
```

Matplotlib:

```python
import matplotlib.pyplot as plt

FIG = {
    "blue": "#3B6FA0",
    "rose": "#C06858",
    "green": "#4A7E3F",
}
SERIES = [
    "#E69F00", "#56B4E9", "#009E73", "#F0E442",
    "#0072B2", "#D55E00", "#CC79A7", "#000000",
]

fig, ax = plt.subplots()
# Keep the canvas transparent: the host's --fig-paper must show through after
# PDF → SVG conversion instead of baking a light-only rectangle into the plot.
fig.patch.set_alpha(0)
ax.set_facecolor("none")
ax.fill_between(x, low, high, color=FIG["blue"], alpha=.14)
ax.plot(x, mean, color=FIG["blue"], linewidth=2)
ax.plot(x, baseline, color=SERIES[0], linestyle="--", marker="o", label="Baseline")
fig.savefig(
    "figures/results/summary.pdf",
    format="pdf",
    transparent=True,
    bbox_inches="tight",
)
```

Then run `npm run build:figures` to preserve the vector PDF→SVG path. Export a
raster (`.png`) only when the source is true pixel data, such as a photograph
or instrument raster. Lines, text, markers, and diagram geometry should remain
vector PDF/SVG. Re-run the command after upgrading the scaffold so
already-generated SVGs receive new mappings; the rewrite is idempotent.

## 4. Accessible name and description

Use `<Figure>` as the accessibility boundary:

```mdx
<Figure
  src="/figures/results/summary.svg"
  id="fig-results-summary"
  caption="Review catches most defects before publication."
  alt="Three-stage publishing pipeline"
  desc="Draft flows right to review, then publication. The review node is marked as a caution stage, and the publication node is marked as a successful outcome."
/>
```

- `caption` states the point the reader should take from the figure.
- `alt` is a short accessible name, not a duplicate of every visible label.
- `desc` gives reading order, relationships, trend, and any conclusion carried
  by position, shape, line style, or color.
- For a local pipeline SVG, `<Figure>` replaces stale `<title>`/`<desc>` nodes
  with these props and wires `aria-labelledby` automatically.
- Raster and remote images remain `<img>` elements, so give them complete alt
  text and put any longer explanation in adjacent prose.

Do not write “blue means success” as the only description. Name the category
and the redundant cue: “the successful outcome is the green node with a check
mark.”

## 5. Contrast and color-vision rules

Okabe–Ito is color-vision-deficiency-friendly; that does not make every hue a
high-contrast thin line on light paper. In particular, orange, sky blue,
yellow, and reddish purple need redundant encoding.

- Never encode a distinction by color alone. Add marker shape, dash pattern,
  direct labels, texture, or position.
- Use `--fig-ink` for axes, text, arrowheads, and essential outlines.
- Give pale semantic areas a solid `--fig-*` border. The semantic strokes and
  `--fig-grid` clear WCAG's 3:1 non-text contrast threshold in both themes.
- Outline small categorical marks with `--fig-ink`; use thicker/dashed lines
  and markers for categorical series that do not clear 3:1 by color alone.
- Do not reorder `--series-*` in dark mode. `--series-8` follows theme ink so
  the neutral series remains visible rather than staying literal black.

## 6. Dual-theme release gate

Before publishing a new figure:

1. Run `npm run build:figures` and confirm the SVG contains one
   `data-diagram-map` style block.
2. Render it through `<Figure>` with explicit light and dark page themes.
3. Open the standalone SVG with both OS color schemes; its embedded defaults
   should also switch.
4. Check labels, axes, arrowheads, boundaries, and all series at the smallest
   published size.
5. Inspect a grayscale or common CVD simulation and verify that markers,
   dashes, labels, or shapes preserve every distinction.
6. Confirm the caption and screen-reader description communicate the takeaway
   without relying on color names.

If automatic recoloring is genuinely wrong for a special TikZ figure, add a
`%! no-theme` line to its `.tex` source and supply a fully authored light/dark
solution yourself. That escape hatch opts out of both palette and neutral
mapping.

## Canonical files

- `src/lib/figure-palette.mjs` — sole palette manifest + generated CSS/theme renderers
- `styles/tokens.css` — public `--fig-*`, `--series-*`, and compatibility tokens
- `src/lib/figure.mjs` — exact palette recognition and SVG theme injection
- `scripts/sync-figure-tokens.mjs` — checks or refreshes the generated token block
- `scripts/build-figures.mjs` — PDF/TikZ conversion pipeline
- `components/Figure.astro` — inlining plus accessible `<title>`/`<desc>`
- `tests/figure-palette.test.mjs` — token, mapping, theme, and contrast contract

## See also

- [Recipe 03 — Asset pipelines](03-asset-pipelines.md)
- [Recipe 04 — Component library](04-component-library.md)
- [Recipe 16 — TikZ figures](16-tikz-figures.md)
