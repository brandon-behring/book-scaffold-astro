# book-scaffold-astro

**npm package** for long-form technical books. Astro + MDX + Paged.js + Pagefind with Tufte-inspired typography, profile-aware pedagogy (academic vs tools-comparative), KaTeX math, BibTeX citations, and Cloudflare Workers + Static Assets deploy.

**Current release**: [`@brandon_m_behring/book-scaffold-astro`](https://www.npmjs.com/package/@brandon_m_behring/book-scaffold-astro) — npm's `latest` tag is canonical; [`CHANGELOG.md`](CHANGELOG.md) records every release. v5 requires an explicit preset, removes the inert `deploy` config field, and adds opt-in first-class multi-book corpora. Migration guides: [`v3 → v4`](package/MIGRATION-v3-to-v4.md) and [`v4 → v5`](package/MIGRATION-v4-to-v5.md). Sibling CLI: [`@brandon_m_behring/create-book`](https://www.npmjs.com/package/@brandon_m_behring/create-book). Both publish in lock-step from a main-reachable version tag. See [`PACKAGE_DESIGN.md`](PACKAGE_DESIGN.md) for the full API contract.

## Start a new book

```bash
npx @brandon_m_behring/create-book my-book --preset=academic --author="Ada Lovelace"
cd my-book
npm install
npm run dev
```

`--preset` (or the backward-compatible `--profile` alias) is one of `academic` / `tools` / `minimal` / `course-notes` / `research-portfolio`. `--author` accepts either `--author=NAME` or `--author NAME` and defaults to `Book contributors`. The complete starter tree includes the current explicit-preset `astro.config.mjs`, paired agent guides, scoped licenses, and a turnkey PDF command. See [recipes/15-defining-styles.md](package/recipes/15-defining-styles.md) for the Style composition pattern.

## Consumer config (what you own)

```js
// astro.config.mjs (v5)
import { defineBookConfig, academicStyle } from '@brandon_m_behring/book-scaffold-astro';
export default await defineBookConfig({
  styles: [academicStyle],
  site: 'https://my-book.example.com',
});
```

```ts
// src/content.config.ts (2 lines)
import { defineBookSchemas } from '@brandon_m_behring/book-scaffold-astro/schemas';
export const { collections } = defineBookSchemas({ preset: 'academic' });
```

```dotenv
# .env
BOOK_PRESET=academic
```

The `.env` value is an optional shared alternative to the explicit schema
argument; v5 does not choose `minimal` when every preset source is absent.

## Multiple books, one app (v5)

Corpus mode gives several books one Astro build, deployment, preset/Style
chain, Pagefind index, and ordered manifest while preserving
`/chapters/<book>/<slug>/` URLs:

```ts
// src/book-corpus.ts
import { defineBookCorpus } from '@brandon_m_behring/book-scaffold-astro';

export const corpus = defineBookCorpus({
  preset: 'research-portfolio',
  books: [
    { id: 'evaluation', title: 'Evaluation Engineering' },
    { id: 'llm-apps', title: 'LLM Application Engineering' },
  ],
});
```

Pass the same branded `corpus` object to `defineBookConfig({ corpus })` and
`defineBookSchemas({ corpus })`. Chapters live beneath
`src/content/<book>/`; questions and glossary entries use their own
`<collection>/<book>/` namespaces. Routes, navigation, generated artifacts,
cross-book links, and search results stay book-scoped. See
[Recipe 21](package/recipes/21-multi-guide-single-app.md) for the full setup and
[the v4 → v5 guide](package/MIGRATION-v4-to-v5.md) for migration.

## What ships in the package

- **65 Astro components + 8 Preact components** — 70 individually exported `./components/<Name>` entries for citations, figures, pedagogy, study tools, and navigation, plus `DemoFrame` / `Slider` / `StatCards` and `useThemeColors` through the opt-in `./demo` barrel
- **13 exported stylesheets**, loaded where their ownership belongs: preset/profile integration, the base layout, opt-in routes, their component, or an explicit demo import
- **Default pages** auto-injected: `/references` / `/search` / `/print` / `/chapters` (all five presets); `/convergence` (tools); optional frontmatter and study-guide routes
- **Opt-in corpus routing** — ordered book landings, namespaced chapters and apparatus, scoped generated data, local cross-book links, and one Pagefind index with per-book filters
- **Profile-aware Zod schemas** — academic 7-state status / tools volatility + T1-T4 source tiers
- **Tufte three-tier layout** — 60ch (default) / 66ch (≥90rem) / 78ch (≥120rem), with a book-aware desktop sidebar and mobile drawer
- **KaTeX 37-macro library** (academic + research-portfolio presets)
- **BibTeX citation pipeline** via citation-js (academic profile)
- **Pagefind full-text search** + **Paged.js PDF export**
- **`book-scaffold` CLI** dispatcher with sub-commands: `validate`, `build-labels`, `build-bib`, `build-figures`, `build-tips`, `build-exercises`, `render-notebooks`; content-derived commands accept `--book` in corpus mode
- **Cloudflare deploy templates**: Workers + Static Assets for academic/tools/minimal; Pages for course-notes/research-portfolio
- **Warm–Tol semantic palette + Okabe–Ito 8-series figure palette** (color-vision-deficiency-friendly; light + dark modes)

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

The generated `wrangler.toml` is preset-aware: academic/tools/minimal use Workers + Static Assets; course-notes/research-portfolio use Pages. Recipe 05 documents both deployment flows.

For Brandon's books, the public URL follows a per-project-subdomain pattern: each book deploys to `<repo-slug>.brandon-behring.dev`. See [the Subdomain convention in brandon-behring.dev/README.md](https://github.com/brandon-behring/brandon-behring.dev#subdomain-convention) for the slug rule, dashboard click-path, and registry. Consumer books built from this scaffold should follow the same pattern unless deploying to a different domain.

The v5 single-book contract keeps the same thin consumer shape after the
explicit-preset migration. Multi-guide consumers can replace their custom
collection ids and route plumbing with the shared corpus manifest documented
in Recipe 21. The v3.5/v3.6 cycle added
[`double-ml-time-series`](https://github.com/brandon-behring/double-ml-time-series)
as the third pilot — first non-SSM academic book through the scaffold,
surfacing #20/#22/#24 in 24 hours.

## Provenance

Version arc:

- **v0.x** (early 2026) — extracted from the *Agentic Coding* book.
- **v2.0** (2026-05-18) — profile-aware backport. Shipped as a GitHub-template-clone scaffold. Stays usable at the [`v2.0.0`](https://github.com/brandon-behring/book-scaffold-astro/releases/tag/v2.0.0) tag.
- **v3.0** (2026-05-19) — npm-package pivot. Two packages (`book-scaffold-astro` + `create-book`) at lock-step versions. v2.0's 15 design decisions stay; v3.0 adds 6 more (Q1–Q6 in [`PACKAGE_DESIGN.md`](PACKAGE_DESIGN.md)).
- **v3.3–v3.5** (2026-05-19) — closed all v3.2 follow-on issues (#1–#14) + added `course-notes` (v3.3.0, #4) and `research-portfolio` (v3.5.0, #6) presets driven by the DLAI and prompt-injection-portfolio pilots.
- **v3.5.2–v3.6.0** (2026-05-22) — `double-ml-time-series` pilot batch. v3.5.2 makes `/chapters` schema-aware for academic profile (#24); v3.5.3 honors `.env BOOK_PROFILE` in `validate` (#20); v3.6.0 adds the `katexMacros` extension point for non-SSM math notation (#22). Releases moved to OIDC trusted publishing on tag push.
- **v4.0–v4.31** (2026-05-23 to 2026-07-13) — typed Style composition, expanded book and study-guide primitives, stronger route/validation/deployment contracts, interactive-demo infrastructure, and the vector-first figure system.
- **v5.0** (2026-07-13) — first-class manifest-backed corpora, mandatory explicit preset resolution, and removal of inert `deploy` configuration (#80, #211, #212).

## API reference

[`PACKAGE_DESIGN.md`](PACKAGE_DESIGN.md) — package design and API contract for implementers and consumers. API entries include signatures, behavior, error cases, and examples. File issues with section citations at <https://github.com/brandon-behring/book-scaffold-astro/issues>.

## License

Dual:

- [`LICENSE`](LICENSE) — MIT, applies to code, scripts, and configuration.
- [`LICENSE-CONTENT`](LICENSE-CONTENT) — CC BY 4.0, applies to substantive prose, recipes, pedagogy, examples, and book content.
