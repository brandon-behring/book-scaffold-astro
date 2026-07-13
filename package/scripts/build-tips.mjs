#!/usr/bin/env node
/**
 * scripts/build-tips.mjs — emit src/data/tips.json from <Tip> instances
 * in chapter MDX (v4.3.0, closes #70).
 *
 * Scans `src/content/chapters/**\/*.mdx` (honoring loader.base via
 * readChaptersBase from walk-mdx.mjs — same path-resolution as build-labels +
 * validate). Extracts `<Tip n="N" title="T">body</Tip>` occurrences via regex
 * (same approach as build-labels.mjs LABELABLE_TYPES extraction). Emits an
 * array sorted by n.
 *
 * Output shape:
 *   [
 *     { "n": 1, "title": "...", "chapter": "ch-slug", "preview": "first 80 chars" },
 *     ...
 *   ]
 *
 * Graceful no-op: if no <Tip> instances exist, writes [] (doesn't fail
 * builds for consumers who don't use the feature).
 *
 * Run on `prebuild` via the consumer's package.json. Doesn't depend on
 * Astro virtual modules — pure regex + Node fs.
 */
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { resolve, dirname, basename } from 'node:path';
import { walkMdx, readChaptersBase } from './walk-mdx.mjs';
import { loadResolvedBookConfig } from './resolve-book-config.mjs';
import {
  assertLegacyBookMatches,
  frontmatterSlug,
  mergeCorpusArtifact,
  resolveBookSelection,
} from './corpus-tooling.mjs';

const USAGE = `Usage: book-scaffold build-tips

Scan chapter MDX for <Tip n="N" title="T">body</Tip> occurrences; emit
src/data/tips.json sorted by n. Used by the /tips auto-route + <TipsCard>
component when routes.tips: true.

Env:
  BOOK_CHAPTERS_DIR   Override chapters dir (default: src/content/chapters).
  BOOK_TIPS_OUT       Override output path (default: src/data/tips.json).

Options:
  --book <id>       In corpus mode, rebuild only one registered book.
  --help, -h          Print this message and exit (non-mutating).
`;

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  process.stdout.write(USAGE);
  process.exit(0);
}

const CWD = process.cwd();
const OUTPUT_PATH = process.env.BOOK_TIPS_OUT ?? 'src/data/tips.json';
let DIAGNOSTIC_SCOPE = null;

/**
 * Extract <Tip n="..." title="..."> tags and their body content from MDX.
 *
 * Regex captures:
 *   - n: the tip number (string; coerced to int when writing JSON)
 *   - title: the tip title (string)
 *   - body: text between opening + closing tags
 *
 * Limitations (deliberate, documented):
 *   - Doesn't handle nested <Tip> tags (no real use case)
 *   - String attributes must use single OR double quotes (not template literals)
 *   - title may not contain a literal quote of the same type used as delimiter
 *     (escaping isn't supported)
 *   - body is captured raw; first 80 chars (ignoring leading whitespace) used as preview
 */
function extractTips(source, chapterSlug) {
  const tips = [];
  // Two-branch alternation (single OR double quotes), no backreference —
  // same portability pattern as readChaptersBase regex (v4.1.2 lesson).
  const re = new RegExp(
    [
      // double-quoted attrs
      `<Tip\\s+n="([^"]+)"\\s+title="([^"]+)"\\s*>([\\s\\S]*?)</Tip>`,
      // single-quoted attrs
      `<Tip\\s+n='([^']+)'\\s+title='([^']+)'\\s*>([\\s\\S]*?)</Tip>`,
      // mixed (n double, title single) — rare but support it
      `<Tip\\s+n="([^"]+)"\\s+title='([^']+)'\\s*>([\\s\\S]*?)</Tip>`,
      // mixed (n single, title double)
      `<Tip\\s+n='([^']+)'\\s+title="([^"]+)"\\s*>([\\s\\S]*?)</Tip>`,
    ].join('|'),
    'g',
  );
  for (const match of source.matchAll(re)) {
    // One of the 4 alternation branches matched; locate captures.
    const [, n1, t1, b1, n2, t2, b2, n3, t3, b3, n4, t4, b4] = match;
    const n = n1 || n2 || n3 || n4;
    const title = t1 || t2 || t3 || t4;
    const body = b1 || b2 || b3 || b4 || '';
    if (!n || !title) continue;
    const nNum = Number.parseInt(n, 10);
    if (!Number.isFinite(nNum)) continue;
    const preview = body
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 80);
    tips.push({
      n: nNum,
      title,
      chapter: chapterSlug,
      preview,
    });
  }
  return tips;
}

async function main() {
  const toolingConfig = await loadResolvedBookConfig(CWD);
  if (toolingConfig.corpus) DIAGNOSTIC_SCOPE = 'corpus';
  const selection = resolveBookSelection(toolingConfig, process.argv.slice(2), 'build-tips');
  DIAGNOSTIC_SCOPE = selection.corpus ? 'corpus' : null;
  const chaptersRoot = await readChaptersBase(CWD, { corpus: selection.corpus });
  const runs = selection.corpus
    ? selection.books.map((book) => ({ book, dir: resolve(chaptersRoot, book.id) }))
    : [{ book: null, dir: chaptersRoot }];
  const values = new Map();
  let corpusTotal = 0;

  for (const run of runs) {
    const allTips = [];
    for await (const rel of walkMdx(run.dir)) {
      const chapterPath = resolve(run.dir, rel);
      let source;
      try {
        source = await readFile(chapterPath, 'utf8');
      } catch {
        continue;
      }
      if (run.book) {
        assertLegacyBookMatches(
          source,
          run.book,
          `[book:${run.book.id}] ${resolve(CWD, chapterPath).replace(`${CWD}/`, '')}`,
        );
      }
      const fileLabel = run.book
        ? `[book:${run.book.id}] ${resolve(CWD, chapterPath).replace(`${CWD}/`, '')}`
        : resolve(CWD, chapterPath).replace(`${CWD}/`, '');
      const chapterSlug = run.book
        ? frontmatterSlug(source, fileLabel) ?? rel.replace(/\.mdx?$/, '')
        : basename(rel).replace(/\.mdx?$/, '');
      allTips.push(...extractTips(source, chapterSlug));
    }

    // Sort by n; warn on duplicates (don't fail — the index page just shows duplicates).
    allTips.sort((a, b) => a.n - b.n);
    const seenN = new Set();
    for (const tip of allTips) {
      if (seenN.has(tip.n)) {
        const prefix = run.book ? `[book:${run.book.id}] ` : '';
        process.stderr.write(
          `${prefix}build-tips: WARN duplicate Tip n="${tip.n}" (last wins on /tips index)\n`,
        );
      }
      seenN.add(tip.n);
    }

    if (run.book) {
      values.set(run.book.id, allTips);
      corpusTotal += allTips.length;
      process.stdout.write(
        `[book:${run.book.id}] build-tips: ${allTips.length} ` +
          `tip${allTips.length === 1 ? '' : 's'} → ${OUTPUT_PATH}\n`,
      );
    } else {
      values.set('', allTips);
    }
  }

  const outPath = resolve(CWD, OUTPUT_PATH);
  const output = selection.corpus
    ? await mergeCorpusArtifact({
        path: outPath,
        corpus: selection.corpus,
        requestedBook: selection.requestedBook,
        values,
        emptyValue: () => [],
        artifact: OUTPUT_PATH,
        validateValue: Array.isArray,
      })
    : values.get('');
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(output, null, 2) + '\n');
  if (selection.corpus) {
    process.stdout.write(
      `[book:corpus] build-tips: ${corpusTotal} ` +
        `tip${corpusTotal === 1 ? '' : 's'} across ${selection.books.length} ` +
        `book${selection.books.length === 1 ? '' : 's'} → ${OUTPUT_PATH}\n`,
    );
  } else {
    const allTips = values.get('');
    process.stdout.write(
      `build-tips: ${allTips.length} tip${allTips.length === 1 ? '' : 's'} → ${OUTPUT_PATH}\n`,
    );
  }
}

main().catch((err) => {
  const message = String(err?.message ?? err);
  const prefix = DIAGNOSTIC_SCOPE ? `[book:${DIAGNOSTIC_SCOPE}] ` : '';
  console.error(
    message.startsWith('[book:') ? message : `${prefix}build-tips: failed: ${message}`,
  );
  process.exit(1);
});

// Export for tests.
export { extractTips };
