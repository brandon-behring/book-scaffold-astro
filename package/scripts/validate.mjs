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
 *      render an empty label and throw at build (#121). An id'd theorem must
 *      resolve in labels.json, and a literal n= must agree with that index.
 *   7. <BookLink book="…" to="…"> (#96/#147) — both props present, book= is
 *      registered, and literal fragment targets resolve in the sibling's
 *      declared vendored labels index. Dynamic and URL-only entries warn/skip.
 *   8. Questions collection (#112) — each question's frontmatter `domain` is a
 *      member of the consumer's examDomains registry (best-effort), and question
 *      `id`s are unique (the cross-ref key for the appendix / flashcards).
 *   9. Learning-objective anchors (#130) — when a chapter declares frontmatter
 *      `los:` entries with `anchor:` slugs, the declared set and the prose's
 *      MDX anchor-comment marker set must agree in both directions.
 *  10. Authored root-absolute href/src targets (#190) — under a non-root Astro
 *      base, literal Markdown, HTML, and JSX targets must stay inside that base.
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
 * Exit code = total failure count capped at 255 (0 = pass, >=1 = errors).
 */
import { readFile, access } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMath from 'remark-math';
import remarkMdx from 'remark-mdx';
import { walkMdx, readChaptersBase, readBookSchemaConfig } from './walk-mdx.mjs';
import { readEnvFile } from './read-env.mjs';
import { loadResolvedBookConfig } from './resolve-book-config.mjs';
import {
  assertCorpusEnvelope,
  frontmatterSlug,
  legacyFrontmatterBook,
  resolveBookSelection,
} from './corpus-tooling.mjs';
import {
  findAuthoredTargets,
  normalizeAstroBase,
  rootTargetEscapesBase,
  rootTargetPathname,
  suggestBaseContainedTarget,
} from './authored-links.mjs';

// --help / -h: non-mutating (closes #14).
const USAGE = `Usage: book-scaffold validate [--preset <name>]

Pre-flight content validator. Checks Cite keys, XRef ids, Figure srcs,
internal authored links, and (when BOOK_REPO_ROOT is set) CodeRef paths.

Options:
  --preset <name>    academic | tools | minimal | course-notes | research-portfolio
                     Legacy override when no scaffold integration is resolved.
  --book <id>        In corpus mode, validate only one registered book.
  --help, -h         Print this message and exit (non-mutating).

Env:
  BOOK_PRESET        Preset name (preferred over BOOK_PROFILE).
  BOOK_PROFILE       Backward-compat alias for BOOK_PRESET.
  BOOK_REPO_ROOT     Absolute path to a sibling code repo for CodeRef checks.

Exit code = total failure count, capped at 255 so failures never wrap to success.
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
const PUBLIC_DIR = resolve(ROOT, 'public');
const DATA_DIR = resolve(ROOT, 'src/data');

let TOOLING_CONFIG;
try {
  TOOLING_CONFIG = await loadResolvedBookConfig(ROOT);
} catch (error) {
  process.stderr.write(`validate: fatal: ${error?.message ?? error}\n`);
  process.exit(1);
}
let BOOK_SELECTION;
try {
  BOOK_SELECTION = resolveBookSelection(TOOLING_CONFIG, argv, 'validate');
} catch (error) {
  process.stderr.write(`validate: fatal: ${error?.message ?? error}\n`);
  process.exit(1);
}
// Corpus content uses one root with a registered first segment per book;
// single-book consumers retain the historical chapters directory.
const CHAPTERS_DIR = await readChaptersBase(ROOT, { corpus: BOOK_SELECTION.corpus });

// Preset resolution:
//   composed Astro-config preset > --preset flag > BOOK_PRESET env > BOOK_PROFILE env >
//   .env BOOK_PRESET > .env BOOK_PROFILE >
//   defineBookSchemas({ preset }) in content.config.ts >
//   defineBookSchemas({ profile }) in content.config.ts (alias) >
//   warned v4 compatibility fallback 'minimal'.
// .env fallback closes #20 — without it, consumers who set BOOK_PROFILE in
// .env (the documented convenience in SKILL.md + create-book defaults) saw
// the CLI silently default to minimal, hiding academic-profile errors.
// content.config.ts fallback closes #75 — without it, consumers using the
// canonical v4.5+ defineBookSchemas({ preset, chaptersBase }) form had the
// CLI silently default to minimal, hiding research-portfolio (and any
// non-env-set) profile errors while astro build applied the correct settings.
const dotenv = readEnvFile(ROOT);
const schemaConfig = await readBookSchemaConfig(ROOT);
const PRESET_CANDIDATE =
  TOOLING_CONFIG.preset ??
  presetFromFlag ??
  process.env.BOOK_PRESET ??
  process.env.BOOK_PROFILE ??
  dotenv.BOOK_PRESET ??
  dotenv.BOOK_PROFILE ??
  schemaConfig.preset;
const PRESETS = ['academic', 'tools', 'minimal', 'course-notes', 'research-portfolio'];
if (presetFlagIdx >= 0 && !presetFromFlag) {
  process.stderr.write('validate: --preset requires a value.\n');
  process.exit(2);
}
if (PRESET_CANDIDATE && !PRESETS.includes(PRESET_CANDIDATE)) {
  process.stderr.write(
    `validate: preset must be one of ${PRESETS.join(' | ')} ` +
      `(got ${JSON.stringify(PRESET_CANDIDATE)}).\n`,
  );
  process.exit(1);
}
const PRESET = PRESET_CANDIDATE ?? 'minimal';
if (!PRESET_CANDIDATE) {
  process.stderr.write(
    "validate: no preset resolved; falling back to 'minimal' for v4 compatibility. " +
      'This fallback will be removed in v5; configure a built-in style or BOOK_PRESET.\n',
  );
}
// Alias kept for downstream message text only; the resolution above is canonical.
const PROFILE = PRESET;
const MATH_ENABLED = PROFILE === 'academic' || PROFILE === 'research-portfolio';
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

// v4.20.0 (issue #129): the same shadow warning for the landing route. A
// consumer-owned `src/pages/index.astro` collides with the scaffold's
// auto-injected `/` (Astro warns today and has announced a hard error in a
// future major). The escape hatch already exists — `routes: { landing: false }`
// — this check makes it discoverable before Astro's break lands. Same edge
// cases + heuristic as the chapters check above.
{
  const consumerLanding = resolve(ROOT, 'src/pages/index.astro');
  if (existsSync(consumerLanding)) {
    const astroConfigPath = resolve(ROOT, 'astro.config.mjs');
    let landingDisabled = false;
    if (existsSync(astroConfigPath)) {
      const astroConfig = readFileSync(astroConfigPath, 'utf8');
      landingDisabled = /\blanding\s*:\s*false\b/.test(astroConfig);
    }
    if (!landingDisabled) {
      console.warn(
        `\n⚠ Consumer-owned landing page at src/pages/index.astro shadows the\n` +
        `  scaffold's auto-injected "/" route. Your page wins today, but Astro\n` +
        `  has announced route collisions become a HARD ERROR in a future\n` +
        `  version. Set 'routes: { landing: false }' in defineBookConfig to\n` +
        `  declare the override and silence the collision.\n` +
        `  See: package/recipes/18-chapter-route-ownership.md\n`,
      );
    }
  }
}

const errors = [];
const warnings = [];
let ACTIVE_BOOK_ID = BOOK_SELECTION.corpus ? 'corpus' : null;
const fail = (file, line, msg, book = ACTIVE_BOOK_ID) => errors.push({ file, line, msg, book });
const warn = (file, line, msg, book = ACTIVE_BOOK_ID) => warnings.push({ file, line, msg, book });

// ===== Self-heal missing generated artifacts (#186) =====
// These files are intentionally gitignored. Direct `book-scaffold validate`
// bypasses npm's prevalidate lifecycle, so rebuild each missing artifact before
// loading it. Existing files remain untouched; child diagnostics and failures
// are propagated verbatim instead of becoming downstream unknown-id noise.
const scriptDir = dirname(fileURLToPath(import.meta.url));
function regenerate(scriptName, artifact) {
  const prefix = BOOK_SELECTION.corpus ? '[book:corpus] ' : '';
  process.stdout.write(
    `${prefix}validate: ${artifact} is missing — regenerating via ${scriptName} (#186)\n`,
  );
  const childArgs = [join(scriptDir, scriptName)];
  if (BOOK_SELECTION.requestedBook) childArgs.push('--book', BOOK_SELECTION.requestedBook);
  const result = spawnSync(process.execPath, childArgs, {
    cwd: ROOT,
    env: process.env,
    encoding: 'utf8',
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error || result.status !== 0) {
    const detail = result.error ? `: ${result.error.message}` : '';
    process.stderr.write(
      `${prefix}validate: ${scriptName} failed (exit ${result.status ?? 1})${detail} — cannot self-heal.\n`,
    );
    process.exit(result.status ?? 1);
  }
}

if (!existsSync(join(DATA_DIR, 'labels.json'))) {
  regenerate('build-labels.mjs', 'src/data/labels.json');
}
if (!existsSync(join(DATA_DIR, 'references.json'))) {
  regenerate('build-bib.mjs', 'src/data/references.json');
}

// ===== Load reference data (graceful when missing) =====
async function loadJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return {};
  }
}
function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function loadGeneratedArtifact(name) {
  const path = join(DATA_DIR, name);
  if (!BOOK_SELECTION.corpus) return loadJson(path);
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8'));
    return assertCorpusEnvelope(parsed, BOOK_SELECTION.corpus, `src/data/${name}`, isRecord);
  } catch (error) {
    process.stderr.write(
      `[book:corpus] validate: fatal: ${error?.message ?? error}. ` +
        `Run book-scaffold ${name === 'labels.json' ? 'build-labels' : 'build-bib'} ` +
        'to regenerate the corpus envelope.\n',
    );
    process.exit(1);
  }
}

const refsArtifact = await loadGeneratedArtifact('references.json');
const labelsArtifact = await loadGeneratedArtifact('labels.json');

// #147: eagerly load every labels index explicitly declared by the evaluated
// siblingBooks registry. Unlike this book's generated labels.json, sibling
// indexes are vendored inputs: never self-heal or silently replace them. A
// missing, unreadable, malformed, or non-object index is a configuration error
// even when no current chapter happens to reference that sibling.
const siblingLabelIndexes = new Map();
for (const [book, entry] of Object.entries(TOOLING_CONFIG.siblingBooks)) {
  if (typeof entry === 'string' || entry.labels === undefined) continue;
  const indexPath = resolve(ROOT, entry.labels);
  try {
    const index = JSON.parse(await readFile(indexPath, 'utf8'));
    if (index === null || typeof index !== 'object' || Array.isArray(index)) {
      throw new Error('top-level JSON value must be an object');
    }
    siblingLabelIndexes.set(book, { index, configuredPath: entry.labels });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    fail(
      'astro.config',
      1,
      `siblingBooks.${book}.labels (${JSON.stringify(entry.labels)}) is missing, unreadable, or invalid: ${detail}. ` +
        'Vendor a readable sibling labels.json at that path or remove labels to opt out with a warning.',
    );
  }
}

// ===== Collect chapter files =====
// v3.7.1 (closes #52): walkMdx (in ./walk-mdx.mjs) is a recursive readdir
// walker that replaces the previous `glob` import from `node:fs/promises`.
// The `glob` API was added in Node 22 but consumer CI templates ship
// Node 20 — `npm run validate` crashed on every consumer's prebuild hook.
// Walker uses readdir + path only; works on Node 18+.
const chapterFiles = [];
const chapterBookByFile = new Map();
const chapterCountsByBook = new Map();
if (BOOK_SELECTION.corpus) {
  for (const book of BOOK_SELECTION.books) {
    let count = 0;
    for await (const file of walkMdx(join(CHAPTERS_DIR, book.id))) {
      if (file.split('/').pop().startsWith('_')) continue;
      const scoped = `${book.id}/${file}`;
      chapterFiles.push(scoped);
      chapterBookByFile.set(scoped, book.id);
      count += 1;
    }
    chapterCountsByBook.set(book.id, count);
  }
} else {
  for await (const file of walkMdx(CHAPTERS_DIR)) {
    if (!file.split('/').pop().startsWith('_')) chapterFiles.push(file);
  }
}

function bookArtifacts(rel) {
  const book = chapterBookByFile.get(rel) ?? null;
  if (!book) return { book: null, refs: refsArtifact, labels: labelsArtifact };
  return {
    book,
    refs: refsArtifact.books[book],
    labels: labelsArtifact.books[book],
  };
}

// ===== Build slug set from chapter filenames (for internal-link check) =====
const validSlugs = new Set(
  BOOK_SELECTION.corpus
    ? []
    : chapterFiles.map((file) => file.replace(/\.(md|mdx)$/, '')),
);
if (BOOK_SELECTION.corpus) {
  // A selected validation run still needs the complete route set so links to
  // another registered local book are checked rather than misreported.
  for (const book of BOOK_SELECTION.corpus.books) {
    for await (const file of walkMdx(join(CHAPTERS_DIR, book.id))) {
      if (!file.split('/').pop().startsWith('_')) {
        const source = await readFile(join(CHAPTERS_DIR, book.id, file), 'utf8');
        const localId = frontmatterSlug(source) ?? file.replace(/\.(md|mdx)$/, '');
        validSlugs.add(`${book.id}/${localId}`);
      }
    }
  }
}
const validTopLevelRoutes = new Set([
  '/', '/chapters/', '/references/', '/search/', '/print/', '/convergence/',
]);
if (BOOK_SELECTION.corpus) {
  for (const book of BOOK_SELECTION.corpus.books) {
    validTopLevelRoutes.add(`/${book.id}/`);
    validTopLevelRoutes.add(`/chapters/${book.id}/`);
    for (const route of book.apparatus ?? []) {
      validTopLevelRoutes.add(`/${book.id}/${route}/`);
    }
  }
}

// ===== Pattern helpers for component-specific checks =====
const RE_CITE = /<Cite[^>]+key=["']([^"']+)["']/g;
const RE_XREF = /<XRef[^>]+id=["']([^"']+)["']/g;
const RE_FIGURE = /<Figure[^>]+src=["']([^"']+)["']/g;
const RE_CODEREF = /<CodeRef[^>]+path=["']([^"']+)["'](?:[^>]*line=\{(\d+)\})?(?:[^>]*lineEnd=\{(\d+)\})?/g;
// #121: a <Theorem> opening tag — capture its attributes to assert a
// resolvable kind= (or legacy type=) is present.
const RE_THEOREM = /<Theorem\b([^>]*)>/g;
// #96/#147: BookLink attributes must be read structurally. An opening-tag
// regex stops at `>` inside a quoted value or expression and can mistake text
// inside another prop for a real book=/to= assignment.
const mdxParser = unified().use(remarkParse).use(remarkMdx);
if (MATH_ENABLED) mdxParser.use(remarkMath);

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

const ASTRO_BASE = normalizeAstroBase(TOOLING_CONFIG.base);

function authoredFormat(file) {
  return extname(file).toLowerCase() === '.md' ? 'md' : 'mdx';
}

function collectAuthoredTargets(file, content) {
  try {
    return findAuthoredTargets(content, {
      format: authoredFormat(file),
      math: MATH_ENABLED,
    });
  } catch (error) {
    const line = error?.line ?? error?.place?.start?.line ?? error?.position?.start?.line ?? 1;
    const detail = String(error?.reason ?? error?.message ?? error).split('\n')[0];
    fail(file, line, `Could not parse authored links as ${authoredFormat(file).toUpperCase()}: ${detail}`);
    return [];
  }
}

function validateAuthoredTargets(file, content, targets) {
  for (const violation of targets) {
    if (!rootTargetEscapesBase(violation.target, ASTRO_BASE)) continue;
    const suggested = suggestBaseContainedTarget(violation.target, ASTRO_BASE);
    fail(
      file,
      lineOf(content, violation.index),
      `Authored ${violation.kind} ${JSON.stringify(violation.target)} escapes configured Astro base ` +
        `${JSON.stringify(ASTRO_BASE)}. Use ${JSON.stringify(suggested)}, ` +
        'import.meta.env.BASE_URL in JSX, or a base-aware component. ' +
        'Validation does not rewrite authored URLs (#190).',
    );
  }
}

function validateInternalMarkdownLinks(file, content, targets) {
  for (const authored of targets) {
    if (authored.kind !== 'Markdown link destination') continue;
    const pathname = rootTargetPathname(authored.target);
    if (pathname === null) continue;
    const baseRelativeTarget =
      ASTRO_BASE !== '/' && (pathname === ASTRO_BASE || pathname.startsWith(`${ASTRO_BASE}/`))
        ? pathname.slice(ASTRO_BASE.length) || '/'
        : pathname;
    const target = baseRelativeTarget.replace(/\/$/, '') || '/';
    if (validTopLevelRoutes.has(`${target}/`) || validTopLevelRoutes.has(target)) continue;
    const chMatch = target.match(/^\/chapters\/(.+)$/);
    if (chMatch && validSlugs.has(chMatch[1])) continue;
    warn(
      file,
      lineOf(content, authored.index),
      `Internal link ${JSON.stringify(authored.target)} — target may not resolve (check spelling or route)`,
    );
  }
}

/**
 * Return a statically knowable n= value. Quoted strings and braced
 * string/numeric literals are safe to compare; identifiers, calls,
 * interpolation, and all other expressions are deliberately skipped.
 */
function literalTheoremNumber(attrs) {
  const quoted = attrs.match(/\bn\s*=\s*(["'])(.*?)\1/);
  if (quoted) return quoted[2];

  const braced = attrs.match(/\bn\s*=\s*\{\s*([^}]*?)\s*\}/);
  if (!braced) return null;
  const expression = braced[1].trim();
  const stringLiteral = expression.match(/^(["'`])([\s\S]*)\1$/);
  if (stringLiteral) {
    if (stringLiteral[1] === '`' && stringLiteral[2].includes('${')) return null;
    return stringLiteral[2];
  }
  if (/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(expression)) {
    return String(Number(expression));
  }
  return null;
}

/** Yield MDX JSX elements with an exact component name, excluding examples in
 * fenced/inline code and strings in expressions by construction. */
function* mdxElements(node, name) {
  if (
    (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') &&
    node.name === name
  ) {
    yield node;
  }
  if (!Array.isArray(node.children)) return;
  for (const child of node.children) yield* mdxElements(child, name);
}

function expressionString(value) {
  const program = value?.data?.estree;
  if (program?.body?.length !== 1 || program.body[0].type !== 'ExpressionStatement') {
    return null;
  }
  const expression = program.body[0].expression;
  if (expression.type === 'Literal' && typeof expression.value === 'string') {
    return expression.value;
  }
  if (expression.type === 'TemplateLiteral' && expression.expressions.length === 0) {
    return expression.quasis[0]?.value?.cooked ?? expression.quasis[0]?.value?.raw ?? '';
  }
  return null;
}

/**
 * Evaluate one JSX prop in source order. Later explicit attributes override an
 * earlier spread; a later spread makes the value dynamic, exactly as JSX does.
 * Literal ESTree values are already decoded, so entities and JS escapes cannot
 * disguise the href that the component receives at runtime.
 */
function mdxStringProp(element, name) {
  let result = { present: false, literal: false, value: null, source: 'absent' };
  for (const attribute of element.attributes) {
    if (attribute.type === 'mdxJsxExpressionAttribute') {
      result = { present: true, literal: false, value: null, source: 'spread' };
      continue;
    }
    if (attribute.type !== 'mdxJsxAttribute' || attribute.name !== name) continue;
    if (typeof attribute.value === 'string') {
      result = { present: true, literal: true, value: attribute.value, source: 'attribute' };
      continue;
    }
    const value = expressionString(attribute.value);
    result = value === null
      ? { present: true, literal: false, value: null, source: 'expression' }
      : { present: true, literal: true, value, source: 'attribute' };
  }
  return result;
}

/**
 * Canonical comparison shape for a sibling labels href. The generated index
 * intentionally omits the deployment base, so only normalize route seams:
 * leading slashes and the optional trailing slash immediately before `#`.
 */
function normalizeSiblingTarget(value) {
  const hash = value.indexOf('#');
  if (hash < 0 || hash === value.length - 1) return null;
  const fragment = value.slice(hash + 1);
  const path = value.slice(0, hash).trim().replace(/^\/+/, '').replace(/\/+$/, '');
  return { fragment, href: `${path}#${fragment}` };
}

/**
 * Heading keys in labels.json are deliberately opaque and path-qualified so
 * `#summary` can exist in every chapter. Resolve sibling targets from href
 * values, while remaining compatible with historical component-id keys.
 */
function siblingTargetCandidates(index, fragment) {
  const candidates = [];
  for (const [key, entry] of Object.entries(index)) {
    if (entry === null || typeof entry !== 'object' || typeof entry.href !== 'string') continue;
    const normalized = normalizeSiblingTarget(entry.href);
    if (normalized?.fragment === fragment) {
      candidates.push({ key, href: entry.href, normalized });
    }
  }
  return candidates;
}

function normalizeCorpusTarget(book, to) {
  if (typeof to !== 'string' || to.trim().length === 0) {
    return { error: 'target must be non-empty' };
  }
  if (to !== to.trim()) return { error: 'surrounding whitespace is not allowed' };
  if (/^[a-z][a-z0-9+.-]*:/i.test(to) || to.startsWith('/') || to.includes('\\')) {
    return { error: 'absolute URLs and paths are not allowed' };
  }
  if (/[\u0000-\u001f\u007f]/.test(to)) return { error: 'control characters are not allowed' };

  const query = to.indexOf('?');
  const hash = to.indexOf('#');
  const suffixIndex = [query, hash]
    .filter((index) => index >= 0)
    .reduce((minimum, index) => Math.min(minimum, index), to.length);
  const path = to.slice(0, suffixIndex).replace(/\/+$/, '');
  if (!path) return { error: 'query-only and fragment-only targets are not allowed' };
  const segments = path.split('/');
  if (segments.some((segment) => segment.length === 0)) {
    return { error: 'empty path segments are not allowed' };
  }
  for (const segment of segments) {
    let decoded;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      return { error: 'malformed percent encoding' };
    }
    if (decoded === '.' || decoded === '..' || decoded.includes('/') || decoded.includes('\\')) {
      return { error: 'path traversal is not allowed' };
    }
  }

  const localPath = segments.join('/');
  const canonicalPath = localPath === 'chapters'
    ? `chapters/${book.id}`
    : localPath.startsWith('chapters/')
      ? `chapters/${book.id}/${localPath.slice('chapters/'.length)}`
      : `${book.id}/${localPath}`;
  const fragment = hash >= 0 ? to.slice(hash + 1) : null;
  return {
    error: null,
    localPath,
    canonicalPath,
    fragment,
    href: fragment ? `${canonicalPath}#${fragment}` : canonicalPath,
    chapterSlug: localPath.startsWith('chapters/')
      ? `${book.id}/${localPath.slice('chapters/'.length)}`
      : null,
  };
}

// ===== Run all checks on each chapter =====
for (const rel of chapterFiles) {
  const abs = join(CHAPTERS_DIR, rel);
  const content = await readFile(abs, 'utf8');
  const artifacts = bookArtifacts(rel);
  const { refs, labels } = artifacts;
  ACTIVE_BOOK_ID = artifacts.book;
  if (artifacts.book) {
    const legacy = legacyFrontmatterBook(content);
    if (legacy && legacy.value !== artifacts.book) {
      fail(
        rel,
        legacy.line,
        `frontmatter book ${JSON.stringify(legacy.value)} does not match ` +
          `path-derived corpus book ${JSON.stringify(artifacts.book)}.`,
      );
    }
  }
  const authoredTargets = collectAuthoredTargets(rel, content);

  // 10. Root-absolute authored targets under a non-root Astro base (#190).
  //     Structural parsing covers Markdown link/image destinations, HTML
  //     href/src, and decoded static JSX strings while excluding code examples.
  validateAuthoredTargets(rel, content, authoredTargets);

  let bookLinks = [];
  if (content.includes('<BookLink')) {
    try {
      bookLinks = [...mdxElements(mdxParser.parse(content), 'BookLink')];
    } catch (error) {
      const line = error?.position?.start?.line ?? error?.line ?? 1;
      fail(
        rel,
        line,
        `Cannot structurally validate <BookLink>: ${error?.reason ?? error?.message ?? error}`,
      );
    }
  }

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

  // 4. Internal Markdown links resolve. Reuse the structural authored-target
  //    traversal so code examples and comments cannot create false warnings.
  validateInternalMarkdownLinks(rel, content, authoredTargets);

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
  //    Plus (#126): an id'd <Theorem> without a label= override auto-numbers
  //    from labels.json — an id absent from the index silently renders the
  //    heading UNNUMBERED (no [?id] placeholder, unlike <XRef>). Fail loud to
  //    restore symmetry with check #2. (A label= override opts out → number:null.)
  for (const m of content.matchAll(RE_THEOREM)) {
    const attrs = m[1];
    if (!/\b(?:kind|type)\s*=/.test(attrs)) {
      fail(
        rel,
        lineOf(content, m.index),
        `<Theorem> has no kind= (or legacy type=) — renders an empty label / throws at build. Add e.g. kind="theorem".`,
      );
    }
    const thmId = attrs.match(/\bid=["']([^"']+)["']/);
    const hasLabelOverride = /\blabel\s*=/.test(attrs);
    if (thmId && !hasLabelOverride && !labels[thmId[1]]) {
      fail(
        rel,
        lineOf(content, m.index),
        `<Theorem id="${thmId[1]}"> — not in labels.json; heading silently renders unnumbered. Run build:labels, or fix the id.`,
      );
    }
    // #176: compare only literal n= values. Dynamic expressions cannot be
    // evaluated reliably by this intentionally regex-based validator, and a
    // label= override explicitly opts out of labels.json auto-numbering.
    const explicitNumber = hasLabelOverride ? null : literalTheoremNumber(attrs);
    const indexedNumber = thmId ? labels[thmId[1]]?.number : null;
    if (
      thmId &&
      explicitNumber !== null &&
      indexedNumber != null &&
      explicitNumber !== String(indexedNumber)
    ) {
      fail(
        rel,
        lineOf(content, m.index),
        `<Theorem id="${thmId[1]}" n="${explicitNumber}"> — labels.json numbers it ` +
          `${indexedNumber}, and the rendered heading + every XRef use the index. ` +
          'Drop the stale n= (auto-numbering wins) or re-run build:labels.',
      );
    }
  }

  // 7. BookLink (#96/#147): structural props + evaluated registry membership,
  //    then literal path/fragment validation against a declared vendored index.
  //    Dynamic values and URL-only compatibility entries are explicit warnings
  //    rather than guessed validations.
  for (const element of bookLinks) {
    const line = element.position?.start?.line ?? 1;
    const bookAttr = mdxStringProp(element, 'book');
    const toAttr = mdxStringProp(element, 'to');

    if (bookAttr.source === 'spread' || toAttr.source === 'spread') {
      warn(
        rel,
        line,
        '<BookLink> validation skipped: a dynamic prop spread may supply or override book=/to=, so the target cannot be proven statically.',
      );
      continue;
    }
    if (!bookAttr.present || !toAttr.present) {
      fail(rel, line, `<BookLink> requires both book="…" and to="…".`);
      continue;
    }

    if (!bookAttr.literal) {
      warn(
        rel,
        line,
        '<BookLink> target validation skipped: dynamic book= expression cannot be evaluated statically.',
      );
      continue;
    }

    const book = bookAttr.value;
    const corpusBook = BOOK_SELECTION.corpus?.books.find((candidate) => candidate.id === book);
    if (corpusBook) {
      if (!toAttr.literal) {
        warn(
          rel,
          line,
          `<BookLink book="${book}"> target validation skipped: dynamic to= expression cannot be evaluated statically.`,
        );
        continue;
      }

      const target = normalizeCorpusTarget(corpusBook, toAttr.value);
      if (target.error) {
        fail(
          rel,
          line,
          `<BookLink book="${book}" to="${toAttr.value}"> has invalid local corpus target: ` +
            `${target.error}.`,
        );
        continue;
      }

      let targetExists = true;
      if (target.chapterSlug) {
        targetExists = validSlugs.has(target.chapterSlug);
      } else if (target.localPath !== 'chapters') {
        const [apparatus] = target.localPath.split('/');
        targetExists = (
          corpusBook.apparatus ?? TOOLING_CONFIG.apparatusRoutes
        ).includes(apparatus);
      }
      if (!targetExists) {
        fail(
          rel,
          line,
          `<BookLink book="${book}" to="${toAttr.value}"> — unknown local corpus target ` +
            `"${target.canonicalPath}".`,
        );
        continue;
      }

      if (target.fragment !== null) {
        if (target.fragment.length === 0) {
          fail(
            rel,
            line,
            `<BookLink book="${book}" to="${toAttr.value}"> — local fragment is empty.`,
          );
          continue;
        }
        const localIndex = labelsArtifact.books[book];
        const candidates = siblingTargetCandidates(localIndex, target.fragment);
        if (!candidates.some((candidate) => candidate.normalized.href === target.href)) {
          const indexedHrefs = candidates.map((candidate) => `"${candidate.href}"`).join(', ');
          fail(
            rel,
            line,
            `<BookLink book="${book}" to="${toAttr.value}"> — local fragment ` +
              `"${target.fragment}" does not resolve in labels.json book namespace "${book}"` +
              (indexedHrefs ? ` (indexed at ${indexedHrefs})` : '') +
              '.',
          );
        }
      }
      continue;
    }

    const registered = Object.prototype.hasOwnProperty.call(TOOLING_CONFIG.siblingBooks, book);
    if (!registered) {
      const known = [
        ...(BOOK_SELECTION.corpus?.books.map((candidate) => candidate.id) ?? []),
        ...Object.keys(TOOLING_CONFIG.siblingBooks),
      ];
      fail(
        rel,
        line,
        BOOK_SELECTION.corpus
          ? `<BookLink book="${book}"> — not a registered local corpus or sibling book ` +
              `(${known.join(', ') || 'none'}). Register it or fix the key.`
          : `<BookLink book="${book}"> — not in evaluated defineBookConfig siblingBooks ` +
              `(${Object.keys(TOOLING_CONFIG.siblingBooks).join(', ') || 'none'}). ` +
              'Register it or fix the key.',
      );
      continue;
    }
    const siblingEntry = TOOLING_CONFIG.siblingBooks[book];

    if (!toAttr.literal) {
      warn(
        rel,
        line,
        `<BookLink book="${book}"> target validation skipped: dynamic to= expression cannot be evaluated statically.`,
      );
      continue;
    }

    const target = normalizeSiblingTarget(toAttr.value);
    if (!target) {
      warn(
        rel,
        line,
        `<BookLink book="${book}" to="${toAttr.value}"> has no static #fragment; sibling labels validation skipped.`,
      );
      continue;
    }

    if (typeof siblingEntry === 'string' || siblingEntry.labels === undefined) {
      warn(
        rel,
        line,
        `<BookLink book="${book}" to="${toAttr.value}"> target validation skipped: ` +
          'the siblingBooks entry is URL-only. Use { url, labels } to enable vendored-label validation.',
      );
      continue;
    }

    const loaded = siblingLabelIndexes.get(book);
    if (!loaded) continue; // A config-level error was already recorded above.

    const candidates = siblingTargetCandidates(loaded.index, target.fragment);
    if (candidates.some((candidate) => candidate.normalized.href === target.href)) {
      continue;
    }

    if (candidates.length === 0) {
      // Preserve the actionable diagnostic for a malformed historical entry
      // whose key is the literal fragment. Opaque heading keys are found by
      // valid href values and never need to be decoded here.
      const legacyEntry = loaded.index[target.fragment];
      if (
        Object.prototype.hasOwnProperty.call(loaded.index, target.fragment) &&
        (legacyEntry === null ||
          typeof legacyEntry !== 'object' ||
          typeof legacyEntry.href !== 'string')
      ) {
        fail(
          rel,
          line,
          `<BookLink book="${book}" to="${toAttr.value}"> — ${loaded.configuredPath} entry ` +
            `"${target.fragment}" has no string href; re-vendor a valid sibling labels.json.`,
        );
        continue;
      }
      fail(
        rel,
        line,
        `<BookLink book="${book}" to="${toAttr.value}"> — fragment "${target.fragment}" is not in ` +
          `${loaded.configuredPath}. Vendor the current sibling labels.json, or fix the target id.`,
      );
      continue;
    }

    const indexedHrefs = candidates.map((candidate) => `"${candidate.href}"`).join(', ');
    fail(
      rel,
      line,
      `<BookLink book="${book}" to="${toAttr.value}"> — path/fragment does not match ` +
        `${loaded.configuredPath}, which indexes "${target.fragment}" at ${indexedHrefs}. ` +
        'Fix to= or refresh the vendored index.',
    );
  }

  // <Rationale appendix> in CHAPTER bodies (v4.21.0, #114): same missing-for=
  // pre-flight as the questions scan below (the for===id rule is
  // question-file-scoped and doesn't apply here). The component still throws
  // at build either way; this just catches it at the earliest gate.
  for (const m of content.matchAll(/<Rationale\b([^>]*)>/g)) {
    const attrs = m[1];
    if (/(^|\s)appendix(\s|=|$)/.test(attrs) && !/\bfor\s*=/.test(attrs)) {
      fail(
        rel,
        lineOf(content, m.index),
        `<Rationale appendix> without for="<question-id>" — no appendix anchor target; throws at build.`,
      );
    }
  }

  // 9. Learning-objective anchor binding (#130). Convention (consumer-defined
  //    `los` frontmatter, guides-ai-engineering): each `los[].anchor` slug has
  //    a matching MDX comment marker in the prose binding the objective to its
  //    section. Both drift directions built + validated green before this
  //    check, so both fail loud: a declared anchor with no marker (dangling
  //    objective) and a marker with no declaration (orphan). Scoped to
  //    chapters that opt into the convention (a `los:` frontmatter key) —
  //    `los` is not a scaffold schema field, so this can't false-fire on
  //    books that don't use it. Heuristic, like #8: any indented `anchor:`
  //    line inside the frontmatter counts as a declaration.
  {
    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const front = fmMatch ? fmMatch[1] : '';
    if (/^los\s*:/m.test(front)) {
      const frontOffset = content.indexOf(front);
      const bodyOffset = fmMatch ? fmMatch[0].length : 0;
      const body = content.slice(bodyOffset);
      // Matches both YAML styles: block items (`- anchor: slug` / `anchor: slug`
      // on its own indented line) and flow/inline maps (`- { text: …, anchor:
      // slug }`), where the key follows a `{` or `,`. The prefix alternation —
      // never a bare `.*` — keeps `my-anchor:` from matching as "anchor:".
      const declared = [
        ...front.matchAll(
          /^\s+(?:-\s+|.*[{,]\s*)?anchor\s*:\s*["']?([^"',}\n]+?)["']?\s*(?:[,}].*)?$/gm,
        ),
      ];
      const markers = [...body.matchAll(/\{\s*\/\*\s*anchor:\s*([^\s*]+)\s*\*\/\s*\}/g)];
      const markerSlugs = new Set(markers.map((m) => m[1]));
      const declaredSlugs = new Set(declared.map((m) => m[1].trim()));
      for (const d of declared) {
        const slug = d[1].trim();
        if (!markerSlugs.has(slug)) {
          fail(
            rel,
            lineOf(content, frontOffset + d.index),
            `los anchor "${slug}" has no matching {/* anchor: ${slug} */} marker in the prose — dangling learning objective.`,
          );
        }
      }
      for (const m of markers) {
        if (!declaredSlugs.has(m[1])) {
          fail(
            rel,
            lineOf(content, bodyOffset + m.index),
            `prose anchor marker "${m[1]}" has no matching los[].anchor in the frontmatter — orphan anchor.`,
          );
        }
      }
    }
  }
}
ACTIVE_BOOK_ID = BOOK_SELECTION.corpus ? 'corpus' : null;

// ===== 8. Questions collection (#112): domain membership + unique ids =====
//
// The study-guide `questions` collection (src/content/questions/**) is scanned
// separately from chapters: a question's frontmatter `domain` must be in the
// consumer's examDomains registry — an unregistered domain throws at build via
// assertKnownDomain (route layer); we flag it here, earlier, the same way #7
// pre-flights BookLink. Question `id`s must also be unique (they're the stable
// cross-ref key the appendix/flashcards resolve against). Best-effort: when
// examDomains can't be read from astro.config.mjs, membership is left to the
// build-time throw.
let questionsChecked = 0;
{
  const QUESTIONS_DIR = resolve(ROOT, 'src/content/questions');
  if (existsSync(QUESTIONS_DIR)) {
    // examDomains registry from astro.config.mjs (best-effort, mirrors siblingBooks).
    let examDomains = null;
    const astroConfigPath = resolve(ROOT, 'astro.config.mjs');
    if (existsSync(astroConfigPath)) {
      const block = readFileSync(astroConfigPath, 'utf8').match(/examDomains\s*:\s*\[([^\]]*)\]/);
      if (block) {
        examDomains = new Set([...block[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1]));
      }
    }

    const seenIds = new Map(); // question id → first file that declared it
    const questionFiles = [];
    for await (const f of walkMdx(QUESTIONS_DIR)) {
      if (!f.split('/').pop().startsWith('_')) questionFiles.push(f);
    }
    for (const rel of questionFiles) {
      const abs = join(QUESTIONS_DIR, rel);
      const content = await readFile(abs, 'utf8');
      const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      const front = fm ? fm[1] : '';
      const qrel = `questions/${rel}`;

      // Questions do not run the legacy link-resolution advisory, so keep the
      // #190 root-base contract fully inert by parsing only for a non-root base.
      const authoredTargets = ASTRO_BASE === '/' ? [] : collectAuthoredTargets(qrel, content);
      validateAuthoredTargets(qrel, content, authoredTargets);

      const idMatch = front.match(/^id\s*:\s*["']?([^"'\n]+?)["']?\s*$/m);
      if (idMatch) {
        const id = idMatch[1].trim();
        if (seenIds.has(id)) {
          fail(
            qrel,
            1,
            `Duplicate question id "${id}" — also declared in ${seenIds.get(id)}. Question ids must be unique (cross-ref key for the appendix / flashcards).`,
          );
        } else {
          seenIds.set(id, qrel);
        }
      }

      if (examDomains) {
        const domainMatch = front.match(/^domain\s*:\s*["']?([^"'\n]+?)["']?\s*$/m);
        if (domainMatch && !examDomains.has(domainMatch[1].trim())) {
          fail(
            qrel,
            1,
            `Question domain "${domainMatch[1].trim()}" not in defineBookConfig examDomains (${[...examDomains].join(', ') || 'none'}). Register it or fix the value.`,
          );
        }
      }

      // v4.21.0 (#114): <Rationale appendix> needs for= (the /answers#answer-<id>
      // anchor target) — the component throws at build; flag it here, earlier,
      // the same way #7 pre-flights BookLink. Inside a question's own body the
      // natural invariant is for= === this file's frontmatter id — a mismatch
      // (copy-paste drift) anchors the reader to the wrong (or no) answer,
      // which the component CAN'T check (it has no collection access).
      // `(^|\s)appendix(\s|=|$)` anchors the bare prop so prose like
      // title="See the appendix" can't false-fire.
      for (const m of content.matchAll(/<Rationale\b([^>]*)>/g)) {
        const attrs = m[1];
        if (!/(^|\s)appendix(\s|=|$)/.test(attrs)) continue;
        const forMatch = attrs.match(/\bfor\s*=\s*["']([^"']+)["']/);
        if (!forMatch) {
          fail(
            qrel,
            lineOf(content, m.index),
            `<Rationale appendix> without for="<question-id>" — no appendix anchor target; throws at build.`,
          );
        } else if (idMatch && forMatch[1] !== idMatch[1].trim()) {
          fail(
            qrel,
            lineOf(content, m.index),
            `<Rationale appendix for="${forMatch[1]}"> does not match this question's id "${idMatch[1].trim()}" — the /answers anchor would land on the wrong (or no) answer.`,
          );
        }
      }
    }
    questionsChecked = questionFiles.length;
  }
}

// ===== Report =====
const format = ({ file, line, msg, book }) =>
  `${book ? `[book:${book}] ` : '  '}${file}:${line}  ${msg}`;
if (warnings.length > 0) {
  const prefix = BOOK_SELECTION.corpus ? '[book:corpus] ' : '';
  console.warn(`${prefix}validate: ${warnings.length} warning(s):`);
  warnings.forEach((warning) => console.warn(format(warning)));
}

if (BOOK_SELECTION.corpus) {
  for (const book of BOOK_SELECTION.books) {
    const count = chapterCountsByBook.get(book.id) ?? 0;
    const bookErrors = errors.filter((error) => error.book === book.id).length;
    const bookWarnings = warnings.filter((warning) => warning.book === book.id).length;
    const result = bookErrors === 0 ? '✓' : '✗';
    const detail = bookErrors === 0
      ? 'no errors'
      : `${bookErrors} error${bookErrors === 1 ? '' : 's'}`;
    console.log(
      `[book:${book.id}] validate: ${result} ${count} chapter(s) checked; ${detail}, ` +
        `${bookWarnings} warning${bookWarnings === 1 ? '' : 's'} ` +
        `(profile=${PROFILE}, number-style=${TOOLING_CONFIG.numberStyle}).`,
    );
  }

  const qNote = questionsChecked > 0 ? ` + ${questionsChecked} question(s)` : '';
  const aggregateResult = errors.length === 0 ? '✓' : '✗';
  const aggregateDetail = errors.length === 0
    ? 'no errors'
    : `${errors.length} error${errors.length === 1 ? '' : 's'}`;
  const aggregateMessage =
    `[book:corpus] validate: ${aggregateResult} ${chapterFiles.length} chapter(s)${qNote} ` +
    `across ${BOOK_SELECTION.books.length} book${BOOK_SELECTION.books.length === 1 ? '' : 's'}; ` +
    `${aggregateDetail}, ${warnings.length} warning${warnings.length === 1 ? '' : 's'} ` +
    `(profile=${PROFILE}, number-style=${TOOLING_CONFIG.numberStyle})`;
  if (errors.length === 0) {
    console.log(`${aggregateMessage}.`);
    process.exit(0);
  }
  console.error(`${aggregateMessage}:`);
  errors.forEach((error) => console.error(format(error)));
  process.exit(Math.min(errors.length, 255));
}

if (errors.length === 0) {
  const qNote = questionsChecked > 0 ? ` + ${questionsChecked} question(s)` : '';
  console.log(
    `validate: ✓ ${chapterFiles.length} chapter(s)${qNote} checked ` +
      `(profile=${PROFILE}, number-style=${TOOLING_CONFIG.numberStyle}); no errors.`,
  );
  process.exit(0);
}
console.error(
  `validate: ✗ ${errors.length} error(s) in ${chapterFiles.length} chapter(s) ` +
    `(profile=${PROFILE}, number-style=${TOOLING_CONFIG.numberStyle}):`,
);
errors.forEach((error) => console.error(format(error)));
process.exit(Math.min(errors.length, 255));
