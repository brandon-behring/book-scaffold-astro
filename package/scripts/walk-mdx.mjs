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
 * `defineBookSchemas({ preset?, profile?, chaptersBase? })` options.
 *
 * v4.7.0 (closes #75): consumers using the v4.5+ canonical form
 *
 *   export const { collections } = defineBookSchemas({
 *     preset: 'research-portfolio',
 *     chaptersBase: './src/content/textbook',
 *   });
 *
 * previously had BOTH options ignored by the CLI scripts. `validate` and
 * `build-labels` resolved preset only from env vars and walked the default
 * chapters dir, silently checking the wrong directory under the wrong
 * profile while astro build applied the correct settings — a divergence
 * masking real schema drift.
 *
 * Strategy: regex-parse the source file (avoid runtime import; the file
 * imports from `astro:content` / `astro/loaders` which don't resolve in
 * plain Node). Captures the entire `defineBookSchemas({ ... })` options
 * object, then field-by-field regex within that scope for `preset:`,
 * `profile:` (alias), and `chaptersBase:`.
 *
 * Returns `{ preset, chaptersBase }` — both nullable. Returns `null` for
 * either field when:
 *   - content.config.{ts,mjs,js} doesn't exist
 *   - no `defineBookSchemas(...)` call found
 *   - the field is absent or uses a dynamic form (variable, template literal)
 *
 * `preset` and `profile` are aliases (canonical name flipped in v3.7+);
 * `preset` wins when both are present.
 */
export async function readBookSchemaConfig(projectRoot) {
  const result = { preset: null, chaptersBase: null };
  for (const ext of ['ts', 'mjs', 'js']) {
    const configPath = join(projectRoot, `src/content.config.${ext}`);
    if (!existsSync(configPath)) continue;
    let source;
    try {
      source = await readFile(configPath, 'utf8');
    } catch {
      return result;
    }
    // Match `defineBookSchemas({ ... })` — capture the options object body.
    // Non-greedy `[\s\S]*?` matches the smallest balanced-enough scope; for
    // typical configs the options object is small (≤200 chars) and any
    // nested braces (uncommon in this API) would terminate the match early.
    // Acceptable trade-off: simple regex over a real parser.
    const callMatch = source.match(
      /\bdefineBookSchemas\s*\(\s*\{([\s\S]*?)\}\s*\)/,
    );
    if (callMatch) {
      const optsBody = callMatch[1];
      // preset is canonical (v3.7+); profile is backward-compat alias.
      const presetMatch =
        optsBody.match(/\bpreset\s*:\s*'([^']+)'/) ||
        optsBody.match(/\bpreset\s*:\s*"([^"]+)"/);
      const profileMatch =
        optsBody.match(/\bprofile\s*:\s*'([^']+)'/) ||
        optsBody.match(/\bprofile\s*:\s*"([^"]+)"/);
      result.preset = presetMatch?.[1] ?? profileMatch?.[1] ?? null;
      const chaptersBaseMatch =
        optsBody.match(/\bchaptersBase\s*:\s*'([^']+)'/) ||
        optsBody.match(/\bchaptersBase\s*:\s*"([^"]+)"/);
      result.chaptersBase = chaptersBaseMatch?.[1] ?? null;
    }
    // First existing file wins (priority: .ts > .mjs > .js).
    return result;
  }
  // No content.config.{ts,mjs,js} at all.
  return result;
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
 * v4.7.0 (closes #75): when the raw Astro form isn't present, also consult
 * `readBookSchemaConfig()` for `defineBookSchemas({ chaptersBase })`.
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
 *     AND no `defineBookSchemas({ chaptersBase: ... })` form found
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
    // v4.7.0 (closes #75): no raw Astro form match — try the v4.5+ form
    // `defineBookSchemas({ chaptersBase: '...' })`.
    const schemaConfig = await readBookSchemaConfig(projectRoot);
    if (schemaConfig.chaptersBase) {
      return resolve(projectRoot, schemaConfig.chaptersBase);
    }
    // File exists but no override found — assume the consumer uses the
    // scaffold's defineBookSchemas() default.
    return DEFAULT_BASE;
  }
  // No content.config.{ts,mjs,js} at all — return the Astro 5 default.
  return DEFAULT_BASE;
}
