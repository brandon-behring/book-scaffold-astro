#!/usr/bin/env node
/**
 * validate.mjs — pre-flight check for book content.
 *
 * Catches authoring errors that astro build either misses or surfaces
 * with insufficient context. Designed to run in <2 s on a medium-sized
 * book so it's pre-commit-hook friendly.
 *
 * Checks performed (per Q14 in the v2.0 plan):
 *
 *   1. <Cite key="..." /> — key exists in src/data/references.json.
 *      (Cite.astro already throws on unknown keys at build time; we
 *      surface ALL bad keys at once instead of failing on the first.)
 *
 *   2. <XRef id="..." /> — id exists in src/data/labels.json. XRef
 *      doesn't fail the build for unknown ids; without this check,
 *      typos ship to readers as "[?label]" placeholders.
 *
 *   3. <Figure src="/path/..." /> — referenced file exists under
 *      public/. Figure.astro renders a broken-image icon otherwise.
 *
 *   4. Internal markdown links [text](/foo) — target resolves to a
 *      known chapter slug or a known top-level route. External (http*)
 *      links are not checked (would need network IO).
 *
 *   5. <CodeRef path="..." line={N} /> — when run inside a repo
 *      whose root is BOOK_REPO_ROOT, the path exists and the line
 *      number is within file bounds. Skipped when BOOK_REPO_ROOT
 *      isn't set (the scaffold default; only meaningful for academic
 *      books that paired with an experiments/ subtree).
 *
 * What this DOESN'T do (and why):
 *   - frontmatter Zod validation — already done by astro build's
 *     content-collection sync.
 *   - MDX renders — same; astro build will fail.
 *   - KaTeX strict-mode — covered by rehype-katex when academic
 *     profile is active; undefined macros become build errors.
 *
 * Usage:
 *   node scripts/validate.mjs
 *   BOOK_REPO_ROOT=/abs/path/to/code/repo node scripts/validate.mjs
 *
 * Exit code = total failure count (0 = pass, ≥1 = errors).
 *
 * Wire into:
 *   - package.json scripts: "validate": "node scripts/validate.mjs"
 *   - pre-commit hook: .pre-commit-config.yaml
 *   - CI build pipeline: run before `astro build`
 */
import { readFile, access } from 'node:fs/promises';
import { glob } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const CHAPTERS_DIR = resolve(ROOT, 'src/content/chapters');
const PUBLIC_DIR = resolve(ROOT, 'public');
const DATA_DIR = resolve(ROOT, 'src/data');
const PROFILE = process.env.BOOK_PROFILE ?? 'minimal';
const REPO_ROOT = process.env.BOOK_REPO_ROOT ?? null;

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
const chapterFiles = [];
for await (const f of glob('**/*.{md,mdx}', { cwd: CHAPTERS_DIR })) {
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
