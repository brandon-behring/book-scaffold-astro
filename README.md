# book-scaffold-astro

**npm package** for long-form technical books. Astro + MDX + Paged.js + Pagefind with Tufte-inspired typography, profile-aware pedagogy (academic vs tools-comparative), KaTeX math, BibTeX citations, and Cloudflare Workers + Static Assets deploy.

**v3.0 (2026-05-19)**: pivot from GitHub-template-clone to npm package. The toolkit lives at [`@brandon_m_behring/book-scaffold-astro`](https://www.npmjs.com/package/@brandon_m_behring/book-scaffold-astro); a sibling CLI at [`@brandon_m_behring/create-book`](https://www.npmjs.com/package/@brandon_m_behring/create-book) scaffolds fresh consumer repos. See [`PACKAGE_DESIGN.md`](PACKAGE_DESIGN.md) for the full API contract.

## Start a new book

```bash
npx @brandon_m_behring/create-book my-book --profile=academic
cd my-book
npm install
npm run dev
```

`--profile` is one of `academic` / `tools` / `minimal`. The scaffold emits 11 templated files (~50 lines total of book-specific config); everything else comes from the package via the exports map.

## Consumer config (what you own)

```js
// astro.config.mjs (2 lines)
import { defineBookConfig } from '@brandon_m_behring/book-scaffold-astro';
export default await defineBookConfig({ site: 'https://my-book.example.com' });
```

```ts
// src/content.config.ts (2 lines)
import { defineBookSchemas } from '@brandon_m_behring/book-scaffold-astro/schemas';
export const { collections } = defineBookSchemas();
```

```
# .env
BOOK_PROFILE=academic
```

## What ships in the package

- **38 components** at one flat path (`./components/<Name>.astro`) — Cite / XRef / Figure / Theorem / 18 callouts (academic + tools families) / 2 Preact islands / nav + headers
- **8 stylesheets** auto-injected by profile via the dual-purpose Astro Integration (route + style injection)
- **Default pages** auto-injected: `/references` / `/search` / `/print` (all profiles); `/chapters` / `/convergence` (tools profile)
- **Profile-aware Zod schemas** — academic 7-state status / tools volatility + T1-T4 source tiers
- **Tufte three-tier layout** — 65ch (default) / 80ch (≥90rem) / 90ch (≥120rem)
- **KaTeX 36-macro library** (academic profile)
- **BibTeX citation pipeline** via citation-js (academic profile)
- **Pagefind full-text search** + **Paged.js PDF export**
- **`book-scaffold` CLI** dispatcher with sub-commands: `validate`, `build-labels`, `build-bib`, `build-figures`, `render-notebooks`
- **Cloudflare Workers + Static Assets** deploy via `wrangler.toml`
- **Warm Tol 5-hue palette** (colorblind-safe; light + dark modes)

## Reference consumers (Phase G migration, 2026-05-19)

| Book | Profile | Pages | Dist |
|---|---|---|---|
| [`post-transformers-guide`](https://post-transformers-guide.brandon-m-behring.workers.dev) (6 chapters) | academic | 12 | 9 MB |
| [`book-template-astro`](https://github.com/brandon-behring/book-template-astro) — *Agentic Coding* (23 chapters) | tools | 29 | 3.3 MB |

Both books consume `@brandon_m_behring/book-scaffold-astro@^3.0.0` with ≤5 lines of book-side config.

## Provenance

Three-version arc:

- **v0.x** (early 2026) — extracted from the *Agentic Coding* book.
- **v2.0** (2026-05-18) — profile-aware backport. Shipped as a GitHub-template-clone scaffold. Stays usable at the [`v2.0.0`](https://github.com/brandon-behring/book-scaffold-astro/releases/tag/v2.0.0) tag.
- **v3.0** (2026-05-19) — npm-package pivot. Two packages (`book-scaffold-astro` + `create-book`) at lock-step versions. v2.0's 15 design decisions stay; v3.0 adds 6 more (Q1–Q6 in [`PACKAGE_DESIGN.md`](PACKAGE_DESIGN.md)).

## API reference

[`PACKAGE_DESIGN.md`](PACKAGE_DESIGN.md) — 18-section design doc. Audience: Phase B implementers + consumers. Each API entry includes signature + behavior + error cases + copy-pasteable example. File issues with section number citations at <https://github.com/brandon-behring/book-scaffold-astro/issues>.

## License

Dual:

- [`LICENSE`](LICENSE) — MIT, applies to code, scripts, and configuration.
- [`LICENSE-CONTENT`](LICENSE-CONTENT) — CC-BY-4.0, applies to prose / book content shipped in `pedagogy/`.
