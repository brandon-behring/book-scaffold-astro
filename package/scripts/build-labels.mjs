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
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, relative, dirname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { readChaptersBase, walkMdx } from './walk-mdx.mjs';
import { loadResolvedBookConfig } from './resolve-book-config.mjs';
import {
  assertLegacyBookMatches,
  mergeCorpusArtifact,
  parseFrontmatter,
  resolveBookSelection,
} from './corpus-tooling.mjs';
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
  --book <id>       In corpus mode, rebuild only one registered book.
  --help, -h          Print this message and exit (non-mutating).

Numbering and chapter hrefs are read from evaluated defineBookConfig metadata.
Defaults are shared numbering and /chapters/:id/ when no integration resolves.
`;

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  process.stdout.write(USAGE);
  process.exit(0);
}

const OUTPUT_PATH = process.env.BOOK_LABELS_OUT ?? 'src/data/labels.json';
let DIAGNOSTIC_SCOPE = null;

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

// ===== Main =====

async function main() {
  const cwd = process.cwd();
  const toolingConfig = await loadResolvedBookConfig(cwd);
  if (toolingConfig.corpus) DIAGNOSTIC_SCOPE = 'corpus';
  const { numberStyle, chapterRoute, bookField } = toolingConfig;
  const selection = resolveBookSelection(
    toolingConfig,
    process.argv.slice(2),
    'build-labels',
  );
  DIAGNOSTIC_SCOPE = selection.corpus ? 'corpus' : null;
  const chaptersRoot = await readChaptersBase(cwd, { corpus: selection.corpus });
  const runs = selection.corpus
    ? selection.books.map((book) => ({ book, dir: resolve(chaptersRoot, book.id) }))
    : [{ book: null, dir: chaptersRoot }];

  // Syntax highlighting cannot affect heading metadata and is expensive to
  // initialize. Everything that does affect Astro heading text/IDs (GFM,
  // smartypants, rehypeHeadingIds/GitHubSlugger) retains Astro's defaults.
  const headingProcessor = await createMarkdownProcessor({ syntaxHighlight: false });
  const tagRegex = buildTagRegex();
  const values = new Map();
  const stats = [];

  for (const run of runs) {
    const files = [];
    for await (const file of walkMdx(run.dir)) files.push(resolve(run.dir, file));
    const labels = {};
    let totalIds = 0;
    let chaptersWithIds = 0;

    for (const file of files) {
      const source = await readFile(file, 'utf8');
      if (run.book) {
        assertLegacyBookMatches(
          source,
          run.book,
          `[book:${run.book.id}] ${relative(cwd, file)}`,
        );
      }
      const fileLabel = run.book
        ? `[book:${run.book.id}] ${relative(cwd, file)}`
        : relative(cwd, file);
      const { frontmatter: fm, body } = parseFrontmatter(source, fileLabel);
      const chapterNum = chapterNumberOf(fm);
      const contentId = relative(run.dir, file)
        .split(sep)
        .join('/')
        .replace(/\.mdx?$/, '');
      const localEntryId = (typeof fm.slug === 'string' && fm.slug.length > 0)
        ? fm.slug
        : contentId;
      const entryId = run.book ? `${run.book.id}/${localEntryId}` : localEntryId;
      const chapterPath = chapterHref(
        { id: entryId, data: fm },
        chapterRoute,
        '/',
        bookField,
      ).replace(/^\/+|\/+$/g, '');

      const addLabel = (id, value) => {
        if (labels[id]) {
          // Component IDs are book-local in corpus mode, so identical ids in
          // another namespace do not collide.
          const prefix = run.book ? `[book:${run.book.id}] ` : '';
          if (run.book) {
            throw new Error(
              `${prefix}duplicate label id "${id}" (first in ` +
                `${labels[id].href.split('#')[0]}, now in ${entryId}).`,
            );
          }
          process.stderr.write(
            `${prefix}build-labels: WARN duplicate id "${id}" (first in ` +
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
              const prefix = run.book ? `[book:${run.book.id}] ` : '';
              throw new Error(
                `${prefix}<Theorem id="${id}"> in ${relative(cwd, file)}: ${err.message}`,
              );
            }
          } else {
            word = TYPE_DISPLAY[componentName];
          }
        }

        const counterKey =
          numberStyle === 'per-kind' && componentName === 'Theorem'
            ? `Theorem/${theoremKind}`
            : componentName;
        if (labelOverride == null) {
          counters[counterKey] = (counters[counterKey] ?? 0) + 1;
        }

        const number = labelOverride != null
          ? null
          : chapterNum != null
            ? `${chapterNum}.${counters[counterKey]}`
            : String(counters[counterKey]);
        const display = labelOverride ?? `${word} ${number}`;

        addLabel(id, {
          href: `${chapterPath}#${id}`,
          display,
          number,
        });
      }

      if (foundInChapter > 0) chaptersWithIds += 1;
    }

    // Emit deterministic output: keys sorted alphabetically within each book.
    const sorted = {};
    for (const key of Object.keys(labels).sort()) sorted[key] = labels[key];
    values.set(run.book?.id ?? '', sorted);
    stats.push({ book: run.book, totalIds, chaptersWithIds });
  }

  const outputPath = resolve(cwd, OUTPUT_PATH);
  const output = selection.corpus
    ? await mergeCorpusArtifact({
        path: outputPath,
        corpus: selection.corpus,
        requestedBook: selection.requestedBook,
        values,
        emptyValue: () => ({}),
        artifact: OUTPUT_PATH,
        validateValue: (value) =>
          value !== null && typeof value === 'object' && !Array.isArray(value),
      })
    : values.get('');
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(output, null, 2) + '\n', 'utf8');

  if (selection.corpus) {
    for (const stat of stats) {
      process.stdout.write(
        `[book:${stat.book.id}] build-labels: ${stat.totalIds} ` +
          `id${stat.totalIds === 1 ? '' : 's'} across ${stat.chaptersWithIds} ` +
          `chapter${stat.chaptersWithIds === 1 ? '' : 's'} → ${OUTPUT_PATH} ` +
          `(number-style=${numberStyle})\n`,
      );
    }
    const totalIds = stats.reduce((sum, stat) => sum + stat.totalIds, 0);
    const totalChapters = stats.reduce((sum, stat) => sum + stat.chaptersWithIds, 0);
    process.stdout.write(
      `[book:corpus] build-labels: ${totalIds} id${totalIds === 1 ? '' : 's'} across ` +
        `${totalChapters} chapter${totalChapters === 1 ? '' : 's'} and ` +
        `${stats.length} book${stats.length === 1 ? '' : 's'} → ${OUTPUT_PATH} ` +
        `(number-style=${numberStyle})\n`,
    );
  } else {
    const [stat] = stats;
    process.stdout.write(
      `build-labels: ${stat.totalIds} id${stat.totalIds === 1 ? '' : 's'} across ` +
        `${stat.chaptersWithIds} chapter${stat.chaptersWithIds === 1 ? '' : 's'} → ` +
        `${OUTPUT_PATH} (number-style=${numberStyle})\n`,
    );
  }
}

main().catch((err) => {
  const message = String(err?.message ?? err);
  const prefix = DIAGNOSTIC_SCOPE ? `[book:${DIAGNOSTIC_SCOPE}] ` : '';
  process.stderr.write(
    message.startsWith('[book:') ? `${message}\n` : `${prefix}build-labels: fatal: ${message}\n`,
  );
  process.exit(1);
});
