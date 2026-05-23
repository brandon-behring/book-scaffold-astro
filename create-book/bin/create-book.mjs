#!/usr/bin/env node
/**
 * create-book — scaffold a fresh book repo that consumes
 * @brandon_m_behring/book-scaffold-astro.
 *
 * Usage:
 *   npx @brandon_m_behring/create-book <name> [--profile=academic|tools|minimal]
 *   npx @brandon_m_behring/create-book my-book --profile=academic
 *
 * Emits ~12 templated files in `./<name>/` covering the consumer's full
 * surface — astro.config.mjs (2 lines), src/content.config.ts (2 lines),
 * package.json (with toolkit dep + bin scripts), demo chapter, deploy
 * config, AI authoring guide. No installation; user runs `npm install`
 * themselves.
 *
 * Sibling to `@brandon_m_behring/book-scaffold-astro`; D12 lock-step
 * version. See PACKAGE_DESIGN.md and master plan Phase D.
 */
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ===== Args =====

const HELP = `Usage: npx @brandon_m_behring/create-book <name> [--preset=...|--profile=...]

Arguments:
  <name>           Book repo name. Becomes the new directory + package name.

Options:
  --preset=NAME    academic | tools | minimal   (default: minimal)
                   Canonical vocabulary as of v3.4.0; alias of --profile.
  --profile=NAME   Backward-compatible alias of --preset.
  --version, -v    Print the CLI version.
  --help, -h       This message.

Example:
  npx @brandon_m_behring/create-book interview-prep --preset=academic
`;

function parseArgs(argv) {
  // v3.6.1 (closes #38): accept --preset as canonical alias of --profile.
  // Internal variable name stays `profile` for back-compat with downstream
  // template code; the canonical user-facing vocabulary is preset.
  const args = { name: null, profile: 'minimal' };
  for (const a of argv.slice(2)) {
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
    if (a.startsWith('--')) {
      process.stderr.write(`create-book: unknown flag ${a}\n\n${HELP}`);
      process.exit(2);
    }
    if (!args.name) args.name = a;
  }
  return args;
}

const VALID_PROFILES = new Set(['academic', 'tools', 'minimal']);
const PROFILE_DEFAULTS = {
  academic: { withBib: true, withSources: false },
  tools: { withBib: false, withSources: true },
  minimal: { withBib: false, withSources: false },
};

// ===== Templates =====

function makeTemplates(name, profile, toolkitVersion) {
  const ctx = { name, profile, toolkitVersion };

  const templates = {
    'package.json': `{
  "name": "${name}",
  "description": "A book scaffolded with @brandon_m_behring/create-book (${profile} profile).",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "scripts": {
    "predev": "npm run build:bib --if-present && npm run build:labels --if-present",
    "prebuild": "npm run build:bib --if-present && npm run build:labels --if-present && npm run validate --if-present",
    "build:bib": "book-scaffold build-bib",
    "build:labels": "book-scaffold build-labels",
    "build:figures": "book-scaffold build-figures",
    "build:notebooks": "book-scaffold render-notebooks",
    "validate": "book-scaffold validate",
    "dev": "astro dev",
    "build": "astro build && pagefind --site dist",
    "preview": "astro preview"
  },
  "dependencies": {
    "@brandon_m_behring/book-scaffold-astro": "^${toolkitVersion}",
    "@astrojs/mdx": "^5.0.3",
    "@astrojs/preact": "^5.1.1",
    "astro": "^6.1.7",
    "preact": "^10.29.1"${
      profile === 'academic'
        ? `,
    "katex": "^0.16.11",
    "rehype-katex": "^7.0.1",
    "remark-math": "^6.0.0"`
        : ''
    }
  }
}
`,

    'astro.config.mjs': `// @ts-check
/**
 * astro.config.mjs — book-scaffold-astro consumer config.
 * defineBookConfig threads BOOK_PROFILE and wires the Integration.
 */
import { defineBookConfig } from '@brandon_m_behring/book-scaffold-astro';

export default await defineBookConfig({
  site: 'https://example.invalid',
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
\`\`\`

## Authoring

Chapters live under \`src/content/chapters/*.mdx\`. The starter \`week01-hello-world.mdx\` shows the frontmatter shape and basic component usage.

Available components are documented in the toolkit's [PACKAGE_DESIGN.md §10](https://github.com/brandon-behring/book-scaffold-astro/blob/v3.0/PACKAGE_DESIGN.md#10-mdx-import-patterns).

## Build + deploy

\`\`\`bash
npm run validate    # pre-flight content checks
npm run build       # → dist/
npx wrangler deploy # Cloudflare Workers + Static Assets
\`\`\`

See \`wrangler.toml\` for deploy config.
`,

    'CLAUDE.md': `# ${name} — AI authoring guide

This book is built with \`@brandon_m_behring/book-scaffold-astro\` (${profile} profile, v${toolkitVersion}).

**Where things live:**

- Chapters: \`src/content/chapters/*.mdx\` — frontmatter follows the ${profile} schema
- Components, layouts, default routes: \`@brandon_m_behring/book-scaffold-astro/components/...\`
- Style customizations: \`src/styles/\` (overrides package styles)
- Bibliography: \`bibliography.bib\` (academic) → \`src/data/references.json\` via \`npm run build:bib\`
- Cross-references: ids on \`<Theorem>\` / \`<Figure>\` → \`src/data/labels.json\` via \`npm run build:labels\`

**Toolkit reference:** [PACKAGE_DESIGN.md](https://github.com/brandon-behring/book-scaffold-astro/blob/v3.0/PACKAGE_DESIGN.md) — single source of truth for the API. File issues at https://github.com/brandon-behring/book-scaffold-astro/issues with label \`consumer:${name}\`.
`,

    'wrangler.toml': `# wrangler.toml — Cloudflare Workers + Static Assets deploy.
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
      routes are <a href="/chapters/">/chapters</a>,
      <a href="/references/">/references</a>,
      <a href="/search/">/search</a>, and
      <a href="/print/">/print</a>.
    </p>
  </article>
</Base>
`,

    'src/pages/chapters/[...slug].astro': `---
/**
 * Per-chapter route. Imports chapters from the content collection and
 * delegates rendering to the toolkit's Chapter layout. Schema-agnostic —
 * works for any preset.
 */
import { getCollection, render } from 'astro:content';
import Chapter from '@brandon_m_behring/book-scaffold-astro/layouts/Chapter.astro';

export async function getStaticPaths() {
  const chapters = await getCollection('chapters', (entry) => !entry.data.draft);
  return chapters.map((entry) => ({
    params: { slug: entry.id },
    props: { entry },
  }));
}

const { entry } = Astro.props;
const { Content, headings } = await render(entry);
---
<Chapter entry={entry} headings={headings}>
  <Content />
</Chapter>
`,
  };

  // Profile-conditional files.
  if (PROFILE_DEFAULTS[profile].withBib) {
    // v3.6.1 (closes #39): ship a parseable placeholder entry so
    // `npm run build:bib` succeeds on a fresh scaffold. The pre-v3.6.1
    // comments-only file crashed @citation-js/plugin-bibtex's Grammar parser
    // (no entries → parse error), blocking every new academic book's first
    // build. Consumers replace this with their first real reference.
    // v3.6.2 (closes #X): the previous template included a commented-out
    // @article{...} example block at the bottom. @citation-js/plugin-bibtex
    // tokenizes \`@article\` even inside %-prefixed comment lines, so the
    // grammar parser crashed at the trailing block. Lesson: do not put
    // commented \`@entry\` directives in a bibtex file the parser will see.
    // Keep the placeholder entry + leading prose comments only; document
    // the entry shape in package/recipes/02-bibliography-pipeline.md instead.
    templates['bibliography.bib'] = `% bibliography.bib — BibTeX source for <Cite> components.
% Run \`npm run build:bib\` to generate src/data/references.json.
%
% Replace this placeholder with your first real reference (or remove it
% once you have actual bibliography entries). See
% https://github.com/brandon-behring/book-scaffold-astro/blob/main/package/recipes/02-bibliography-pipeline.md
% for the supported BibTeX entry shapes (@article, @book, @inproceedings,
% @misc, @techreport, etc.).

@misc{placeholder2026,
  title  = {Placeholder reference - replace with your first real citation},
  author = {Anonymous},
  year   = {2026},
  note   = {Remove this entry once you add real references.}
}
`;
  }

  if (PROFILE_DEFAULTS[profile].withSources) {
    templates['sources/manifest.yaml'] = `# sources/manifest.yaml — captured sources for the tools-profile dashboard.
# Each entry is read by <SourceArchive> and the convergence page.
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
# See https://github.com/brandon-behring/book-scaffold-astro/blob/v3.0/PACKAGE_DESIGN.md
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

To cite the bibliography (once \`bibliography.bib\` has entries and \`npm run build:bib\` has run): <Cite key="example-key2024" />.

## What's next

- Run \`npm run dev\` to preview live.
- Add chapters under \`src/content/chapters/\` — see this file's shape.
- Edit \`bibliography.bib\` and rebuild for citations.
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
        `must be one of academic | tools | minimal.\n`,
    );
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
  const templates = makeTemplates(args.name, args.profile, toolkitVersion);

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
