#!/usr/bin/env node
/**
 * build-labels.mjs — emit src/data/labels.json for <XRef> resolution.
 *
 * Walks the consumer's `src/content/chapters/**\/*.mdx`, extracts each
 * labelable component invocation (Theorem, Figure, Section, … — see
 * `LABELABLE_TYPES` below), and assigns it an entry of the form
 *   { href, display: "Theorem 4.2", number: "4.2" }
 * matching the LaTeX `\cref` convention. The map is consumed by XRef.astro
 * (display + href) AND Theorem.astro (#126: `number`, so a heading auto-
 * numbers from the same source the xref reads — they agree by construction).
 *
 * Kind-aware (#126): a `<Theorem kind="proposition">` resolves its display
 * WORD through the shared theorem-label vocabulary (`Proposition 8.1`), not a
 * kind-blind `Theorem 8.1`. The theorem family shares one counter (keyed by
 * the JSX component, as amsthm shares its counter), so numbers are unchanged.
 *
 * The resulting map is consumed by XRef.astro via
 * `import.meta.glob('/src/data/labels.json', { eager: true })`.
 *
 * Per-chapter, per-type counter: each chapter resets the counter, so two
 * chapters can both have `Theorem 1` without colliding. The chapter
 * number comes from frontmatter:
 *   - tools profile: `chapter` field (number).
 *   - academic profile: `week` field (number).
 *
 * Slug used for the href: the chapter's frontmatter `slug:` if set,
 * else filename minus `.mdx`. The href shape mirrors the consumer's pages
 * router: `/chapters/<slug>#<id>`. Academic books using `[...slug].astro`
 * get the same shape since Astro slugifies filenames identically when no
 * frontmatter override is present.
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
import { resolve, relative, join, basename, dirname } from 'node:path';
import { readChaptersBase } from './walk-mdx.mjs';
// #126: reuse the ONE kind vocabulary (theorem-label.ts → its own lean tsup
// entry) so a <Theorem kind="proposition"> xref reads "Proposition N.M", not a
// kind-blind "Theorem N.M" — and so an unknown/absent kind FAILS HERE (same
// throw as the render path, #121) one build step earlier. Requires `dist/`
// (run `npm run build` first; the published tarball ships dist + scripts).
import { theoremLabel } from '../dist/lib/theorem-label.mjs';

// --help / -h: non-mutating (closes #14).
const USAGE = `Usage: book-scaffold build-labels

Emit src/data/labels.json for <XRef> resolution. Walks chapter MDX files,
extracts labelable components (Theorem, Figure, ...), assigns display strings
like "Theorem 4.2" matching LaTeX \\cref.

Env:
  BOOK_CHAPTERS_DIR   Override chapters dir (default: src/content/chapters).
  BOOK_LABELS_OUT     Override output path (default: src/data/labels.json).

Options:
  --help, -h          Print this message and exit (non-mutating).
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

function parseFrontmatter(source) {
  // Standard MDX/YAML frontmatter: `---\n…\n---`.
  const m = source.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+)\s*:\s*(.+?)\s*$/);
    if (!kv) continue;
    const [, key, raw] = kv;
    // Strip quotes; coerce numeric scalars.
    let val = raw.replace(/^["']|["']$/g, '');
    if (/^-?\d+$/.test(val)) val = parseInt(val, 10);
    fm[key] = val;
  }
  return fm;
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
  const chaptersDir = resolve(cwd, CHAPTERS_DIR);
  const files = await walkChapters(chaptersDir);

  const labels = {};
  const tagRegex = buildTagRegex();
  let totalIds = 0;
  let chaptersWithIds = 0;

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    const fm = parseFrontmatter(source);
    const chapterNum = chapterNumberOf(fm);
    const slug = (typeof fm.slug === 'string' && fm.slug.length > 0)
      ? fm.slug
      : basename(file).replace(/\.mdx?$/, '');

    // Per-chapter counters reset for each file.
    const counters = {};
    let foundInChapter = 0;

    for (const match of source.matchAll(tagRegex)) {
      const [, componentName, attrs] = match;
      const id = extractAttr(attrs, 'id');
      if (!id) continue;

      // One shared counter per component (keyed by the JSX name, NOT the
      // amsthm kind) — so theorem/proposition/lemma share a sequence exactly
      // as they do under amsthm, and existing numbers never shift (#126).
      counters[componentName] = (counters[componentName] ?? 0) + 1;
      foundInChapter += 1;
      totalIds += 1;

      // Display word is kind-aware for <Theorem> (Proposition, Lemma, …) via
      // the shared resolver, which THROWS on an absent/unknown kind — the same
      // fail-loud contract as the render path (#121), one build step earlier.
      let word;
      if (componentName === 'Theorem') {
        try {
          word = theoremLabel({
            kind: extractAttr(attrs, 'kind'),
            type: extractAttr(attrs, 'type'),
          }).fullLabel;
        } catch (err) {
          throw new Error(
            `<Theorem id="${id}"> in ${relative(cwd, file)}: ${err.message}`,
          );
        }
      } else {
        word = TYPE_DISPLAY[componentName];
      }

      // The bare counter string the heading reuses: Theorem.astro reads
      // `number` by id and renders it, so heading == xref by construction.
      // A `label=` override opts out of auto-numbering → number is null (the
      // heading then shows no number rather than mis-parsing a custom string).
      const number =
        chapterNum != null
          ? `${chapterNum}.${counters[componentName]}`
          : String(counters[componentName]);
      const labelOverride = extractAttr(attrs, 'label');
      const display = labelOverride ?? `${word} ${number}`;

      if (labels[id]) {
        // Duplicate id — surface but don't fail; consumer's validator
        // catches collisions with full diagnostic context.
        process.stderr.write(
          `build-labels: WARN duplicate id "${id}" (first in ` +
            `${labels[id].href.split('#')[0]}, now in ${slug})\n`,
        );
      }
      labels[id] = {
        href: `/chapters/${slug}#${id}`,
        display,
        number: labelOverride ? null : number,
      };
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
      `${OUTPUT_PATH}\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`build-labels: fatal: ${err?.message ?? err}\n`);
  process.exit(1);
});
