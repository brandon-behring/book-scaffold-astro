#!/usr/bin/env node
/**
 * validate.mjs — pre-flight check for book content.
 *
 * Catches authoring errors that astro build either misses or surfaces
 * with insufficient context. Designed to run in <2 s on a medium-sized
 * book so it's pre-commit-hook friendly.
 *
 * Checks performed (per Q14 in the v2.0 plan):
 *   1. <Cite key="..." /> — key exists in src/data/references.json.
 *   2. <XRef id="..." /> — id exists in src/data/labels.json.
 *   3. <Figure src="/path/..." /> — file exists under public/.
 *   4. Internal markdown links [text](/foo) — target resolves.
 *   5. <CodeRef path="..." line={N} /> — when BOOK_REPO_ROOT set,
 *      path exists + line in bounds.
 *   6. <Theorem> — has a resolvable kind= (or legacy type=); else it would
 *      render an empty label and throw at build (#121).
 *   7. <BookLink book="…" to="…"> (#96) — both props present, and book= is a
 *      key in the consumer's siblingBooks registry (best-effort).
 *
 * Run from the consumer's project root. Closes #8 (was resolving paths
 * from the package's own directory inside node_modules — false negatives
 * across all reference consumers).
 *
 * Usage:
 *   book-scaffold validate
 *   book-scaffold validate --preset academic
 *   BOOK_REPO_ROOT=/abs/path npx book-scaffold validate
 *
 * Exit code = total failure count (0 = pass, >=1 = errors).
 */
import { readFile, access } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { walkMdx, readChaptersBase, readBookSchemaConfig } from './walk-mdx.mjs';

/**
 * Best-effort .env reader. Mirrors `readEnvFile` in src/types.ts; kept inline
 * here because scripts/ is shipped as plain JS without compiling src/.
 *
 * Closes #20 — validate.mjs previously skipped the .env fallback that
 * `resolveProfileWithSource` honors, so consumers who set BOOK_PROFILE in
 * .env (per the SKILL.md and scaffold's create-book defaults) saw the CLI
 * silently default to minimal, masking academic-profile errors.
 */
function readEnvFile(path = '.env') {
  try {
    if (!existsSync(path)) return {};
    const out = {};
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      let val = m[2] ?? '';
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      out[m[1]] = val;
    }
    return out;
  } catch {
    return {};
  }
}

// --help / -h: non-mutating (closes #14).
const USAGE = `Usage: book-scaffold validate [--preset <name>]

Pre-flight content validator. Checks Cite keys, XRef ids, Figure srcs,
internal markdown links, and (when BOOK_REPO_ROOT is set) CodeRef paths.

Options:
  --preset <name>    academic | tools | minimal | course-notes
                     (overrides BOOK_PRESET / BOOK_PROFILE env)
  --help, -h         Print this message and exit (non-mutating).

Env:
  BOOK_PRESET        Preset name (preferred over BOOK_PROFILE).
  BOOK_PROFILE       Backward-compat alias for BOOK_PRESET.
  BOOK_REPO_ROOT     Absolute path to a sibling code repo for CodeRef checks.

Exit code = total failure count.
`;

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  process.stdout.write(USAGE);
  process.exit(0);
}

// --preset <name> CLI flag (closes #9 — single source of truth across
// defineBookConfig + validate).
const argv = process.argv.slice(2);
const presetFlagIdx = argv.findIndex((a) => a === '--preset');
const presetFromFlag = presetFlagIdx >= 0 ? argv[presetFlagIdx + 1] : undefined;

// v3.4.0: ROOT is the consumer's CWD, not the package's own dir.
// Resolves issue #8 — three reference consumers reported "0 chapter(s) checked"
// because ROOT was the package directory inside node_modules.
const ROOT = process.cwd();
// v4.1.1 (closes #63): read the consumer's content.config.{ts,mjs,js} to
// honor `loader.base` overrides (multi-guide pattern uses
// `src/content/<guide-slug>/` instead of the Astro 5 default).
// Falls back to `src/content/chapters` when no override / no config file.
const CHAPTERS_DIR = await readChaptersBase(ROOT);
const PUBLIC_DIR = resolve(ROOT, 'public');
const DATA_DIR = resolve(ROOT, 'src/data');

// Preset resolution (matches resolvePreset in src/types.ts):
//   --preset flag > BOOK_PRESET env > BOOK_PROFILE env >
//   .env BOOK_PRESET > .env BOOK_PROFILE >
//   defineBookSchemas({ preset }) in content.config.ts >
//   defineBookSchemas({ profile }) in content.config.ts (alias) >
//   'minimal'.
// .env fallback closes #20 — without it, consumers who set BOOK_PROFILE in
// .env (the documented convenience in SKILL.md + create-book defaults) saw
// the CLI silently default to minimal, hiding academic-profile errors.
// content.config.ts fallback closes #75 — without it, consumers using the
// canonical v4.5+ defineBookSchemas({ preset, chaptersBase }) form had the
// CLI silently default to minimal, hiding research-portfolio (and any
// non-env-set) profile errors while astro build applied the correct settings.
const dotenv = readEnvFile(resolve(ROOT, '.env'));
const schemaConfig = await readBookSchemaConfig(ROOT);
const PRESET =
  presetFromFlag ??
  process.env.BOOK_PRESET ??
  process.env.BOOK_PROFILE ??
  dotenv.BOOK_PRESET ??
  dotenv.BOOK_PROFILE ??
  schemaConfig.preset ??
  'minimal';
// Alias kept for downstream message text only; the resolution above is canonical.
const PROFILE = PRESET;
const REPO_ROOT = process.env.BOOK_REPO_ROOT ?? null;

// v4.6.0 (issue #76 Layer 3b): chapter-route shadow warning. Detect a
// consumer-owned `src/pages/chapters/[...slug].astro` that shadows the
// scaffold v4.3.0+ auto-injected route. Non-blocking — emits to stderr,
// validate continues normally. Suppressed when the consumer explicitly
// disabled the scaffold's chapter route (intentional override).
//
// Edge cases per issue #76:
//   file + routes.chapters undefined/true → WARN
//   file + routes.chapters: false         → silent (intentional override)
//   no file (any routes config)           → silent
//
// Heuristic for "routes.chapters: false": regex-grep astro.config.mjs for
// the literal `chapters: false`. Light-touch detection that matches the
// issue's warning-not-error intent; consumers wanting a stricter detector
// can run `astro check` separately.
{
  const consumerChapterRoute = resolve(ROOT, 'src/pages/chapters/[...slug].astro');
  if (existsSync(consumerChapterRoute)) {
    const astroConfigPath = resolve(ROOT, 'astro.config.mjs');
    let chaptersDisabled = false;
    if (existsSync(astroConfigPath)) {
      const astroConfig = readFileSync(astroConfigPath, 'utf8');
      // Match `chapters: false` (with optional whitespace) inside a routes
      // object. Slight false-positive risk on commented-out code; acceptable
      // for a non-blocking warning.
      chaptersDisabled = /\bchapters\s*:\s*false\b/.test(astroConfig);
    }
    if (!chaptersDisabled) {
      console.warn(
        `\n⚠ Consumer-owned chapter route at src/pages/chapters/[...slug].astro\n` +
        `  shadows the scaffold v4.3.0+ auto-injected route. Either:\n` +
        `  • Delete the consumer file to defer to the scaffold (recommended), OR\n` +
        `  • Set 'routes: { chapters: false }' in defineBookConfig to keep\n` +
        `    your override (intentional).\n` +
        `  See: package/recipes/18-chapter-route-ownership.md\n`,
      );
    }
  }
}

const errors = [];
const warnings = [];
const fail = (file, line, msg) => errors.push({ file, line, msg });
const warn = (file, line, msg) => warnings.push({ file, line, msg });

// ===== Load reference data (graceful when missing) =====
async function loadJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return {};
  }
}
const refs = await loadJson(join(DATA_DIR, 'references.json'));
const labels = await loadJson(join(DATA_DIR, 'labels.json'));

// ===== Collect chapter files =====
// v3.7.1 (closes #52): walkMdx (in ./walk-mdx.mjs) is a recursive readdir
// walker that replaces the previous `glob` import from `node:fs/promises`.
// The `glob` API was added in Node 22 but consumer CI templates ship
// Node 20 — `npm run validate` crashed on every consumer's prebuild hook.
// Walker uses readdir + path only; works on Node 18+.
const chapterFiles = [];
for await (const f of walkMdx(CHAPTERS_DIR)) {
  if (!f.split('/').pop().startsWith('_')) chapterFiles.push(f);
}

// ===== Build slug set from chapter filenames (for internal-link check) =====
const validSlugs = new Set(chapterFiles.map((f) => f.replace(/\.(md|mdx)$/, '')));
const validTopLevelRoutes = new Set([
  '/', '/chapters/', '/references/', '/search/', '/print/', '/convergence/',
]);

// ===== Pattern helpers (regex-based; cheap, good enough for MDX) =====
const RE_CITE = /<Cite[^>]+key=["']([^"']+)["']/g;
const RE_XREF = /<XRef[^>]+id=["']([^"']+)["']/g;
const RE_FIGURE = /<Figure[^>]+src=["']([^"']+)["']/g;
const RE_CODEREF = /<CodeRef[^>]+path=["']([^"']+)["'](?:[^>]*line=\{(\d+)\})?(?:[^>]*lineEnd=\{(\d+)\})?/g;
const RE_MD_LINK = /\[(?:[^\]]*)\]\((\/[^)\s#]+)(?:#[^)]*)?\)/g;
// #121: a <Theorem> opening tag — capture its attributes to assert a
// resolvable kind= (or legacy type=) is present.
const RE_THEOREM = /<Theorem\b([^>]*)>/g;
// #96: a <BookLink> opening tag — assert book= + to= present, and (best-effort)
// that book= is a registered sibling.
const RE_BOOKLINK = /<BookLink\b([^>]*)>/g;

async function fileExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function lineOf(content, idx) {
  return content.slice(0, idx).split('\n').length;
}

// #96: best-effort siblingBooks registry keys from astro.config.mjs, so the
// <BookLink> check can flag an unknown book= earlier than the component's
// build-time throw. null = couldn't determine → membership not checked (the
// component still fails loud at build).
let siblingBookKeys = null;
{
  const astroConfigPath = resolve(ROOT, 'astro.config.mjs');
  if (existsSync(astroConfigPath)) {
    const block = readFileSync(astroConfigPath, 'utf8').match(/siblingBooks\s*:\s*\{([^}]*)\}/);
    if (block) {
      // Anchor each key to an entry boundary ({ , or start) so the `https:` in
      // a URL value isn't mistaken for a key.
      siblingBookKeys = new Set(
        [...block[1].matchAll(/(?:^|[{,])\s*['"]?([\w-]+)['"]?\s*:/g)].map((x) => x[1]),
      );
    }
  }
}

// ===== Run all checks on each chapter =====
for (const rel of chapterFiles) {
  const abs = join(CHAPTERS_DIR, rel);
  const content = await readFile(abs, 'utf8');

  // 1. Cite keys (academic profile only — tools profile uses YAML manifest)
  if (PROFILE === 'academic') {
    for (const m of content.matchAll(RE_CITE)) {
      if (!refs[m[1]]) fail(rel, lineOf(content, m.index), `Unknown bibkey "${m[1]}" — not in references.json`);
    }
  }

  // 2. XRef ids
  for (const m of content.matchAll(RE_XREF)) {
    if (!labels[m[1]]) fail(rel, lineOf(content, m.index), `Unknown XRef id "${m[1]}" — not in labels.json`);
  }

  // 3. Figure src exists in public/
  for (const m of content.matchAll(RE_FIGURE)) {
    const src = m[1];
    if (src.startsWith('http')) continue; // external image
    const path = src.startsWith('/') ? join(PUBLIC_DIR, src) : join(dirname(abs), src);
    if (!(await fileExists(path))) {
      fail(rel, lineOf(content, m.index), `Figure src "${src}" not found at ${path}`);
    }
  }

  // 4. Internal markdown links resolve
  for (const m of content.matchAll(RE_MD_LINK)) {
    const target = m[1].replace(/\/$/, '');
    if (validTopLevelRoutes.has(target + '/') || validTopLevelRoutes.has(target)) continue;
    const chMatch = target.match(/^\/chapters\/(.+)$/);
    if (chMatch && validSlugs.has(chMatch[1])) continue;
    warn(rel, lineOf(content, m.index), `Internal link "${m[1]}" — target may not resolve (check spelling or route)`);
  }

  // 5. CodeRef path + line bounds (only when BOOK_REPO_ROOT set)
  if (REPO_ROOT) {
    for (const m of content.matchAll(RE_CODEREF)) {
      const [, path, lineStart, lineEnd] = m;
      const abs2 = resolve(REPO_ROOT, path);
      if (!(await fileExists(abs2))) {
        fail(rel, lineOf(content, m.index), `CodeRef path "${path}" not found at ${abs2}`);
        continue;
      }
      if (lineStart) {
        const fileLineCount = (await readFile(abs2, 'utf8')).split('\n').length;
        const lo = Number(lineStart);
        const hi = lineEnd ? Number(lineEnd) : lo;
        if (lo > fileLineCount || hi > fileLineCount) {
          fail(rel, lineOf(content, m.index), `CodeRef line ${lo}-${hi} exceeds file length (${fileLineCount}) in "${path}"`);
        }
      }
    }
  }

  // 6. Theorem requires a resolvable kind (#121) — kind= canonical, type=
  //    legacy alias. Catches the silent-empty-label / build-throw case at the
  //    earliest gate. (Value typos are caught at build by theoremLabel's throw.)
  for (const m of content.matchAll(RE_THEOREM)) {
    if (!/\b(?:kind|type)\s*=/.test(m[1])) {
      fail(
        rel,
        lineOf(content, m.index),
        `<Theorem> has no kind= (or legacy type=) — renders an empty label / throws at build. Add e.g. kind="theorem".`,
      );
    }
  }

  // 7. BookLink (#96): structural (book= + to=) + best-effort registry membership.
  for (const m of content.matchAll(RE_BOOKLINK)) {
    const attrs = m[1];
    const bookMatch = attrs.match(/\bbook=["']([^"']+)["']/);
    if (!bookMatch || !/\bto=["']/.test(attrs)) {
      fail(rel, lineOf(content, m.index), `<BookLink> requires both book="…" and to="…".`);
      continue;
    }
    if (siblingBookKeys && !siblingBookKeys.has(bookMatch[1])) {
      fail(
        rel,
        lineOf(content, m.index),
        `<BookLink book="${bookMatch[1]}"> — not in defineBookConfig siblingBooks (${[...siblingBookKeys].join(', ') || 'none'}). Register it or fix the key.`,
      );
    }
  }
}

// ===== v4.6.0 (issue #77): missing-prereq re-framing =====
//
// When errors are downstream symptoms of a missing artifact (references.json
// or labels.json), abort with ONE leading error pointing at the prereq
// instead of printing 25 "Unknown bibkey" / "Unknown XRef" symptoms. Single
// clean signal: fix the prereq. Per D12 of the v4.6.0 plan.
{
  if (PROFILE === 'academic') {
    const refsPath = join(DATA_DIR, 'references.json');
    const hasBibkeyErrors = errors.some((e) => /Unknown bibkey/.test(e.msg));
    if (hasBibkeyErrors && !existsSync(refsPath)) {
      console.error(
        `\n✗ Validate cannot run: src/data/references.json is missing.\n\n` +
          `This file is generated from bibliography.bib by 'npm run build:bib'.\n` +
          `Run that first, OR adopt the prevalidate npm hook convention so\n` +
          `'npm run validate' regenerates it automatically:\n\n` +
          `  "prevalidate": "npm run build:bib && npm run build:labels --if-present"\n` +
          `  "validate": "book-scaffold validate"\n\n` +
          `See package/recipes/19-prevalidate-hook.md.\n`,
      );
      process.exit(1);
    }
  }
  const labelsPath = join(DATA_DIR, 'labels.json');
  const hasXrefErrors = errors.some((e) => /Unknown XRef/.test(e.msg));
  if (hasXrefErrors && !existsSync(labelsPath)) {
    console.error(
      `\n✗ Validate cannot run: src/data/labels.json is missing.\n\n` +
        `This file is generated from <Theorem id="..."> and <Figure id="..."> markers\n` +
        `in chapter MDX by 'npm run build:labels'. Run that first, OR adopt the\n` +
        `prevalidate npm hook convention so 'npm run validate' regenerates it:\n\n` +
        `  "prevalidate": "npm run build:bib && npm run build:labels --if-present"\n\n` +
        `See package/recipes/19-prevalidate-hook.md.\n`,
    );
    process.exit(1);
  }
}

// ===== Report =====
const format = ({ file, line, msg }) => `  ${file}:${line}  ${msg}`;
if (warnings.length > 0) {
  console.warn(`validate: ${warnings.length} warning(s):`);
  warnings.forEach((w) => console.warn(format(w)));
}
if (errors.length === 0) {
  console.log(`validate: ✓ ${chapterFiles.length} chapter(s) checked (profile=${PROFILE}); no errors.`);
  process.exit(0);
}
console.error(`validate: ✗ ${errors.length} error(s) in ${chapterFiles.length} chapter(s) (profile=${PROFILE}):`);
errors.forEach((e) => console.error(format(e)));
process.exit(errors.length);
