# book-scaffold-astro

**npm package** for long-form technical books. Astro + MDX + Paged.js + Pagefind with Tufte-inspired typography, profile-aware pedagogy (academic vs tools-comparative), KaTeX math, BibTeX citations, and Cloudflare Workers + Static Assets deploy.

**Current release**: [`@brandon_m_behring/book-scaffold-astro@4.0.0`](https://www.npmjs.com/package/@brandon_m_behring/book-scaffold-astro) (2026-05-23) — **BREAKING**: `preset:` shorthand replaced by typed `defineStyle()` composition. Migrating from v3.x? → [`MIGRATION-v3-to-v4.md`](package/MIGRATION-v3-to-v4.md). Sibling CLI: [`@brandon_m_behring/create-book@4.0.0`](https://www.npmjs.com/package/@brandon_m_behring/create-book). Both ship in lock-step via OIDC trusted publishing on tag push. See [`PACKAGE_DESIGN.md`](PACKAGE_DESIGN.md) for the full API contract and [`CHANGELOG.md`](CHANGELOG.md) for the release history.

## Start a new book

```bash
npx @brandon_m_behring/create-book my-book --preset=academic
cd my-book
npm install
npm run dev
```

`--preset` (or v3.4.0+ alias `--profile`) is one of `academic` / `tools` / `minimal` / `course-notes` / `research-portfolio`. The scaffold emits ~13 templated files including a v4 `astro.config.mjs` that composes the matching built-in style. See [recipes/15-defining-styles.md](package/recipes/15-defining-styles.md) for the full Style composition pattern (workspace-local vs npm-package styles, per-key merge semantics, escape hatches).

## Consumer config (what you own)

```js
// astro.config.mjs (3 lines — v4.0.0)
import { defineBookConfig, academicStyle } from '@brandon_m_behring/book-scaffold-astro';
export default await defineBookConfig({
  styles: [academicStyle],
  site: 'https://my-book.example.com',
});
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

- **53 components** at one flat path (`./components/<Name>.astro`) — Cite / XRef / Figure / Theorem / 18 callouts (academic + tools families) / 2 Preact islands / nav + headers / per-chapter `Provenance` audit block (v4.8.0)
- **8 stylesheets** auto-injected by profile via the dual-purpose Astro Integration (route + style injection)
- **Default pages** auto-injected: `/references` / `/search` / `/print` (all profiles); `/convergence` (tools profile); `/chapters` (tools profile by default, opt-in for academic via `routes.chapters: true` — schema-aware as of v3.5.2)
- **Profile-aware Zod schemas** — academic 7-state status / tools volatility + T1-T4 source tiers
- **Tufte three-tier layout** — 65ch (default) / 80ch (≥90rem) / 90ch (≥120rem)
- **KaTeX 36-macro library** (academic profile)
- **BibTeX citation pipeline** via citation-js (academic profile)
- **Pagefind full-text search** + **Paged.js PDF export**
- **`book-scaffold` CLI** dispatcher with sub-commands: `validate`, `build-labels`, `build-bib`, `build-figures`, `render-notebooks`
- **Cloudflare Workers + Static Assets** deploy via `wrangler.toml`
- **Warm Tol 5-hue palette** (colorblind-safe; light + dark modes)

### Per-chapter provenance audit trail (v4.8.0)

Every chapter auto-renders a collapsible "How this was made" block (process,
not freshness — `ChapterHeader` still owns the freshness badge). It is
**opt-out**: a chapter with no `provenance` shows a fallback ("Audit history not
yet recorded"), so an audit trail is visibly expected everywhere. Add the
optional `provenance` object to any chapter's frontmatter:

```yaml
provenance:
  ai_tools: ['Claude Code (Opus 4.8)', 'research-kb']
  prompts_archive: docs/sessions/2026-05-22--ch07.md   # repo-relative path or URL
  decisions_log: DECISIONS.md#ch07-derivation           # repo-relative path or URL
  audit_history:
    - { date: 2026-05-15, type: routine, file: audits/AUDIT_2026-05-15.md }
    - { date: 2026-05-22, type: independent, file: audits/AUDIT_2026-05-22.md }
  citation_backstop: research-kb                         # research-kb | manual | unverified
```

Repo-relative paths render as `<code>` references (they don't resolve on the
built site); only `http(s)` values become links. Distinct from
`AICollaborationDisclosure` (book-level, manual). See the populated example in
`demo/src/content/chapters/v46-seo-demo.mdx`.

## Reference consumers (Phase G migration, 2026-05-19)

| Book | Profile | Pages | Dist |
|---|---|---|---|
| [`post-transformers-guide`](https://post-transformers-guide.brandon-m-behring.workers.dev) (6 chapters) | academic | 12 | 9 MB |
| [`ssm-foundations`](https://ssm-foundations.brandon-behring.dev) (6 of 17 chapters) | academic | 21 | ~5 MB |
| [`book-template-astro`](https://github.com/brandon-behring/book-template-astro) — *Agentic Coding* (23 chapters) | tools | 29 | 3.3 MB |

## Deploy

The shipped `wrangler.toml` template produces a Workers + Static Assets deploy via either `npx wrangler deploy` (one-shot from local) or Cloudflare Workers Builds (auto-deploy on `git push origin main`).

For Brandon's books, the public URL follows a per-project-subdomain pattern: each book deploys to `<repo-slug>.brandon-behring.dev`. See [the Subdomain convention in brandon-behring.dev/README.md](https://github.com/brandon-behring/brandon-behring.dev#subdomain-convention) for the slug rule, dashboard click-path, and registry. Consumer books built from this scaffold should follow the same pattern unless deploying to a different domain.

Both books consume `@brandon_m_behring/book-scaffold-astro@^3.6.0` with ≤5 lines of book-side config. The v3.5/v3.6 cycle added [`double-ml-time-series`](https://github.com/brandon-behring/double-ml-time-series) as the third pilot — first non-SSM academic book through the scaffold, surfacing #20/#22/#24 in 24 hours.

## Provenance

Version arc:

- **v0.x** (early 2026) — extracted from the *Agentic Coding* book.
- **v2.0** (2026-05-18) — profile-aware backport. Shipped as a GitHub-template-clone scaffold. Stays usable at the [`v2.0.0`](https://github.com/brandon-behring/book-scaffold-astro/releases/tag/v2.0.0) tag.
- **v3.0** (2026-05-19) — npm-package pivot. Two packages (`book-scaffold-astro` + `create-book`) at lock-step versions. v2.0's 15 design decisions stay; v3.0 adds 6 more (Q1–Q6 in [`PACKAGE_DESIGN.md`](PACKAGE_DESIGN.md)).
- **v3.3–v3.5** (2026-05-19) — closed all v3.2 follow-on issues (#1–#14) + added `course-notes` (v3.3.0, #4) and `research-portfolio` (v3.5.0, #6) presets driven by the DLAI and prompt-injection-portfolio pilots.
- **v3.5.2–v3.6.0** (2026-05-22) — `double-ml-time-series` pilot batch. v3.5.2 makes `/chapters` schema-aware for academic profile (#24); v3.5.3 honors `.env BOOK_PROFILE` in `validate` (#20); v3.6.0 adds the `katexMacros` extension point for non-SSM math notation (#22). Releases moved to OIDC trusted publishing on tag push.

## API reference

[`PACKAGE_DESIGN.md`](PACKAGE_DESIGN.md) — 18-section design doc. Audience: Phase B implementers + consumers. Each API entry includes signature + behavior + error cases + copy-pasteable example. File issues with section number citations at <https://github.com/brandon-behring/book-scaffold-astro/issues>.

## License

Dual:

- [`LICENSE`](LICENSE) — MIT, applies to code, scripts, and configuration.
- [`LICENSE-CONTENT`](LICENSE-CONTENT) — CC-BY-4.0, applies to prose / book content shipped in `pedagogy/`.
