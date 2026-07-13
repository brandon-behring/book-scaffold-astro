#!/usr/bin/env node
/**
 * build-labels.mjs — emit src/data/labels.json for <XRef> resolution.
 *
 * Walks the consumer's `src/content/chapters/**\/*.mdx`, extracts every h2–h6
 * Markdown heading plus each labelable component invocation (Theorem, Figure,
 * Section, … — see `LABELABLE_TYPES` below), and assigns it an entry of the form
 *   { href, display: "Theorem 4.2", number: "4.2" }
 * matching the LaTeX `\cref` convention. The map is consumed by XRef.astro
 * (display + href) AND Theorem.astro (#126: `number`, so a heading auto-
 * numbers from the same source the xref reads — they agree by construction).
 *
 * Kind-aware (#126): a `<Theorem kind="proposition">` resolves its display
 * WORD through the shared theorem-label vocabulary (`Proposition 8.1`), not a
 * kind-blind `Theorem 8.1`. v4.27.0 (#175) lets defineBookConfig / defineStyle
 * select shared (the historical default) or independent per-kind counters.
 *
 * The resulting map is consumed by XRef.astro via
 * `import.meta.glob('/src/data/labels.json', { eager: true })`.
 *
 * Per-chapter counters: each chapter resets the sequence, so two chapters can
 * both have `Theorem 1` without colliding. Labelable component families always
 * have independent counters; theorem kinds share or split per numberStyle. The chapter
 * number comes from frontmatter:
 *   - tools profile: `chapter` field (number).
 *   - academic profile: `week` field (number).
 *
 * Chapter IDs use frontmatter `slug:` when set, else the chapter-relative path
 * minus `.md`/`.mdx` (so nested content IDs preserve their directory). Hrefs
 * are resolved through the evaluated defineBookConfig `chapterRoute` and
 * `bookField`; the default remains `chapters/<id>#<label>`.
 *
 * Heading anchors come from Astro's own Markdown processor, including its
 * smartypants text normalization and GitHubSlugger duplicate suffixes. h1 is
 * intentionally excluded because it is the chapter title, not an in-chapter
 * BookLink target.
 *
 * Optional override:
 *   <Theorem id="…" label="Custom display" />
 *     → labels.json uses "Custom display" instead of the auto-counter.
 *
 * Usage:
 *   node scripts/build-labels.mjs
 *   book-scaffold build-labels
 *
 * Reads from cwd (the consumer's project root); writes
 * `src/data/labels.json`. Creates `src/data/` if missing.
 *
 * Designed to run in <2 s on a medium book.
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, relative, join, dirname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { readChaptersBase } from './walk-mdx.mjs';
import { loadResolvedBookConfig } from './resolve-book-config.mjs';
// #126: reuse the ONE kind vocabulary (theorem-label.ts → its own lean tsup
// entry) so a <Theorem kind="proposition"> xref reads "Proposition N.M", not a
// kind-blind "Theorem N.M" — and so an unknown/absent kind FAILS HERE (same
// throw as the render path, #121) one build step earlier. Requires `dist/`
// (run `npm run build` first; the published tarball ships dist + scripts).
import { theoremLabel } from '../dist/lib/theorem-label.mjs';
// #147: reuse the same route-token resolver as Sidebar/ChapterNav rather than
// maintaining a second, hardcoded `chapters/<slug>` interpretation here.
import { chapterHref } from '../dist/lib/nav-href.mjs';

// --help / -h: non-mutating (closes #14).
const USAGE = `Usage: book-scaffold build-labels

Emit src/data/labels.json for <XRef> and <BookLink> resolution. Walks chapter
Markdown/MDX files, indexes h2–h6 anchors, and extracts labelable components
(Theorem, Figure, ...) with display strings like "Theorem 4.2".

Env:
  BOOK_CHAPTERS_DIR   Override chapters dir (default: src/content/chapters).
  BOOK_LABELS_OUT     Override output path (default: src/data/labels.json).

Options:
  --help, -h          Print this message and exit (non-mutating).

Numbering and chapter hrefs are read from evaluated defineBookConfig metadata.
Defaults are shared numbering and /chapters/:id/ when no integration resolves.
`;

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  process.stdout.write(USAGE);
  process.exit(0);
}

// v4.1.1 (closes #63): readChaptersBase honors BOOK_CHAPTERS_DIR env (when set)
// then parses the consumer's content.config.{ts,mjs,js} for a `chapters`
// collection `loader.base` override. Multi-guide consumers use
// `src/content/<guide-slug>/` rather than the Astro 5 default.
const CHAPTERS_DIR_ABS = await readChaptersBase(process.cwd());
// build-labels uses CHAPTERS_DIR as a path relative to cwd elsewhere in the
// script (joined with `walkMdx`). Convert the absolute path back to relative
// for compatibility with the existing call sites.
const CHAPTERS_DIR = relative(process.cwd(), CHAPTERS_DIR_ABS) || 'src/content/chapters';
const OUTPUT_PATH = process.env.BOOK_LABELS_OUT ?? 'src/data/labels.json';

/** Component names that participate in cross-referencing. */
const LABELABLE_TYPES = [
  'Theorem',
  'Figure',
  'ExampleBox',
  'ResultBox',
  'NoteBox',
  'CaseStudy',
];

/** Display-name prefix used when no `label` override is given. */
const TYPE_DISPLAY = {
  Theorem: 'Theorem',
  Figure: 'Figure',
  ExampleBox: 'Example',
  ResultBox: 'Result',
  NoteBox: 'Note',
  CaseStudy: 'Case study',
};

// ===== Frontmatter parsing =====

function splitFrontmatter(source) {
  // Standard MDX/YAML frontmatter: `---\n…\n---`.
  // Remove it before Markdown processing: YAML comments beginning with `#`
  // must not become phantom headings.
  const m = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!m) return { frontmatter: {}, body: source };
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w+)\s*:\s*(.+?)\s*$/);
    if (!kv) continue;
    const [, key, raw] = kv;
    // Strip quotes; coerce numeric scalars.
    let val = raw.replace(/^["']|["']$/g, '');
    if (/^-?\d+$/.test(val)) val = parseInt(val, 10);
    fm[key] = val;
  }
  return { frontmatter: fm, body: source.slice(m[0].length) };
}

function chapterNumberOf(frontmatter) {
  // Tools profile uses `chapter`; academic uses `week`. Prefer chapter.
  if (typeof frontmatter.chapter === 'number') return frontmatter.chapter;
  if (typeof frontmatter.week === 'number') return frontmatter.week;
  return null;
}

// ===== Component-invocation parsing =====

/**
 * Match opening tags of any labelable component, capturing the attrs blob.
 * Conservative regex: only matches `<ComponentName ... />` or
 * `<ComponentName ...>` (not closing tags, not self-references in prose).
 */
function buildTagRegex() {
  const names = LABELABLE_TYPES.join('|');
  return new RegExp(`<(${names})\\b([^>]*?)\\/?>`, 'g');
}

function extractAttr(attrsBlob, name) {
  // `name="value"` or `name='value'` or `name={value}`.
  const dq = attrsBlob.match(new RegExp(`${name}="([^"]*)"`));
  if (dq) return dq[1];
  const sq = attrsBlob.match(new RegExp(`${name}='([^']*)'`));
  if (sq) return sq[1];
  const ex = attrsBlob.match(new RegExp(`${name}=\\{([^}]*)\\}`));
  if (ex) return ex[1].trim().replace(/^["'`]|["'`]$/g, '');
  return null;
}

// ===== Filesystem walk =====

async function walkChapters(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return out;
    throw err;
  }
  for (const e of entries) {
    const path = join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await walkChapters(path)));
      continue;
    }
    if (!e.isFile()) continue;
    if (!/\.mdx?$/.test(e.name)) continue;
    if (e.name.startsWith('_')) continue; // hidden by convention
    out.push(path);
  }
  return out;
}

// ===== Main =====

async function main() {
  const cwd = process.cwd();
  const { numberStyle, chapterRoute, bookField } = await loadResolvedBookConfig(cwd);
  const chaptersDir = resolve(cwd, CHAPTERS_DIR);
  const files = await walkChapters(chaptersDir);
  // Syntax highlighting cannot affect heading metadata and is expensive to
  // initialize. Everything that does affect Astro heading text/IDs (GFM,
  // smartypants, rehypeHeadingIds/GitHubSlugger) retains Astro's defaults.
  const headingProcessor = await createMarkdownProcessor({ syntaxHighlight: false });

  const labels = {};
  const tagRegex = buildTagRegex();
  let totalIds = 0;
  let chaptersWithIds = 0;

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    const { frontmatter: fm, body } = splitFrontmatter(source);
    const chapterNum = chapterNumberOf(fm);
    const contentId = relative(chaptersDir, file)
      .split(sep)
      .join('/')
      .replace(/\.mdx?$/, '');
    const entryId = (typeof fm.slug === 'string' && fm.slug.length > 0)
      ? fm.slug
      : contentId;
    const chapterPath = chapterHref(
      { id: entryId, data: fm },
      chapterRoute,
      '/',
      bookField,
    ).replace(/^\/+|\/+$/g, '');

    const addLabel = (id, value) => {
      if (labels[id]) {
        // Duplicate id — surface but don't fail; consumer's validator catches
        // collisions with full diagnostic context. Component IDs retain their
        // historical precedence over an identically named heading anchor.
        process.stderr.write(
          `build-labels: WARN duplicate id "${id}" (first in ` +
            `${labels[id].href.split('#')[0]}, now in ${entryId})\n`,
        );
      }
      labels[id] = value;
    };

    // Per-chapter counters reset for each file.
    const counters = {};
    let foundInChapter = 0;

    // #147: BookLink fragments normally target prose sections rather than
    // labelable components. Astro owns both text extraction and GitHub-style
    // slug collision behavior, so consume its heading metadata directly.
    const rendered = await headingProcessor.render(body, {
      fileURL: pathToFileURL(file),
      frontmatter: fm,
    });
    for (const heading of rendered.metadata.headings) {
      if (heading.depth < 2 || heading.depth > 6) continue;
      foundInChapter += 1;
      totalIds += 1;
      const href = `${chapterPath}#${heading.slug}`;
      // Heading fragments are only document-local: many chapters legitimately
      // contain `#summary`. A path-qualified, opaque key preserves every one
      // without colliding with component IDs or another chapter. BookLink
      // validation resolves the exact href VALUE; consumers must not derive
      // heading semantics from this internal key.
      addLabel(`heading:${href}`, {
        href,
        display: heading.text,
        number: null,
      });
    }

    for (const match of source.matchAll(tagRegex)) {
      const [, componentName, attrs] = match;
      const id = extractAttr(attrs, 'id');
      if (!id) continue;

      foundInChapter += 1;
      totalIds += 1;

      // Resolve the display word only when it will actually be used. A `label=`
      // override supplies its own display, so we neither compute nor (for
      // <Theorem>) kind-validate it — computing would throw on a kindless
      // override, the documented `<Theorem id label="…">` form. For <Theorem>
      // the word is kind-aware and THROWS on an absent/unknown kind (the #121
      // contract, one build step earlier than render). extractAttr returns null
      // for an absent attr → normalize to undefined so theoremLabel reports
      // "no kind=" rather than the misleading kind="null".
      const labelOverride = extractAttr(attrs, 'label');
      let word;
      let theoremKind;
      if (labelOverride == null) {
        if (componentName === 'Theorem') {
          try {
            const resolvedLabel = theoremLabel({
              kind: extractAttr(attrs, 'kind') ?? undefined,
              type: extractAttr(attrs, 'type') ?? undefined,
            });
            word = resolvedLabel.fullLabel;
            theoremKind = resolvedLabel.kind;
          } catch (err) {
            throw new Error(
              `<Theorem id="${id}"> in ${relative(cwd, file)}: ${err.message}`,
            );
          }
        } else {
          word = TYPE_DISPLAY[componentName];
        }
      }

      // label= is a custom, unnumbered display and therefore does not consume
      // either the historical shared sequence or a per-kind sequence. This
      // keeps later auto-numbered entries stable when prose-only labels move.
      const counterKey =
        numberStyle === 'per-kind' && componentName === 'Theorem'
          ? `Theorem/${theoremKind}`
          : componentName;
      if (labelOverride == null) {
        counters[counterKey] = (counters[counterKey] ?? 0) + 1;
      }

      // The bare counter string the heading reuses: Theorem.astro reads
      // `number` by id and renders it, so heading == xref by construction.
      // A `label=` override opts out of auto-numbering → number is null.
      const number = labelOverride != null
        ? null
        : chapterNum != null
          ? `${chapterNum}.${counters[counterKey]}`
          : String(counters[counterKey]);
      const display = labelOverride ?? `${word} ${number}`;

      addLabel(id, {
        // #142: base-less ref — XRef.astro prefixes BASE_URL at render so one
        // labels.json serves any deploy base (root or path-proxied series).
        href: `${chapterPath}#${id}`,
        display,
        number,
      });
    }

    if (foundInChapter > 0) chaptersWithIds += 1;
  }

  // Emit deterministic output: keys sorted alphabetically.
  const sorted = {};
  for (const k of Object.keys(labels).sort()) sorted[k] = labels[k];

  const outputPath = resolve(cwd, OUTPUT_PATH);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(sorted, null, 2) + '\n', 'utf8');

  process.stdout.write(
    `build-labels: ${totalIds} id${totalIds === 1 ? '' : 's'} across ` +
      `${chaptersWithIds} chapter${chaptersWithIds === 1 ? '' : 's'} → ` +
      `${OUTPUT_PATH} (number-style=${numberStyle})\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`build-labels: fatal: ${err?.message ?? err}\n`);
  process.exit(1);
});
