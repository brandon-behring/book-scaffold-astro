# Responsive reading & content-authoring standards

How the book/guide family presents information — prose, equations, code, tables, figures, margin
notes, navigation — across phone, tablet, and desktop. This is the **design source-of-truth** for the
scaffold's reading experience and the **authoring standards** book authors (and the independent-review
pass) follow. Backed by sourced research (see *Decisions log*).

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
`phone ≤640` · `tablet-portrait ~768` · `tablet-landscape ~1024` · `desktop ≥1280` · `wide ≥1440`.

## Content-type × format spec

| Content | Treatment |
|---|---|
| **Prose** | Reading measure `--measure-main` 60ch → 66ch (≥1440) → **75ch cap** (≥1920); body 16→20px; line-height 1.5–1.6. The anchor; ~66ch is the typographic optimum. |
| **Code** | **Author line-length = 80** (see standards). Block breaks out of the prose measure to `--measure-code ≈ 45rem` so 80-char code fits at 14px on tablet-portrait+ (no shrink). Phone: 12px + horizontal scroll for the rare straggler, with an edge **scroll-shadow** hint. `overflow-x:auto`, never wrap, never two device-specific versions. |
| **Equations** | Display math **authored multiline** (`aligned`/`split`/`gather`) to fit ~tablet-portrait width (see standards). KaTeX static. CSS fallback (`white-space:normal` + scroll-shadow) for un-broken stragglers; phone may scroll the widest. |
| **Tables** | Wrap in `overflow-x:auto` + `position:sticky` `thead`; font-shrink on mobile. (The worst responsive offender — keep columns minimal.) |
| **Figures** | `max-width:100%; height:auto`; optional desktop breakout into the gutter (`.wide`/`.column-page`). |
| **Sidenotes / margin notes** | Float into the right gutter ≥768px; reflow inline below (Gwern "no effort" principle); ≤~200 words. |
| **Navigation** | Sidebar pinned ≥**1024px**; drawer below (modal overlay, ≥44px toggle, a11y). Section-map / full gutter ≥1280. |

## Authoring standards (for authors + the independent-review checklist)

### Equations — fit the tablet, multiline over scroll
KaTeX (build-time) **cannot auto-break** display equations, so breaking is an *authoring* act:
- Break long display math with `aligned` / `split` / `gather`, at **relation/operator boundaries**
  (`=`, `+`, `−`, `\le`, …), so each line is a readable unit.
- Target: every display equation **fits ~tablet-portrait width (~700px)** → no horizontal scroll on
  tablet or larger. (Phones may scroll the very widest — accepted, with a shadow hint.)
- `multline` and `breqn` are **not supported** in KaTeX — use `aligned`/`split` instead.
- ✅ good: a 3-term derivation split across aligned lines at `=`.
  ❌ bad: a single 140-char `$$…$$` that overflows and scrolls.
- **Review-checklist item:** *"Every display equation fits / multilines at the tablet measure (no
  sideways scroll on tablet)."* Backed by an automated warning-level CI check (renders at tablet-portrait,
  flags any `.katex-display` wider than the measure).

### Code — author to 80 columns
- **Line-length = 80** (ruff/black `line-length = 80`). Rationale: the scientific-Python + technical-book
  norm (numpy/pandas/scikit-learn ≈ 79; publishers ~79–80), and ~80 mono chars ≈ tablet-portrait width →
  code fits at full size on a tablet without shrinking. The scaffold owns the responsive
  break-out / scroll-shadow; authors just keep lines ≤ 80.
- No device-specific code variants (one source of truth).

### Tables
- Keep column counts low; prefer fewer, wider-meaning columns. The scaffold wraps wide tables in a
  horizontal-scroll container with a sticky header — but a table that *needs* scrolling on desktop is a
  smell.

## Decisions log (sourced)
- **Equations = authoring-discipline + KaTeX, not MathJax.** MathJax v4 (`displayOverflow:linebreak`) is
  the only engine that auto-wraps, but it's client-side JS (~300–900ms) and abandons static math — not
  worth it. *(KaTeX issues #1023/#208/#3560/#2005; MathJax line-breaking docs.)*
- **Code line-length = 80**, not 88 or 72. *(PEP 8 = 79; Black/Ruff default 88 is explicitly
  desktop-IDE-comfort; numpy/pandas/sklearn ≈ 79; O'Reilly/academic publishers ~79–80. 80 ≈
  iPad-portrait width.)* Local audit: existing code is mostly ≤79 (dml p95 = 72), so reflow churn is
  modest.
- **No two device-specific code versions** — splits source-of-truth, reflows differently per device,
  doubles DOM/maintenance; no major docs platform does it (all use scroll).
- **Nav: pin the sidebar at 1024** (not 1280) so tablet-landscape keeps a persistent sidebar. *(NN/g;
  Docusaurus 996 / MkDocs 1220; folds into the v4.26 nav rebuild.)*
- **Prose-measure tweaks** (cap 78→75ch, explicit line-height) — parked, low priority.

Peers surveyed: Jupyter Book/MyST, Quarto, Bookdown, Distill, arXiv-HTML/ar5iv, Tufte CSS, Gwern,
mathigon, scientific-Python docs. Full source URLs are in the originating design session.

## Implementation status
- **v4.25.3** (this line): code break-out (`--measure-code`) + scroll-shadow + responsive code font;
  `.katex-display` CSS fallback; tables scroll + sticky thead; default `line-length = 80`.
- **Equation-overflow CI check** — warning-level Playwright render-measure at tablet-portrait.
- **Nav 1024 pin** — in `feat/v4.26`.
- Consumers: bump to the new scaffold + standardize `line-length = 80`.
