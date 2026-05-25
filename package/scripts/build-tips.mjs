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

const USAGE = `Usage: book-scaffold build-tips

Scan chapter MDX for <Tip n="N" title="T">body</Tip> occurrences; emit
src/data/tips.json sorted by n. Used by the /tips auto-route + <TipsCard>
component when routes.tips: true.

Env:
  BOOK_CHAPTERS_DIR   Override chapters dir (default: src/content/chapters).
  BOOK_TIPS_OUT       Override output path (default: src/data/tips.json).

Options:
  --help, -h          Print this message and exit (non-mutating).
`;

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  process.stdout.write(USAGE);
  process.exit(0);
}

const CWD = process.cwd();
const CHAPTERS_DIR = await readChaptersBase(CWD);
const OUTPUT_PATH = process.env.BOOK_TIPS_OUT ?? 'src/data/tips.json';

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
  const allTips = [];
  for await (const rel of walkMdx(CHAPTERS_DIR)) {
    const chapterPath = resolve(CHAPTERS_DIR, rel);
    const chapterSlug = basename(rel).replace(/\.mdx?$/, '');
    let source;
    try {
      source = await readFile(chapterPath, 'utf8');
    } catch {
      continue;
    }
    allTips.push(...extractTips(source, chapterSlug));
  }

  // Sort by n; warn on duplicates (don't fail — the index page just shows duplicates).
  allTips.sort((a, b) => a.n - b.n);
  const seenN = new Set();
  for (const tip of allTips) {
    if (seenN.has(tip.n)) {
      process.stderr.write(`build-tips: WARN duplicate Tip n="${tip.n}" (last wins on /tips index)\n`);
    }
    seenN.add(tip.n);
  }

  const outPath = resolve(CWD, OUTPUT_PATH);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(allTips, null, 2) + '\n');
  process.stdout.write(`build-tips: ${allTips.length} tip${allTips.length === 1 ? '' : 's'} → ${OUTPUT_PATH}\n`);
}

main().catch((err) => {
  console.error('build-tips: failed');
  console.error(err.message ?? err);
  process.exit(1);
});

// Export for tests.
export { extractTips };
