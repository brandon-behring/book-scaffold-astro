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
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

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

/**
 * Read the consumer's `content.config.ts` (or `.mjs` / `.js`) and extract
 * the `loader.base` path for the `chapters` content collection.
 *
 * v4.1.1 (closes #63): consumers in the multi-guide / multi-book pattern
 * override the chapters dir to `src/content/<guide-slug>` rather than the
 * Astro 5 default `src/content/chapters/`. Without this helper,
 * `book-scaffold validate` + `book-scaffold build-labels` silently report
 * 0 chapters because they walk the default path. This helper parses the
 * consumer's config file and returns the actual base path so both scripts
 * discover the consumer's chapter files.
 *
 * Strategy: regex-parse the source file (avoid runtime import; the file
 * imports from `astro:content` / `astro/loaders` which don't resolve in
 * plain Node). Matches both single- and double-quoted string literals;
 * matches paths with or without the `./` prefix.
 *
 * Returns the resolved absolute path. Falls back to
 * `${projectRoot}/src/content/chapters` when:
 *   - content.config.{ts,mjs,js} doesn't exist
 *   - the file exists but no `chapters` collection or `loader.base` found
 *   - the matched base path uses dynamic forms (variables, template literals)
 *     instead of a string literal
 *
 * Honors env override: BOOK_CHAPTERS_DIR (when set) wins over config parse.
 */
export async function readChaptersBase(projectRoot) {
  const envOverride = process.env.BOOK_CHAPTERS_DIR;
  if (envOverride) {
    return resolve(projectRoot, envOverride);
  }
  const DEFAULT_BASE = resolve(projectRoot, 'src/content/chapters');
  for (const ext of ['ts', 'mjs', 'js']) {
    const configPath = join(projectRoot, `src/content.config.${ext}`);
    if (!existsSync(configPath)) continue;
    let source;
    try {
      source = await readFile(configPath, 'utf8');
    } catch {
      return DEFAULT_BASE;
    }
    // Look for a `chapters` collection's `loader.base` string. Permissive
    // form: match the `chapters` identifier, then within the next 500
    // chars find `base: 'string'` or `base: "string"`. NOT template
    // literals (which use backticks and may contain ${} interpolation —
    // those fall back to the default since the value is dynamic).
    //
    // Forms matched:
    //   - `const chapters = defineCollection({ loader: glob({ base: './foo' }) })`
    //   - `export const collections = { chapters: defineCollection({ loader: glob({ base: './foo' }) }) }`
    //   - any indentation / line break style
    const re = /\bchapters\b[\s\S]{0,500}?\bbase\s*:\s*'([^']+)'|\bchapters\b[\s\S]{0,500}?\bbase\s*:\s*"([^"]+)"/;
    const m = source.match(re);
    const captured = m && (m[1] || m[2]);
    if (captured) {
      return resolve(projectRoot, captured);
    }
    // File exists but no override found — assume the consumer uses the
    // scaffold's defineBookSchemas() default.
    return DEFAULT_BASE;
  }
  // No content.config.{ts,mjs,js} at all — return the Astro 5 default.
  return DEFAULT_BASE;
}
