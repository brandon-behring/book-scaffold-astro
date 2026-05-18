# Recipe 01 — Add math to your book (KaTeX)

**Profile**: academic (gated by `BOOK_PROFILE=academic`)

**TL;DR**: Math is wired but disabled by default. Set `BOOK_PROFILE=academic` and the build adds `remark-math` + `rehype-katex` (strict mode) with the SSM macro library at `src/lib/katex-macros.ts`.

## How it works

The conditional integration lives at the top of `astro.config.mjs`:
- Reads `process.env.BOOK_PROFILE ?? 'minimal'`
- For `academic`: dynamically imports `remark-math`, `rehype-katex`, and `ssmMacros`; adds them to the markdown pipeline
- KaTeX CSS (`katex/dist/katex.min.css`) is always loaded by `Base.astro` — academic books need it; minimal/tools books carry the cost (~60 KB) without rendering math (the CSS is inert without matching DOM)

## Enable math in your book

1. Set `BOOK_PROFILE=academic` at run time:
   ```bash
   BOOK_PROFILE=academic npm run dev      # local hot-reload
   BOOK_PROFILE=academic npm run build    # production build
   ```
   Or persist it in `.env`:
   ```
   BOOK_PROFILE=academic
   ```

2. Author math in MDX with `$...$` (inline) and `$$...$$` (display):
   ```mdx
   The continuous SSM $\dot{\statevec} = \statemat \statevec$
   has eigenvalues...

   $$
   y_t = \outputmat \statevec_t + \feedmat u_t
   $$
   ```

3. Strict mode is on by default (`strict: 'error'` in `rehypeKatex` options). Unknown macros, malformed expressions, and unsupported AMS environments fail the build with a precise error. This is intentional — catch typos at write-time, not in production.

## Macro library

`src/lib/katex-macros.ts` defines 36 macros:
- 20 SSM-specific from the post-transformers academic reference: `\statevec`, `\statemat`, `\inputmat`, `\outputmat`, `\feedmat`, `\stepsize`, `\discA`, `\discB`, `\seqlen`, `\statedim`, `\inputdim`, `\scanop`, `\elemwise`, `\monodromy`, `\floquet`, `\lyapexp`, `\jacobian`, `\ddt`, `\pderiv`, `\spectralradius`
- 16 general math: `\R`, `\C`, `\N`, `\Z`, `\E`, `\Prob`, `\norm`, `\ip`, `\abs`, `\argmax`, `\argmin`, `\diag`, `\tr`, `\spec`, `\rank`, `\bigO`
- 1 compatibility alias: `\bm` → `\boldsymbol` (KaTeX doesn't ship `\bm`)

To extend for your book, edit `src/lib/katex-macros.ts` and add new entries to the `ssmMacros` object:
```ts
export const ssmMacros = {
  // existing macros...
  '\\mybook': '\\mathbb{B}',           // 0-arg macro
  '\\myfunc': '\\mathrm{my}(#1)',      // 1-arg macro
};
```

## Common gotchas

- **`\bm{x}` doesn't ship with KaTeX.** The macro library aliases it to `\boldsymbol{x}` (visually identical in stix-two / Computer Modern fonts).
- **`\psmallmatrix` not supported by KaTeX.** Convert to `\begin{pmatrix} ... \end{pmatrix}` in your MDX source.
- **Equation auto-numbering across a document is not supported by KaTeX.** Each `$$...$$` block is independent. Use `\tag{N}` for explicit numbering, or a per-chapter remark plugin (deferred; see PROFILES_DESIGN.md §6).
- **`{,}` (LaTeX thousands separator) breaks MDX** — MDX parses `{...}` as a JSX expression. Use `1,000` not `1{,}000`.
- **Math inside JSX components needs care.** `<Theorem>$x^2$</Theorem>` works because remark-math runs after MDX parses JSX, but escape any `{` or `}` in arguments.

## Canonical files

- `astro.config.mjs:14-32` — profile branch + plugin wiring
- `src/lib/katex-macros.ts` — full macro library (36 entries)
- `src/layouts/Base.astro:24-30` — KaTeX CSS import
- `package.json` — `katex ^0.16`, `remark-math ^6`, `rehype-katex ^7` deps

## Reference implementation

[`~/Claude/post_transformers/guides/web/`](../) at commit `111ba26` (math first wired) through `2eaef5d` (current). The reference book has 6 academic chapters using these macros and exercises every edge case the scaffold supports.
