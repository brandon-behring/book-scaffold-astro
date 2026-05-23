/**
 * scripts/walk-mdx.mjs — recursive .md/.mdx file walker for content trees.
 *
 * Extracted from scripts/validate.mjs in v3.7.1 (closes #52) so it can be
 * unit-tested without running validate's side-effectful top-level await.
 *
 * Replaces the previous `glob` import from `node:fs/promises` (Node 22+
 * only). The walker below uses `readdir` only — works on Node 18+ so
 * consumer CIs running `node-version: '20'` no longer crash on the
 * scaffold's prebuild validate hook.
 *
 * Output: relative paths in POSIX form ("subdir/file.mdx"), matching what
 * the previous `glob('**\/*.{md,mdx}', { cwd })` produced.
 */
import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

export async function* walkMdx(dir, baseDir = dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return; // dir missing or unreadable — treat as zero chapters
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkMdx(full, baseDir);
    } else if (/\.(md|mdx)$/.test(entry.name)) {
      // Normalize to forward slashes for cross-platform stability.
      yield relative(baseDir, full).split(/[\\/]/).join('/');
    }
  }
}
