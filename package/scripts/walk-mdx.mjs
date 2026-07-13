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

/**
 * Mask JS/TS comments and string/template contents with spaces while
 * preserving offsets and newlines. Collection detection runs against this
 * mask so prose such as "default chapters" and code examples in comments
 * cannot bind to a later, unrelated collection's `base:` property.
 */
function codeMask(source) {
  // split('') preserves UTF-16 code-unit offsets used by RegExp#index even
  // when a preceding comment contains an emoji/non-BMP character.
  const out = source.split('');
  let state = 'code';
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];

    if (state === 'line-comment') {
      if (char === '\n') state = 'code';
      else out[i] = ' ';
      continue;
    }
    if (state === 'block-comment') {
      if (char === '*' && next === '/') {
        out[i] = ' ';
        out[i + 1] = ' ';
        i += 1;
        state = 'code';
      } else if (char !== '\n') {
        out[i] = ' ';
      }
      continue;
    }
    if (state === 'single' || state === 'double' || state === 'template') {
      const closing = state === 'single' ? "'" : state === 'double' ? '"' : '`';
      if (char === '\\') {
        out[i] = ' ';
        if (i + 1 < source.length) {
          if (source[i + 1] !== '\n') out[i + 1] = ' ';
          i += 1;
        }
      } else {
        if (char === closing) state = 'code';
        if (char !== '\n') out[i] = ' ';
      }
      continue;
    }

    if (char === '/' && next === '/') {
      out[i] = ' ';
      out[i + 1] = ' ';
      i += 1;
      state = 'line-comment';
    } else if (char === '/' && next === '*') {
      out[i] = ' ';
      out[i + 1] = ' ';
      i += 1;
      state = 'block-comment';
    } else if (char === "'") {
      out[i] = ' ';
      state = 'single';
    } else if (char === '"') {
      out[i] = ' ';
      state = 'double';
    } else if (char === '`') {
      out[i] = ' ';
      state = 'template';
    }
  }
  return out.join('');
}

/** Find an actual `chapters = defineCollection(...)` call and return its body
 * plus an offset-preserving code mask. Supports declaration and object-property
 * forms without relying on a distance from any arbitrary `chapters` word. */
function findChaptersCollectionCall(source) {
  const mask = codeMask(source);
  const starts = [
    /\b(?:const|let|var)\s+chapters\s*=\s*defineCollection\s*\(/g,
    /(?:^|[,{])\s*chapters\s*:\s*defineCollection\s*\(/gm,
  ];
  const matches = [];
  for (const pattern of starts) {
    for (const match of mask.matchAll(pattern)) {
      matches.push({ index: match.index, open: match.index + match[0].lastIndexOf('(') });
    }
  }
  matches.sort((a, b) => a.index - b.index);

  for (const match of matches) {
    let depth = 0;
    for (let i = match.open; i < mask.length; i += 1) {
      if (mask[i] === '(') depth += 1;
      else if (mask[i] === ')') {
        depth -= 1;
        if (depth === 0) {
          return {
            body: source.slice(match.open + 1, i),
            mask: mask.slice(match.open + 1, i),
          };
        }
      }
    }
  }
  return null;
}

export async function* walkMdx(dir, baseDir = dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return; // optional content dir absent
    throw error;
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    // Astro's content glob excludes every path segment beginning with `_`.
    // Apply the same convention centrally so all artifact producers and
    // validate see an identical content set, including nested draft dirs.
    if (entry.name.startsWith('_')) continue;
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
export async function readChaptersBase(projectRoot, { corpus = null } = {}) {
  const envOverride = process.env.BOOK_CHAPTERS_DIR;
  if (envOverride) {
    return resolve(projectRoot, envOverride);
  }
  // A corpus registers first-segment book ids under one shared content root;
  // single-book projects retain Astro's historical `chapters/` directory.
  const DEFAULT_BASE = resolve(
    projectRoot,
    corpus ? 'src/content' : 'src/content/chapters',
  );
  for (const ext of ['ts', 'mjs', 'js']) {
    const configPath = join(projectRoot, `src/content.config.${ext}`);
    if (!existsSync(configPath)) continue;
    let source;
    try {
      source = await readFile(configPath, 'utf8');
    } catch {
      return DEFAULT_BASE;
    }
    // Look for an actual `chapters` collection's `loader.base` string. The
    // older "chapters word, then any base within 500 chars" regex could start
    // in a comment or `...scaffold.collections` and steal the following
    // supplements collection's base (#147 handbook dogfood).
    //
    // Forms matched:
    //   - `const chapters = defineCollection({ loader: glob({ base: './foo' }) })`
    //   - `export const collections = { chapters: defineCollection({ loader: glob({ base: './foo' }) }) }`
    //   - any indentation / line break style
    const collectionCall = findChaptersCollectionCall(source);
    let captured = null;
    if (collectionCall) {
      const loader = /\bloader\s*:/.exec(collectionCall.mask);
      const base = loader
        ? /\bbase\s*:/.exec(collectionCall.mask.slice(loader.index + loader[0].length))
        : null;
      if (base) {
        const valueOffset = loader.index + loader[0].length + base.index + base[0].length;
        const literal = collectionCall.body.slice(valueOffset).match(/^\s*(?:'([^']+)'|"([^"]+)")/);
        captured = literal && (literal[1] || literal[2]);
      }
    }
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
