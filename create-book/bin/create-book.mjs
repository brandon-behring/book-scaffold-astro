#!/usr/bin/env node
/**
 * create-book — scaffold a fresh book repo that consumes
 * @brandon_m_behring/book-scaffold-astro.
 *
 * Usage:
 *   npx @brandon_m_behring/create-book <name> [--preset=academic|tools|minimal|course-notes|research-portfolio]
 *   npx @brandon_m_behring/create-book my-book --profile=academic
 *
 * Emits a complete starter tree in `./<name>/`: package/config files, demo
 * content, deploy + PDF commands, dual licenses, and paired agent guides.
 * No installation; the user runs `npm install` themselves.
 *
 * Sibling to `@brandon_m_behring/book-scaffold-astro`; D12 lock-step
 * version. See PACKAGE_DESIGN.md and master plan Phase D.
 */
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ===== Args =====

const HELP = `Usage: npx @brandon_m_behring/create-book <name> [--preset=...|--profile=...] [--author=NAME]

Arguments:
  <name>           Book repo name. Becomes the new directory + package name.

Options:
  --preset=NAME    academic | tools | minimal | course-notes | research-portfolio
                   (default: minimal). Canonical vocabulary as of v3.4.0; alias of --profile.
  --profile=NAME   Backward-compatible alias of --preset.
  --author=NAME    Book author or organization (also accepts --author NAME).
                   Defaults to "Book contributors".
  --version, -v    Print the CLI version.
  --help, -h       This message.

Example:
  npx @brandon_m_behring/create-book interview-prep --preset=academic
`;

function parseArgs(argv) {
  // v3.6.1 (closes #38): accept --preset as canonical alias of --profile.
  // Internal variable name stays `profile` for back-compat with downstream
  // template code; the canonical user-facing vocabulary is preset.
  const args = { name: null, profile: 'minimal', author: 'Book contributors' };
  const tokens = argv.slice(2);
  for (let i = 0; i < tokens.length; i += 1) {
    const a = tokens[i];
    if (a === '--help' || a === '-h') {
      process.stdout.write(HELP);
      process.exit(0);
    }
    if (a === '--version' || a === '-v') return { showVersion: true };
    const presetMatch = a.match(/^--preset=(.+)$/);
    if (presetMatch) {
      args.profile = presetMatch[1];
      continue;
    }
    const profMatch = a.match(/^--profile=(.+)$/);
    if (profMatch) {
      args.profile = profMatch[1];
      continue;
    }
    const authorMatch = a.match(/^--author=(.*)$/);
    if (authorMatch) {
      args.author = authorMatch[1].trim();
      continue;
    }
    if (a === '--author') {
      const value = tokens[i + 1];
      if (!value || value.startsWith('--')) {
        process.stderr.write('create-book: --author requires a non-empty name.\n');
        process.exit(2);
      }
      args.author = value.trim();
      i += 1;
      continue;
    }
    if (a.startsWith('--')) {
      process.stderr.write(`create-book: unknown flag ${a}\n\n${HELP}`);
      process.exit(2);
    }
    if (!args.name) args.name = a;
  }
  return args;
}

// v3.7.1 (extension paired with #51): catch up to the toolkit's 5-preset
// lineup. Pre-v3.7.1 the create-book validator only knew academic / tools /
// minimal — course-notes (v3.3.0) and research-portfolio (v3.5.0) couldn't
// be scaffolded at all, just rejected. course-notes uses tools-style fields
// (chapter + volatility + sources); research-portfolio is the union shape
// with structured inline sources.
const VALID_PROFILES = new Set([
  'academic',
  'tools',
  'minimal',
  'course-notes',
  'research-portfolio',
]);
const PROFILE_DEFAULTS = {
  academic: { withBib: true, withSources: false },
  tools: { withBib: false, withSources: true },
  minimal: { withBib: false, withSources: false },
  // course-notes uses tools-style sources (no separate bib)
  'course-notes': { withBib: false, withSources: true },
  // research-portfolio uses inline structured sources in chapter frontmatter,
  // PLUS a bib for KaTeX-supported citations
  'research-portfolio': { withBib: true, withSources: false },
};

// ===== Templates =====

function makeTemplates(name, profile, toolkitVersion, author) {

  // v4.0.0: scaffolded astro.config.mjs imports the built-in style matching
  // the chosen preset. Map preset name → camelCase export.
  const STYLE_EXPORT_NAMES = {
    academic: 'academicStyle',
    tools: 'toolsStyle',
    minimal: 'minimalStyle',
    'course-notes': 'courseNotesStyle',
    'research-portfolio': 'researchPortfolioStyle',
  };
  const styleExportName = STYLE_EXPORT_NAMES[profile];

  // v4.0.0 (#50): per-preset wrangler.toml shape. course-notes + research-portfolio
  // ship content-heavy static sites → Cloudflare Pages. Others → Workers.
  const usesPages = profile === 'course-notes' || profile === 'research-portfolio';

  const templates = {
    'package.json': `{
  "name": "${name}",
  "description": "A book scaffolded with @brandon_m_behring/create-book (${profile} profile).",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "author": ${JSON.stringify(author)},
  "license": "MIT",
  "scripts": {
    "predev": "npm run build:bib --if-present && npm run build:labels --if-present",
    "prevalidate": "npm run build:bib --if-present && npm run build:labels --if-present",
    "prebuild": "npm run validate --if-present",
    "build:bib": "book-scaffold build-bib",
    "build:labels": "book-scaffold build-labels",
    "build:figures": "book-scaffold build-figures",
    "build:notebooks": "book-scaffold render-notebooks",
    "validate": "book-scaffold validate",
    "qa": "book-scaffold qa",
    "dev": "astro dev",
    "build": "astro build && pagefind --site dist",
    "preview": "astro preview",
    "prepdf": "npm run build",
    "pdf:render": "mkdir -p dist-pdf && pagedjs-cli http://localhost:4321/print/ -o dist-pdf/book.pdf",
    "pdf": "start-server-and-test preview http://localhost:4321/ pdf:render"
  },
  "dependencies": {
    "@brandon_m_behring/book-scaffold-astro": "^${toolkitVersion}",
    "@astrojs/mdx": "^5.0.3",
    "@astrojs/preact": "^5.1.1",
    "astro": "^6.1.7",
    "preact": "^10.29.1"${
      // v3.7.1 (#51): research-portfolio also wants KaTeX (per its profile's
      // `katex: true` flag); previously only academic added these peer deps,
      // so research-portfolio scaffolds failed to dynamic-import remark-math
      // at build time.
      (profile === 'academic' || profile === 'research-portfolio')
        ? `,
    "katex": "^0.16.11",
    "rehype-katex": "^7.0.1",
    "remark-math": "^6.0.0"`
        : ''
    }
  },
  "devDependencies": {
    "pagedjs-cli": "^0.4.3",
    "start-server-and-test": "^3.0.11"
  },
  "allowScripts": {
    "puppeteer@20.9.0": true
  }
}
`,

    // v4.0.0: scaffolded astro.config.mjs uses the new defineStyle composition
    // pattern. Each preset maps to a built-in style (academicStyle, toolsStyle,
    // minimalStyle, courseNotesStyle, researchPortfolioStyle). See recipes/15.
    'astro.config.mjs': `// @ts-check
/**
 * astro.config.mjs — book-scaffold-astro consumer config (v4 API).
 *
 * Built-in styles ship one per preset. To customize, define your own style
 * in shared/styles/ (workspace pattern) or publish it as an npm package,
 * then compose: \`styles: [${styleExportName}, myCustomStyle]\`.
 *
 * See recipes/15-defining-styles.md for the full pattern catalog.
 */
import { defineBookConfig, ${styleExportName} } from '@brandon_m_behring/book-scaffold-astro';

export default await defineBookConfig({
  styles: [${styleExportName}],
  site: 'https://example.invalid',
  // This scaffold owns src/pages/index.astro, so disable the package landing
  // route explicitly. Astro plans to make duplicate static routes a hard error.
  routes: { landing: false },
});
`,

    'src/content.config.ts': `/**
 * src/content.config.ts — Content collections.
 * defineBookSchemas returns chapters + tools-collateral; extend via
 * standard JS spread + Zod \`.extend()\` if you need book-specific fields.
 */
import { defineBookSchemas } from '@brandon_m_behring/book-scaffold-astro/schemas';

export const { collections } = defineBookSchemas();
`,

    '.env': `BOOK_PROFILE=${profile}
BOOK_TITLE=${name}
`,

    '.gitignore': `# Node + Astro build artifacts
node_modules/
dist/
dist-pdf/
.astro/
.env.local

# Generated data (rebuilt by build-bib / build-labels)
src/data/*.json
!src/data/.gitkeep

# Pagefind index
public/pagefind/

# OS / editor
.DS_Store
*.swp
`,

    'README.md': `# ${name}

Built with [\`@brandon_m_behring/book-scaffold-astro\`](https://github.com/brandon-behring/book-scaffold-astro) (${profile} profile, v${toolkitVersion}).

## Getting started

\`\`\`bash
npm install
npm run dev    # http://localhost:4321
npm run pdf    # build + preview + render dist-pdf/book.pdf
\`\`\`

## Authoring

Chapters live under \`src/content/chapters/*.mdx\`. The starter \`week01-hello-world.mdx\` shows the frontmatter shape and basic component usage.

Available components are documented in the toolkit's [PACKAGE_DESIGN.md §10](https://github.com/brandon-behring/book-scaffold-astro/blob/v${toolkitVersion}/PACKAGE_DESIGN.md#10-mdx-import-patterns).

## Decision log

Significant design decisions are recorded as ADRs under \`decisions/\` — see \`decisions/README.md\` for the convention. Copy \`decisions/ADR_TEMPLATE.md\` to add a new one; the seed \`decisions/0001-*.md\` shows the format.

## Build + deploy

\`\`\`bash
npm run validate    # pre-flight content checks
npm run build       # → dist/
${usesPages ? `npx wrangler pages deploy ./dist --project-name=${name}` : 'npx wrangler deploy'}
\`\`\`

See \`wrangler.toml\` for deploy config (this scaffold uses the ${usesPages ? 'Cloudflare **Pages**' : 'Cloudflare **Workers** + Static Assets'} shape — default for the ${profile} preset).

## Licensing

Code, configuration, and scripts are MIT-licensed; authored book content and
documentation are CC BY 4.0. See \`LICENSE\` and \`LICENSE-CONTENT\`. The
generated attribution is **${author}** (set with \`--author\` when scaffolding).
`,

    'CLAUDE.md': `# ${name} — AI authoring guide

This book is built with \`@brandon_m_behring/book-scaffold-astro\` (${profile} profile, v${toolkitVersion}).

**Where things live:**

- Chapters: \`src/content/chapters/*.mdx\` — frontmatter follows the ${profile} schema
- Components, layouts, default routes: \`@brandon_m_behring/book-scaffold-astro/components/...\`
- Style customizations: \`src/styles/\` (overrides package styles)
- Bibliography: \`bibliography.bib\` (academic) → \`src/data/references.json\` via \`npm run build:bib\`
- Cross-references: ids on \`<Theorem>\` / \`<Figure>\` → \`src/data/labels.json\` via \`npm run build:labels\`
- Decision log: \`decisions/\` — numbered ADRs (see \`decisions/README.md\`); record significant choices here

**Toolkit reference:** [PACKAGE_DESIGN.md](https://github.com/brandon-behring/book-scaffold-astro/blob/v${toolkitVersion}/PACKAGE_DESIGN.md) — single source of truth for the API. File issues at https://github.com/brandon-behring/book-scaffold-astro/issues with label \`consumer:${name}\`.
`,

    'AGENTS.md': `# AGENTS.md

The canonical, cross-tool authoring guide is [\`CLAUDE.md\`](CLAUDE.md) in this
directory. Read and follow it before changing this book. The guide is
agent-agnostic despite its filename; this pointer exists so tools that discover
\`AGENTS.md\` load the same instructions without maintaining two copies.
`,

    'LICENSE': `MIT License

Copyright (c) 2026 ${author}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

This license covers code, configuration, scripts, and tooling. Book content
and substantive documentation are licensed separately under CC BY 4.0; see
LICENSE-CONTENT.
`,

    'LICENSE-CONTENT': `Creative Commons Attribution 4.0 International License (CC BY 4.0)

Copyright (c) 2026 ${author}

This license covers prose and content collections under \`src/content/\`,
substantive documentation, and other authored book material. Code and
configuration are licensed separately under MIT; see LICENSE.

You are free to share and adapt this material for any purpose, including
commercially, provided that you give appropriate credit, link to the license,
and indicate whether changes were made. You may not apply additional legal or
technological restrictions.

Full legal code: https://creativecommons.org/licenses/by/4.0/legalcode
Human-readable summary: https://creativecommons.org/licenses/by/4.0/

Suggested attribution: "${name} by ${author}, licensed under CC BY 4.0."
`,

    // v4.0.0 (#50): per-preset wrangler.toml shape. Academic / tools / minimal
    // ship as Cloudflare Workers + Static Assets (the v3 default). Course-notes
    // and research-portfolio default to Cloudflare Pages (content-heavy static
    // sites typical of those presets).
    'wrangler.toml': usesPages
      ? `# wrangler.toml — Cloudflare Pages deploy.
# Run: npx wrangler pages deploy ./dist --project-name=${name}
# Set up: https://developers.cloudflare.com/pages/

name = "${name}"
compatibility_date = "2025-12-01"
pages_build_output_dir = "./dist"
`
      : `# wrangler.toml — Cloudflare Workers + Static Assets deploy.
# Run: npx wrangler deploy
# Set up: https://developers.cloudflare.com/workers/static-assets/

name = "${name}"
compatibility_date = "2025-12-01"

[assets]
directory = "./dist"
`,

    'src/data/.gitkeep': '',

    // v3.6.1 (closes #28): scaffold the consumer's src/pages/ routes.
    // Pre-v3.6.1, create-book emitted no pages — the resulting book built with
    // zero per-chapter HTML (only auto-injected /chapters /print /search /references
    // routes). Now ships an index landing page + the [...slug].astro per-chapter
    // route. Mirrors the working pattern from package/tests/visual/fixture/src/pages/.
    'src/pages/index.astro': `---
import Base from '@brandon_m_behring/book-scaffold-astro/layouts/Base.astro';
import { normalizeBase } from '@brandon_m_behring/book-scaffold-astro';

const baseUrl = normalizeBase(import.meta.env.BASE_URL);
---
<Base title="${name}" description="A book scaffolded with @brandon_m_behring/create-book (${profile} profile).">
  <article class="prose">
    <h1>${name}</h1>
    <p>
      This is the landing page for your book. Edit it at
      <code>src/pages/index.astro</code>.
    </p>
    <p>
      Chapters live under <code>src/content/chapters/</code>. The auto-injected
      routes are <a href={baseUrl + 'chapters/'}>/chapters</a>,
      <a href={baseUrl + 'references/'}>/references</a>,
      <a href={baseUrl + 'search/'}>/search</a>, and
      <a href={baseUrl + 'print/'}>/print</a>.
    </p>
  </article>
</Base>
`,

    // v4.6.0 (issue #76 Layer 3c): removed `src/pages/chapters/[...slug].astro`
    // from the scaffold template. The book-scaffold-astro package auto-injects
    // this route since v4.3.0 (per integration.ts ROUTE_REGISTRY.chaptersSlug
    // — wired in when routes.chapters is true). Pre-v4.6 templates shipped a
    // mechanical copy that silently shadowed the auto-injected route; new
    // books on v4.6+ are clean from day one. Consumers who want a custom
    // chapter layout opt-in via State 2 of recipe 18-chapter-route-ownership.
  };

  // v4.12.0 (#91): default favicon. Base.astro links /favicon.svg on every
  // page; without this asset consumer books 404 on it. Minimal theme-neutral
  // book glyph in the warm palette. Universal across all profiles.
  templates['public/favicon.svg'] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="Book">
  <rect width="32" height="32" rx="6" fill="#1A1A19"/>
  <path d="M9 8h11a3 3 0 0 1 3 3v13H12a3 3 0 0 1-3-3V8z" fill="#FDFCF9"/>
  <path d="M9 8v13a3 3 0 0 0 3 3" fill="none" stroke="#C8A45C" stroke-width="1.5"/>
</svg>
`;

  // v4.12.0 (#90): decision-log convention. Every new book ships a decisions/
  // dir (numbered ADRs) so the discipline is consistent by construction.
  // Distinct from the scaffold's own ledger (package/recipes/08-decisions-ledger.md).
  templates['decisions/ADR_TEMPLATE.md'] = `# ADR-NNN: <short title of the decision>

- **Status**: Proposed | Accepted | Deprecated | Superseded by ADR-MMM
- **Date**: YYYY-MM-DD
- **Deciders**: <who decided>

## Context

The situation, problem, or forces that motivate this decision. What
constraints apply? What alternatives are on the table?

## Decision

What we decided, in active voice ("We will …").

## Consequences

What becomes easier or harder as a result — trade-offs accepted, follow-ups
created, risks to revisit later.

## Supersedes / Superseded-by

Links to related ADRs. An ADR is immutable once Accepted: to change a past
decision, write a new ADR that supersedes it (and set this one's Status to
"Superseded by ADR-MMM").
`;

  templates['decisions/README.md'] = `# Decision log

An append-only log of the significant decisions made while building this book,
recorded as **ADRs** (Architecture Decision Records).

## Why

A written decision log keeps the *why* discoverable: future-you (and any
collaborator or AI assistant) can see what was decided, when, and what
alternatives were weighed — without reconstructing it from git archaeology.

## Convention

- One decision per file: \`NNNN-short-kebab-title.md\`, numbered sequentially
  from \`0001\`.
- Copy \`ADR_TEMPLATE.md\` to start a new record.
- **ADRs are immutable once Accepted.** To change a past decision, write a new
  ADR that supersedes it — set the old record's \`Status\` to
  \`Superseded by ADR-MMM\` and link them. Never rewrite history.
- Keep each record short: context, decision, consequences.

See \`ADR_TEMPLATE.md\` for the field shape and \`0001-*.md\` for a worked example.
`;

  templates['decisions/0001-built-on-book-scaffold-astro.md'] = `# ADR-0001: Build "${name}" on book-scaffold-astro

- **Status**: Accepted
- **Date**: (set to scaffold date)
- **Deciders**: (you)

## Context

"${name}" is a long-form book that needs MDX authoring, a content schema,
print/PDF output, full-text search, and a citation/reference pipeline. Building
that chrome from scratch is high-effort and easy to get subtly wrong
(accessibility, SEO, dark mode, print CSS).

## Decision

We will build "${name}" as a consumer of
\`@brandon_m_behring/book-scaffold-astro\` (${profile} profile, v${toolkitVersion}),
not a bespoke Astro project. The toolkit owns layouts, components, default
routes, styles, and the validate/build scripts; this repo owns content.

## Consequences

- Upgrades flow in via the npm dependency — we inherit fixes and features but
  track the toolkit's release cadence and any breaking changes.
- Customization happens through documented escape hatches (\`src/styles/\`
  overrides, \`extraStyles\`, route toggles), not by forking the toolkit.
- This decision log starts here so subsequent choices stay traceable.

## Supersedes / Superseded-by

None (initial decision).
`;

  // Profile-conditional files.
  if (PROFILE_DEFAULTS[profile].withBib) {
    // v3.6.1 (closes #39): ship a parseable placeholder entry so
    // `npm run build:bib` succeeds on a fresh scaffold. The pre-v3.6.1
    // comments-only file crashed @citation-js/plugin-bibtex's Grammar parser
    // (no entries → parse error), blocking every new academic book's first
    // build. Consumers replace this with their first real reference.
    // v3.6.3 (closes the v3.6.1/v3.6.2 follow-on regression): keep the bib
    // template ABSOLUTELY FREE of \`@\`-prefixed words in comment lines.
    // @citation-js/plugin-bibtex tokenizes any \`@word\` token (with or
    // without a trailing \`{\`) as an entry start; if the parser can't find
    // valid entry syntax after it, the Grammar parser crashes. v3.6.1
    // shipped commented \`% @article{...}\` (crashed); v3.6.2 mentioned
    // \`(@article, @book, ...)\` in a comment listing entry types (also
    // crashed). Lesson: in a .bib file, prose comments must not contain
    // any \`@\`-prefixed words. Document entry shapes elsewhere (recipe 02).
    templates['bibliography.bib'] = `% bibliography.bib — BibTeX source for <Cite> components.
% Run \`npm run build:bib\` to generate src/data/references.json.
%
% Replace the placeholder below with your first real reference (or remove
% it once you have actual bibliography entries). See
% https://github.com/brandon-behring/book-scaffold-astro/blob/v${toolkitVersion}/package/recipes/02-bibliography-pipeline.md
% for the supported BibTeX entry shapes.

@misc{placeholder,
  title  = {Placeholder reference - replace with your first real citation},
  author = {Anonymous},
  year   = {2026},
  note   = {Remove this entry once you add real references.}
}
`;
  }

  if (PROFILE_DEFAULTS[profile].withSources) {
    templates['sources/manifest.yaml'] = `# sources/manifest.yaml — captured sources for the tools profile.
# Each entry is read by inline <Citation src="id" /> and by <SourceArchive>,
# and is compiled to src/data/sources.json by \`book-scaffold build-bib\`
# (v4.10.0) so the auto-injected /references page lists them.
#
# Format: top-level YAML array of source objects. Each entry needs an
# explicit \`id\` (used as the citation key in <Citation src="id" />),
# plus the fields validated by the package's sourcesSchema:
#   - id: example-source
#     url: https://example.com
#     title: Example source
#     author: Author Name
#     publish_date: 2025-01-01
#     captured_at: 2026-05-19T00:00:00Z
#     tier: T1-official          # T1-official | T2-release-notes | T3-practitioner | T4-conjecture
#     tool: claude-code           # claude-code | gemini-cli | codex-cli | cross-tool
#
# See https://github.com/brandon-behring/book-scaffold-astro/blob/v${toolkitVersion}/PACKAGE_DESIGN.md
[]
`;
  }

  // Demo chapter — profile-aware frontmatter and component palette.
  templates['src/content/chapters/week01-hello-world.mdx'] =
    makeDemoChapter(profile);

  return templates;
}

function makeDemoChapter(profile) {
  if (profile === 'academic') {
    return `---
week: 1
part: foundations
title: Hello world
status: scaffolded
description: First chapter scaffolded by create-book — demonstrates frontmatter shape, KaTeX, and the academic callout family.
---

import NoteBox from '@brandon_m_behring/book-scaffold-astro/components/NoteBox.astro';
import Theorem from '@brandon_m_behring/book-scaffold-astro/components/Theorem.astro';
import Cite from '@brandon_m_behring/book-scaffold-astro/components/Cite.astro';

# Hello world

<NoteBox title="Welcome">
  This chapter was scaffolded by \`create-book\`. Edit it (or rename it) to start authoring.
</NoteBox>

## A first theorem

<Theorem id="w1:thm:hello" type="theorem">
  For any greeting $g \\in G$, there exists a response $r \\in R$ such that $r$ replies to $g$.
</Theorem>

KaTeX is wired by \`defineBookConfig\` when \`BOOK_PROFILE=academic\` (this book's setting in \`.env\`). Inline math: $f(x) = e^{i\\pi x}$. Display math:

$$\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}$$

To cite the bibliography: <Cite key="placeholder" /> (this references the placeholder entry in \`bibliography.bib\`; replace with your own once you add real references).

## What's next

- Run \`npm run dev\` to preview live.
- Add chapters under \`src/content/chapters/\` — see this file's shape.
- Edit \`bibliography.bib\` and rebuild for citations (replace the \`placeholder\` entry with your first real reference).
- Tag headings/theorems with \`id="…"\` and run \`npm run build:labels\` to enable \`<XRef>\`.
`;
  }

  if (profile === 'tools') {
    return `---
title: Hello world
part: 1
chapter: 1
volatility: stable-principle
tools_compared: [cross-tool]
last_verified: 2026-05-19
description: First chapter scaffolded by create-book — demonstrates frontmatter shape and the tools callout family.
---

import SkillBox from '@brandon_m_behring/book-scaffold-astro/components/SkillBox.astro';
import KeyIdea from '@brandon_m_behring/book-scaffold-astro/components/KeyIdea.astro';
import Convergence from '@brandon_m_behring/book-scaffold-astro/components/Convergence.astro';

# Hello world

<KeyIdea>
  This chapter was scaffolded by \`create-book\`. Frontmatter uses the tools schema —
  \`chapter\` is numeric, \`volatility\` calibrates reader trust, \`tools_compared\` is
  an explicit scope signal.
</KeyIdea>

## A skill

<SkillBox title="Setting up">
  Run \`npm run dev\` to preview at http://localhost:4321.
</SkillBox>

## What's next

- Edit this chapter and add more under \`src/content/chapters/\`.
- Capture sources in \`sources/manifest.yaml\` for the convergence dashboard.
- Tag versions in \`changelog/tools/<tool>.yaml\` if tracking tool evolution.
`;
  }

  // Minimal profile — falls back to tools schema per v2.0 convention.
  return `---
title: Hello world
part: 0
chapter: 1
volatility: stable-principle
tools_compared: [cross-tool]
last_verified: 2026-05-19
description: First chapter scaffolded by create-book (minimal profile — single-author essays / manifesto).
---

# Hello world

This book uses the minimal profile — single-author essays with no math, citations, or tools-comparison metadata required (frontmatter still uses the tools schema; just don't author with those fields).

Run \`npm run dev\` to preview. Edit this file or add new chapters under \`src/content/chapters/\`.
`;
}

// ===== Write files =====

async function pathExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function writeAll(targetDir, templates) {
  for (const [rel, content] of Object.entries(templates)) {
    const path = join(targetDir, rel);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, 'utf8');
  }
}

// ===== Main =====

async function readSelfVersion() {
  const pkgPath = resolve(__dirname, '..', 'package.json');
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
  return pkg.version;
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.showVersion) {
    process.stdout.write((await readSelfVersion()) + '\n');
    return;
  }

  if (!args.name) {
    process.stderr.write(`create-book: missing book name argument.\n\n${HELP}`);
    process.exit(2);
  }
  if (!VALID_PROFILES.has(args.profile)) {
    process.stderr.write(
      `create-book: invalid profile ${JSON.stringify(args.profile)}; ` +
        `must be one of academic | tools | minimal | course-notes | research-portfolio.\n`,
    );
    process.exit(2);
  }
  if (!args.author) {
    process.stderr.write('create-book: --author requires a non-empty name.\n');
    process.exit(2);
  }
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(args.name)) {
    process.stderr.write(
      `create-book: invalid name ${JSON.stringify(args.name)}; ` +
        `use lowercase letters, digits, hyphens, underscores.\n`,
    );
    process.exit(2);
  }

  const targetDir = resolve(process.cwd(), args.name);
  if (await pathExists(targetDir)) {
    process.stderr.write(
      `create-book: target ${args.name}/ already exists; refusing to overwrite.\n`,
    );
    process.exit(1);
  }

  const toolkitVersion = await readSelfVersion();
  const templates = makeTemplates(args.name, args.profile, toolkitVersion, args.author);

  await mkdir(targetDir, { recursive: true });
  await writeAll(targetDir, templates);

  const fileCount = Object.keys(templates).length;
  process.stdout.write(
    `create-book: scaffolded ${fileCount} files in ./${args.name}/ ` +
      `(profile: ${args.profile}, toolkit: ${toolkitVersion})\n` +
      `\n` +
      `Next steps:\n` +
      `  cd ${args.name}\n` +
      `  npm install\n` +
      `  npm run dev    # http://localhost:4321\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`create-book: fatal: ${err?.message ?? err}\n`);
  process.exit(1);
});
