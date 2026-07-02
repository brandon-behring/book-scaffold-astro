# Recipe 01 — Add math to your book (KaTeX)

**Profiles**: academic + research-portfolio (the presets that flag `katex: true`)

**TL;DR**: Math is wired but profile-gated. Compose your book from `academicStyle` (or `researchPortfolioStyle`) and `defineBookConfig` adds `remark-math` + `rehype-katex` (strict mode) with the scaffold's 37-macro `ssmMacros` library. Extend per-book with `defineBookConfig({ katexMacros })` — never by editing package source.

## How it works

All the wiring lives inside the package (`defineBookConfig`), not in your config file:

- `defineBookConfig` resolves the composed preset from your `styles` chain (falling back to `BOOK_PRESET`/`BOOK_PROFILE` from the environment or `.env`).
- For katex-flagged presets it dynamically imports `remark-math` + `rehype-katex` and registers them with `strict: 'error'` and the merged macro set (`ssmMacros` + your `katexMacros`).
- The integration injects `katex/dist/katex.min.css` **only** for katex presets (`package/src/integration.ts`) — tools/minimal books don't carry the ~60 KB.
- `katex`, `remark-math`, `rehype-katex` are **optional peerDependencies**: math books install them (`npm i katex remark-math rehype-katex`); other profiles skip them entirely.

## Enable math in your book

1. Use a katex preset in `astro.config.mjs` (a fresh `create-book --preset=academic` scaffold already does):
   ```js
   import { defineBookConfig, academicStyle } from '@brandon_m_behring/book-scaffold-astro';
   export default await defineBookConfig({ styles: [academicStyle], site: 'https://…' });
   ```
   Keep `.env`'s `BOOK_PRESET`/`BOOK_PROFILE` in sync — the content-collection schemas resolve the preset from it.

2. Author math in MDX with `$...$` (inline) and `$$...$$` (display):
   ```mdx
   The continuous SSM $\dot{\statevec} = \statemat \statevec$
   has eigenvalues...

   $$
   y_t = \outputmat \statevec_t + \feedmat u_t
   $$
   ```

3. Strict mode is on by default (`strict: 'error'`). Unknown macros, malformed expressions, and unsupported AMS environments fail the build with a precise error. This is intentional — catch typos at write-time, not in production.

## Macro library

The package ships `ssmMacros` — **37 macros** (`package/src/lib/katex-macros.ts`):

- 20 SSM-specific from the post-transformers academic reference: `\statevec`, `\statemat`, `\inputmat`, `\outputmat`, `\feedmat`, `\stepsize`, `\discA`, `\discB`, `\seqlen`, `\statedim`, `\inputdim`, `\scanop`, `\elemwise`, `\monodromy`, `\floquet`, `\lyapexp`, `\jacobian`, `\ddt`, `\pderiv`, `\spectralradius`
- 16 general math: `\R`, `\C`, `\N`, `\Z`, `\E`, `\Prob`, `\norm`, `\ip`, `\abs`, `\argmax`, `\argmin`, `\diag`, `\tr`, `\spec`, `\rank`, `\bigO`
- 1 compatibility alias: `\bm` → `\boldsymbol` (KaTeX doesn't ship `\bm`)

**Read or spread it** (v4.27.0+, #177) — from the main entry, or the `./lib` subpath:

```ts
import { ssmMacros } from '@brandon_m_behring/book-scaffold-astro';
```

**Extend for your book — the supported path** (#22). `katexMacros` is shallow-merged **on top of** `ssmMacros`, so your entries win on collision:

```js
export default await defineBookConfig({
  styles: [academicStyle],
  site: 'https://…',
  katexMacros: {
    '\\ate': '\\tau',                 // 0-arg macro
    '\\propensity': 'e(#1)',          // 1-arg macro
  },
});
```

Do **not** edit `katex-macros.ts` — it lives inside `node_modules` and your changes vanish on the next install. If a macro is general enough for every book, file an issue instead.

## Common gotchas

- **`\bm{x}` doesn't ship with KaTeX.** The macro library aliases it to `\boldsymbol{x}` (visually identical in stix-two / Computer Modern fonts).
- **`\psmallmatrix` not supported by KaTeX.** Convert to `\begin{pmatrix} ... \end{pmatrix}` in your MDX source.
- **Equation auto-numbering across a document is not supported by KaTeX.** Each `$$...$$` block is independent. Use `\tag{N}` for explicit numbering; a per-chapter remark plugin is tracked as #146.
- **`{,}` (LaTeX thousands separator) breaks MDX** — MDX parses `{...}` as a JSX expression. Use `1,000` not `1{,}000`.
- **Math inside JSX components needs care.** `<Theorem>$x^2$</Theorem>` works because remark-math runs after MDX parses JSX, but escape any `{` or `}` in arguments.

## Canonical files

- `package/src/lib/katex-macros.ts` — the 37-entry `ssmMacros` library
- `package/src/config.ts` — profile-gated remark/rehype wiring + the `katexMacros` merge
- `package/src/integration.ts` — KaTeX CSS injection for katex presets
- your `astro.config.mjs` — `styles: [academicStyle]` + optional `katexMacros`

## Reference implementation

[`~/Claude/post_transformers/guides/web/`](../) — the academic reference book has 6 chapters using these macros and exercises every edge case the scaffold supports.
