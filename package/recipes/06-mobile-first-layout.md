# Recipe 06 — Mobile-first Tufte layout + sidebar

**Profile**: any (layout is profile-agnostic; sidebar groups chapters differently per profile).

**TL;DR**: Three-tier Tufte width (65/80/90ch) + 28/24/26ch sidenote column + left chapter-nav sidebar at ≥1024px. Mobile (<48rem) collapses to single column with inline sidenote asides; sidebar hides. All pure CSS, zero JS.

## The three layers

1. **Floating chrome** (top-right, `position: fixed`): theme toggle + search + tools-profile islands (`ToolFilter`, `VersionSelector`) when `BOOK_PROFILE !== 'academic'`.
2. **Left sidebar** (`Sidebar.astro`): chapter nav grouped by part. Sticky to top, ≤100vh, independently scrollable. Hidden below 64rem (1024px).
3. **Main content** (`.prose`): Tufte 2-column. Main text at `--measure-main`, sidenote column at `--measure-side`, both responsive to viewport tier.

## Three-tier width strategy

Stock Tufte fixes `--measure-main` at 65ch (~520px). On 1440px+ monitors with a 16rem sidebar, that leaves ~600px of empty page margin — readable but wasteful. The scaffold tiers the measure:

| Tier | Trigger | `--measure-main` | `--measure-side` | Sidebar | Notes |
|---|---|---|---|---|---|
| 1 (default) | ≥48rem | 65ch | 28ch | hidden | Laptop-friendly typographic measure |
| 2 (sidebar) | ≥64rem | 65ch | 28ch | 16rem | Sidebar appears; main column unchanged |
| 3 (wide) | ≥90rem (1440px) | 80ch | 24ch | 18rem | Wider sidebar + main column |
| 4 (ultrawide) | ≥120rem (1920px) | 90ch | 26ch | 18rem | At Tufte's 90ch upper limit of comfortable reading |

The 90ch ceiling is firm — beyond that, line length crosses the eye's tracking limit and readers lose place. Don't push higher.

**Mobile (<48rem)**: sidenotes reflow inline as colored asides via `@media (max-width: 48rem)` in `layout.css`. Sidebar is `display: none` below 64rem so phones get pure single-column content.

## Verification methodology (Playwright)

Width tuning was empirical, not theoretical. The breakpoint values came from comparing rendered chapters at four viewports (375 / 1280 / 1440 / 1920px) and measuring main-column utilization. Final ratios:

- 1280px: 70% (no sidebar) — comfortable
- 1440px: 89% (with sidebar) — was 62% pre-fix
- 1920px: 72% (with sidebar) — was 47% pre-fix

Re-tune with Playwright + `browser_take_screenshot` at the four viewports above whenever the design changes. Snapshots committed to `audits/` if a major retune.

## Per-page sidebar toggle

```astro
<Base title="..." showSidebar={false}>
  <!-- landing pages, splash screens, search results — no nav -->
</Base>
```

Default is `showSidebar={true}`. Set it false on full-bleed surfaces — landing pages, splash screens, search results — that have no chapter context (`Base.astro` still emits the page's single `<main>` landmark in that branch). Every chapter route inherits the default (true).

## Customizing the sidebar

`Sidebar.astro` reads `import.meta.env.BOOK_PROFILE` to decide grouping:

- **Academic profile**: groups by string-enum `part` (`foundations`/`ssm-core`/`beyond-ssm`/`integration`/`synthesis`). Sorts by `week`. Renders `W01`, `W02` prefixes.
- **Tools/minimal profile**: groups by numeric `part`. Sorts by `chapter`. Renders `Ch1`, `Ch2` prefixes.

Edit `siteTitle` / `siteSubtitle` constants at top of `Sidebar.astro` for branding. For per-page overrides, lift to Astro.props.

## Common gotchas

- **Sidebar shows under chapter content at exactly 1023px**: the breakpoint is `min-width: 64rem` = 1024px. At 1023px sidebar is hidden, chapter is full width. This is intentional — the cutoff is the rough boundary between tablet and laptop.
- **Sidebar overflow on long chapter titles**: `.sidebar-chapter-title` wraps; the 2.4em prefix grid column stays fixed. If you need shorter, edit `Sidebar.astro` line `grid-template-columns: 2.4em 1fr` and increase the prefix column.
- **Forgetting `class="layout-main"` on the main wrapper**: causes `.prose` to fight the grid. `Base.astro` handles this; don't bypass the layout wrapper.
- **Custom-width pages**: if you need a layout outside Tufte (e.g. a dashboard), use `<Base showSidebar={false}>` and write your own container CSS. Don't reach into `.prose`.

## Canonical files

- `src/styles/tokens.css` — three-tier `--measure-main` / `--measure-side` via `@media (min-width: 90rem|120rem)`
- `src/styles/layout.css` — `.layout-with-sidebar` grid + `.prose` Tufte rules + mobile sidenote reflow
- `src/components/Sidebar.astro` — profile-aware chapter nav
- `src/layouts/Base.astro` — `showSidebar` prop wiring

## Reference implementation

[`~/Claude/post_transformers/guides/web/`](../../post_transformers/guides/web/) deployed at `post-transformers-guide.brandon-m-behring.workers.dev`. Three-tier breakpoint tuned via commits `d9d085b` (initial Tufte) → `8f3c6b1` (sidebar) → final ratios verified at four viewports.
