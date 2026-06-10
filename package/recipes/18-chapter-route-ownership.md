# Recipe 18 — Chapter-route ownership (v4.3.0+)

Since v4.3.0, `book-scaffold-astro` **auto-injects** the per-chapter route `/chapters/[...slug]/` when `routes.chapters: true` is in `defineBookConfig`. Consumers that pre-date v4.3.0 (or were scaffolded from older templates) may carry their own `src/pages/chapters/[...slug].astro` that **shadows** the auto-injected one — Astro's filesystem routing picks the consumer file over `injectRoute`, with no error or warning until v4.6.0.

This recipe explains the three valid states and how to pick one.

---

## TL;DR

If your `src/pages/chapters/[...slug].astro` is a stock copy from a pre-v4.3.0 template (mechanical boilerplate, no custom layout work), **delete it**. The scaffold's auto-injected route handles every academic / tools / research-portfolio consumer's per-chapter rendering identically.

If you customized the file (e.g., book-specific chapter chrome, citation styling, sidebar variations), **keep it** AND set `routes: { chapters: false }` in your `defineBookConfig` to signal the override is intentional.

The `book-scaffold validate` CLI emits a warning (v4.6.0+) when it detects a consumer-owned file without the `chapters: false` override, prompting you to pick one of the two states.

---

## Three states

### State 1 — Default (90% case, recommended)

No `src/pages/chapters/[...slug].astro` in your consumer repo. Scaffold's auto-injected route handles per-chapter rendering. `routes.chapters` defaults to whatever your profile sets (`true` for academic by default).

```
your-book/
└── src/
    └── pages/
        └── chapters.astro    ← optional: the /chapters/ index page (also auto-injected if missing)
        # no chapters/ directory; scaffold provides /chapters/[...slug]/
```

Pros: zero per-consumer code. Future scaffold improvements (e.g., richer chapter sidebars, better TOC rendering) propagate automatically on the next scaffold bump.

### State 2 — Intentional override (custom chapter layout)

`src/pages/chapters/[...slug].astro` exists in your consumer repo AND `defineBookConfig({ routes: { chapters: false } })` is set. The consumer file owns the route; scaffold's auto-injected route is suppressed.

```ts
// astro.config.mjs
export default await defineBookConfig({
  styles: [academicStyle],
  site: 'https://your-book.example/',
  routes: { chapters: false },   // ← signal: I own the chapter route
});
```

```
your-book/
└── src/
    └── pages/
        └── chapters/
            └── [...slug].astro    ← consumer-owned; scaffold defers
```

Pros: full control over per-chapter chrome, sidebar, TOC layout, etc. Cons: must hand-maintain when scaffold ships chapter-level improvements (the consumer file is now your source of truth for chapter rendering).

### State 3 — Anti-pattern (shadow, fixed by v4.6 validator warning)

`src/pages/chapters/[...slug].astro` exists in your consumer repo BUT `routes.chapters` is undefined or `true`. Astro's filesystem routing wins, so the consumer file renders — but the scaffold is also trying to inject a route at the same pattern. Functionally works today (Astro picks the consumer file), but:

- Future scaffold improvements to chapter rendering silently no-op for this consumer.
- Dual-source ownership is confusing for future maintainers.
- `book-scaffold validate` emits a warning in v4.6.0+.

**Fix**: pick State 1 (delete the file) or State 2 (set `chapters: false`).

---

## Migration from pre-v4.3.0 templates

Reference consumers `double_ml_time_series` (Phase 1f, 2026-05-26) and `ssm-foundations` (Phase 1c, 2026-05-26) both migrated from State 3 → State 1 — the consumer-owned `src/pages/chapters/[...slug].astro` was a mechanical copy of the same boilerplate that scaffold v4.3.0+ auto-injects, so deletion was lossless.

Migration steps:

1. `diff` your consumer's `src/pages/chapters/[...slug].astro` against the scaffold's `package/pages/chapters/[...slug].astro` to confirm no customization. If they're equivalent (ignoring trivial formatting), proceed.
2. `rm src/pages/chapters/'[...slug].astro'` (note the shell-escaped brackets).
3. `git commit -m "chore: delete chapter-route override (scaffold v4.3.0+ auto-injects)"`.
4. Push + redeploy. The scaffold's auto-injected route takes over without behavior change.

If your file has real customization, prefer State 2: keep the file and add `routes: { chapters: false }` to `defineBookConfig`.

---

## The landing route (`/`) follows the same rules (v4.20.0, #129)

Everything above applies verbatim to a consumer-owned `src/pages/index.astro` vs the scaffold's auto-injected `/` landing page — with one extra wrinkle: **Astro has announced that static-route collisions become a hard error in a future version**, so the State-3 shadow isn't just confusing here, it's a latent build break.

- **State 1** — no consumer `src/pages/index.astro`; the scaffold's minimal landing renders from your book config.
- **State 2** — your custom landing page exists AND `defineBookConfig({ routes: { landing: false } })` is set. No injected route, no collision, no future break.
- **State 3** — your file exists but `routes.landing` is undefined/true. Your page wins today with a `[router]` collision WARN on every build; it stops building when Astro flips the warning to an error. `book-scaffold validate` warns about this state in v4.20.0+.

**Fix**: add `routes: { landing: false }` next to your custom landing page.

---

## Why this matters

Layer-3 cleanup is part of [issue #76](https://github.com/brandon-behring/book-scaffold-astro/issues/76)'s v4.6 bundle. Related companion: [recipe 19 — prevalidate-hook](./19-prevalidate-hook.md), which fixes another silent-CI gap surfaced during the same first-deploy sessions.
