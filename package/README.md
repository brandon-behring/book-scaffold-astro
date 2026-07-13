# `@brandon_m_behring/book-scaffold-astro`

Astro 6 + MDX infrastructure for long-form technical books: typed presets,
Tufte-inspired layouts, citations and cross-references, search, print/PDF
output, study-guide components, and fail-loud authoring checks.

Start a book with the lock-step CLI:

```bash
npx @brandon_m_behring/create-book my-book --preset=academic
cd my-book
npm install
npm run dev
```

Available presets are `academic`, `tools`, `minimal`, `course-notes`, and
`research-portfolio`. See the
[repository README](https://github.com/brandon-behring/book-scaffold-astro)
for the current release overview, and
[PACKAGE_DESIGN.md](https://github.com/brandon-behring/book-scaffold-astro/blob/main/PACKAGE_DESIGN.md)
for the complete API contract. Upgrading an existing v4 book? Follow
[MIGRATION-v4-to-v5.md](./MIGRATION-v4-to-v5.md).

v5 requires an explicit preset. A built-in/custom Style, schema option,
`BOOK_PRESET`, or corpus manifest may supply it; an absent preset fails instead
of silently selecting `minimal`. The deprecated v4 `deploy` book/Style field is
removed—configure the real provider surface and Astro `site`/`base` instead.

## Multi-book corpora

Several books can share one app, deployment, preset/Style chain, and Pagefind
index through one branded manifest:

```ts
import { defineBookCorpus } from '@brandon_m_behring/book-scaffold-astro';

export const corpus = defineBookCorpus({
  preset: 'research-portfolio',
  books: [
    { id: 'evaluation', title: 'Evaluation Engineering' },
    { id: 'llm-apps', title: 'LLM Application Engineering' },
  ],
});
```

Pass that same `corpus` to `defineBookConfig` and `defineBookSchemas`.
Namespaced chapters, apparatus routes, navigation, generated JSON, diagnostics,
local `<BookLink>` targets, and Pagefind results remain book-scoped. See
[Recipe 21](./recipes/21-multi-guide-single-app.md) for content layout, route
ownership, `--book` tooling, shared sources, and migration.

## Content readiness and CLI

`book-scaffold qa` combines the existing validation contract with stable
chapter, link, learning-objective, component, and JSON-fixture metrics. Human
output is the default; schema-v1 JSON is deterministic and keeps stdout clean
for CI:

```bash
npm exec -- book-scaffold qa
npm --offline exec -- book-scaffold qa --format json
npm exec -- book-scaffold init-qa
```

In corpus mode `qa` checks every manifest book by default, while `--book <id>`
selects one exact id. `init-qa` creates the portfolio-engine interoperability
file `guide_qa.yaml`; its generated checks use `npm --offline exec` and an
existing file is preserved unless `--force` is explicit. See
[Recipe 25](./recipes/25-qa-readiness.md) for verdicts, exit codes, the
top-level `shared` aggregate, and CI wiring.

The installed `book-scaffold` dispatcher owns these commands:

| Command | Purpose |
|---|---|
| `validate` | Pre-flight authored content, references, figures, and links |
| `qa` | Emit a human or schema-v1 readiness verdict |
| `init-qa` | Generate deterministic `guide_qa.yaml` interoperability config |
| `build-labels` | Build cross-reference and heading indexes |
| `build-bib` | Build bibliography and source-manifest data |
| `build-tips` | Build the tips index |
| `build-exercises` | Build the exercises index |
| `build-figures` | Convert and theme application-wide figure assets |
| `render-notebooks` | Render application-wide notebook companions |

Astro builds emit a Cloudflare-compatible `dist/_headers` with audited
security defaults. A consumer-owned `public/_headers` wins unchanged;
`defineBookConfig({ securityHeaders: false })` disables scaffold emission,
and `securityHeaders.contentSecurityPolicy` replaces only the default CSP.
See [Recipe 05](./recipes/05-deploy-cloudflare.md#default-security-headers).

## Interactive demos

The opt-in `@brandon_m_behring/book-scaffold-astro/demo` entry exports
`DemoFrame`, `Slider`, `StatCards`, and `useThemeColors` for consumer-owned
Preact islands. Import `styles/demo.css` explicitly; no demo is mounted and no
domain kernel or data loader is bundled automatically. See
[Recipe 23](./recipes/23-interactive-demo-substrate.md).

## Licensing

Code, configuration, and scripts are MIT-licensed. Recipes, pedagogy, examples,
and substantive documentation are CC BY 4.0. Both scoped license files ship in
the package as `LICENSE` and `LICENSE-CONTENT`.
