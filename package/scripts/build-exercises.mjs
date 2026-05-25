#!/usr/bin/env node
/**
 * scripts/build-exercises.mjs — emit src/data/exercises.json from <Exercise>
 * instances in chapter MDX (v4.4.0, closes v4.3.0 backlog).
 *
 * Sister script to build-tips.mjs (v4.3.0). Scans chapters honoring
 * loader.base override (via readChaptersBase from walk-mdx.mjs). Extracts
 * <Exercise id="X">body</Exercise> via 4-branch regex (same quote-style
 * portability lesson as build-tips). Emits a chapter-keyed object so the
 * /exercises route + <ExerciseSolutions auto> can scope by chapter.
 *
 * Output shape:
 *   {
 *     "ch1-foundations": [
 *       { "id": "ex-1", "problem": "Given..." },
 *       { "id": "ex-2", "problem": "Refactor..." }
 *     ],
 *     ...
 *   }
 *
 * Graceful no-op: if no <Exercise> instances exist, writes {} (doesn't
 * fail builds for consumers who don't use the feature).
 */
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { resolve, dirname, basename } from 'node:path';
import { walkMdx, readChaptersBase } from './walk-mdx.mjs';

const USAGE = `Usage: book-scaffold build-exercises

Scan chapter MDX for <Exercise id="X">body</Exercise> occurrences; emit
src/data/exercises.json keyed by chapter slug. Used by the /exercises
auto-route + <ExerciseSolutions auto> mode when routes.exercises: true.

Env:
  BOOK_CHAPTERS_DIR        Override chapters dir (default: src/content/chapters).
  BOOK_EXERCISES_OUT       Override output path (default: src/data/exercises.json).

Options:
  --help, -h               Print this message and exit (non-mutating).
`;

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  process.stdout.write(USAGE);
  process.exit(0);
}

const CWD = process.cwd();
const CHAPTERS_DIR = await readChaptersBase(CWD);
const OUTPUT_PATH = process.env.BOOK_EXERCISES_OUT ?? 'src/data/exercises.json';

/**
 * Extract <Exercise id="..."> tags and their body content from MDX.
 *
 * Returns array of { id, problem }. Problem is the full body content
 * (trimmed + whitespace-normalized); the /exercises route + ExerciseSolutions
 * auto truncate for display. Full content kept so consumers using
 * `<ExerciseSolutions auto />` see the entire problem statement.
 *
 * Limitations (same as build-tips):
 *   - Doesn't handle nested <Exercise> tags
 *   - String attributes must use single OR double quotes (not template literals)
 *   - id may not contain a literal quote of the same type used as delimiter
 */
function extractExercises(source) {
  const exercises = [];
  // 4-branch alternation (single/single, double/double, mixed) — no
  // backreference for cross-runtime regex portability (v4.1.2 lesson).
  // Since Exercise has only 1 attribute (id), we just need 2 branches.
  const re = new RegExp(
    [
      `<Exercise\\s+id="([^"]+)"\\s*>([\\s\\S]*?)</Exercise>`,
      `<Exercise\\s+id='([^']+)'\\s*>([\\s\\S]*?)</Exercise>`,
    ].join('|'),
    'g',
  );
  for (const match of source.matchAll(re)) {
    const [, id1, body1, id2, body2] = match;
    const id = id1 || id2;
    const body = body1 || body2 || '';
    if (!id) continue;
    const problem = body.trim().replace(/\s+/g, ' ');
    exercises.push({ id, problem });
  }
  return exercises;
}

async function main() {
  const byChapter = {};
  let totalExercises = 0;
  let chaptersWithExercises = 0;

  for await (const rel of walkMdx(CHAPTERS_DIR)) {
    const chapterPath = resolve(CHAPTERS_DIR, rel);
    const chapterSlug = basename(rel).replace(/\.mdx?$/, '');
    let source;
    try {
      source = await readFile(chapterPath, 'utf8');
    } catch {
      continue;
    }
    const exercises = extractExercises(source);
    if (exercises.length > 0) {
      byChapter[chapterSlug] = exercises;
      totalExercises += exercises.length;
      chaptersWithExercises += 1;
    }
  }

  const outPath = resolve(CWD, OUTPUT_PATH);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(byChapter, null, 2) + '\n');
  process.stdout.write(
    `build-exercises: ${totalExercises} exercise${totalExercises === 1 ? '' : 's'} across ` +
      `${chaptersWithExercises} chapter${chaptersWithExercises === 1 ? '' : 's'} → ${OUTPUT_PATH}\n`,
  );
}

main().catch((err) => {
  console.error('build-exercises: failed');
  console.error(err.message ?? err);
  process.exit(1);
});

// Export for tests.
export { extractExercises };
