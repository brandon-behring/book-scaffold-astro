# Responsive reading & content-authoring standards

How the book/guide family presents information — prose, equations, code, tables, figures, margin
notes, navigation — across phone, tablet, and desktop. This is the **design source-of-truth** for the
scaffold's reading experience and the **authoring standards** book authors (and the independent-review
pass) follow. Backed by sourced research (see *References*).

> Status: this doc defines the target. The CSS/config/CI items in *Status & backlog* are **planned, not
> yet shipped** unless marked ✅.

## Principles
1. **Prose clarity is the anchor.** The reading measure is tuned for sustained reading; everything else
   adapts around it.
2. **Static + fast.** Math renders at build time (KaTeX, no client JS). We don't trade that for
   convenience.
3. **Reflow, don't force horizontal page-scroll.** Wide content (code, equations, tables) scrolls *within
   its own block* or breaks out to a bounded width — it never makes the whole page scroll sideways.
4. **Author for the narrowest reasonable device, render for all.** Phones are accepted-hard (some wide
   content scrolls there); tablet-portrait is the no-scroll target.

## Format bands
Contiguous `min-width` breakpoints (matching `tokens.css`): `phone <768` · `tablet-portrait 768–1023` ·
`tablet-landscape 1024–1279` · `desktop 1280–1439` · `wide 1440–1919` · `ultrawide ≥1920`.

## Content-type × format spec

| Content | Treatment |
|---|---|
| **Prose** | Reading measure `--measure-main`: **65ch (<1440) → 80ch (≥1440) → 90ch (≥1920)** *(current `tokens.css`)*; body ~18px; line-height 1.5–1.6. *Proposed tweak (parked): cap at ≤75ch — 80/90ch exceed the ~66ch readability optimum.* |
| **Code** | **Author line-length = 80** (see standards). Block breaks out of the prose measure to `--measure-code` so 80-char code fits at 14px from tablet-landscape up (tablet-portrait is near the limit). Phone: 12px + horizontal scroll for the rare straggler, with an edge **scroll-shadow** hint. `overflow-x:auto`, never wrap, never two device-specific versions. (Sizing: 80 chars × ~8.4px @14px ≈ 672px + ~32px padding + ~16px scrollbar ≈ **`--measure-code: 48rem`** for headroom.) |
| **Equations** | Display math **authored multiline** (`aligned`/`split`/`gather`) to fit ~tablet-portrait width (see standards). KaTeX static. Overflow fallback = **`overflow-x:auto`** (keep KaTeX's `white-space:nowrap`) + scroll-shadow — **never `white-space:normal`** (it destroys KaTeX's span layout). Phone may scroll the widest. |
| **Tables** | Wrap in `overflow-x:auto`; font-shrink on mobile. ⚠️ A `position:sticky` `thead` does **not** stick vertically inside a horizontal-scroll wrapper (CSS limitation — the wrapper isn't the scrollport) unless the wrapper is also height-constrained. Keep columns minimal — a table that needs desktop scrolling is a smell. |
| **Figures** | `max-width:100%; height:auto`; optional desktop breakout into the gutter (`.wide`/`.column-page`). |
| **Sidenotes / margin notes** | Float into the right gutter ≥768px; reflow inline below (Gwern "no effort" principle); ≤~200 words. *(At 768–1023 the gutter is tight against a 65ch measure — acceptable; the `.prose` collapses to measure-only below 768.)* |
| **Navigation** | Sidebar pinned ≥**1024px**; drawer below — modal overlay; ≥44px toggle; focus-trap, `aria-expanded`, Escape-to-close, body scroll-lock, return-focus-on-close. Section-map / full gutter ≥1280. |

## Authoring standards (for authors + the independent-review checklist)

### Equations — fit the tablet, multiline over scroll
KaTeX (build-time) **cannot auto-break** display equations, so breaking is an *authoring* act:
- Break long display math with `aligned` / `gather` / `gathered` (and `split` **inside** an `equation`
  or `aligned`), at **relation/operator boundaries** (`=`, `+`, `−`, `\le`, …), so each line is a
  readable unit.
- Target: every display equation **fits ~tablet-portrait width (~700px)** → no horizontal scroll on
  tablet or larger. (Phones may scroll the very widest — accepted, with a shadow hint.)
- **Not supported in KaTeX (≤0.16.x):** `multline`, `breqn` — use `aligned`/`split` instead.
- ✅ good: a 3-term derivation split across `aligned` lines at `=`.
  ❌ bad: a single 140-char `$$…$$` that overflows and scrolls.
- **Review-checklist item:** *"Every display equation fits / multilines at the tablet measure (no
  sideways scroll on tablet)."* To be backed by a **planned** warning-level CI check (renders at
  tablet-portrait, flags any `.katex-display` wider than the measure).

### Code — author to 80 columns
- **Line-length = 80** (ruff/black `line-length = 80`). Rationale: the scientific-Python + technical-book
  norm (pandas/scikit-learn/matplotlib ≈ 79; numpy/scipy more lenient; publishers ~79–80), and ~80 mono
  chars ≈ tablet-portrait width → code fits at full size on a tablet without shrinking. The scaffold owns
  the responsive break-out / scroll-shadow; authors just keep lines ≤ 80. No device-specific variants.

### Tables
- Keep column counts low; prefer fewer, wider-meaning columns. The scaffold wraps wide tables in a
  horizontal-scroll container — but a table that *needs* scrolling on desktop is a smell.

## Decisions log (sourced — see References)
- **Equations = authoring-discipline + KaTeX, not MathJax.** MathJax v4 (`displayOverflow:linebreak`) is
  the only engine that auto-wraps, but it's client-side JS (~300–900ms) and abandons static math.
- **Code line-length = 80**, not 88 or 72. *(PEP 8 = 79; Black/Ruff 88 is explicitly desktop-IDE-comfort;
  pandas/sklearn ≈ 79; publishers ~79–80. 80 ≈ iPad-portrait width.)* Local audit: existing code is mostly
  ≤79 (dml p95 = 72), so reflow churn is modest.
- **No two device-specific code versions** — splits source-of-truth, reflows differently per device; no
  major docs platform does it (all use scroll).
- **Nav: pin the sidebar at 1024** (not 1280) so tablet-landscape keeps a persistent sidebar.
- **Prose-measure cap (80/90→≤75ch) + explicit line-height** — parked, low priority.

Peers surveyed: Jupyter Book/MyST, Quarto, Bookdown, Distill, arXiv-HTML/ar5iv, Tufte CSS, Gwern,
mathigon, scientific-Python docs.

## Status & backlog (all PLANNED unless ✅)
- 🔲 **Code readability:** `--measure-code` break-out + scroll-shadow + responsive code font;
  default `line-length = 80`.
- 🔲 **Equation support:** `.katex-display` `overflow-x:auto` fallback + scroll-shadow; the authoring
  standards above; the planned equation-overflow CI check.
- 🔲 **Tables:** scroll wrapper (+ height-constrained sticky thead where wanted).
- 🔲 **Nav:** pin sidebar at 1024 (in `feat/v4.26`).
- 🔲 **Prose:** cap ≤75ch + explicit line-height *(parked)*.

## References
- Line length / prose: Butterick *Practical Typography* (line-length); Bringhurst (66 CPL); web.dev
  `learn/design/typography`; Baymard "line-length readability"; NN/g.
- Code line-length: PEP 8 (`peps.python.org/pep-0008`); Black style doc (`black.readthedocs.io`); Ruff
  formatter (`docs.astral.sh/ruff/formatter`); VanderPlas "Exploring Line Lengths in Python Packages".
- KaTeX line-breaking: `katex.org/docs/issues`, KaTeX GitHub #1023 / #208 / #2005; supported envs
  `katex.org/docs/supported`.
- MathJax line-breaking: `docs.mathjax.org/en/latest/output/linebreaks.html`.
- Sidenotes / nav: `edwardtufte.github.io/tufte-css`; `gwern.net/sidenote`; NN/g "breakpoints in
  responsive design"; Material 3 navigation-drawer guidelines.
- Scroll-shadow: CSS-Tricks "scroll shadows" (Lea Verou layered-gradient technique).
- WCAG 1.4.10 Reflow: `w3.org/WAI/WCAG21/Understanding/reflow.html` (math/code exempt as 2-D content).
