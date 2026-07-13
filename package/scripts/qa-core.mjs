/**
 * Deterministic content-health engine for `book-scaffold qa` (#158).
 *
 * This module deliberately owns no process I/O: it never prints, exits,
 * spawns, or writes. The command adapter injects the shared validation core
 * and decides whether to render human or schema-v1 JSON output.
 */
import { readFile, readdir, realpath } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import {
  findAuthoredTargets,
  normalizeAstroBase,
} from './authored-links.mjs';
import {
  parseFrontmatter,
  resolveBookSelection,
} from './corpus-tooling.mjs';
import { loadResolvedBookConfig } from './resolve-book-config.mjs';
import { readChaptersBase, walkMdx } from './walk-mdx.mjs';

export const QA_SCHEMA_VERSION = 1;
export const QA_SINGLE_BOOK_ID = 'book';
export const QA_CORPUS_BOOK_ID = 'corpus';

export const QA_PRESETS = Object.freeze([
  'academic',
  'tools',
  'minimal',
  'course-notes',
  'research-portfolio',
]);

export const QA_CHECKS = Object.freeze([
  'content_contract',
  'chapters',
  'links',
  'learning_objectives',
  'components',
  'demo_fixtures',
]);

const CHECK_ORDER = new Map(QA_CHECKS.map((check, index) => [check, index]));
const STATE_RANK = Object.freeze({ not_applicable: -1, green: 0, amber: 1, red: 2 });
const GENERATED_DATA_PATHS = new Set([
  'labels.json',
  'references.json',
  // build-bib emits this tools-profile artifact alongside references.json.
  'sources.json',
  'tips.json',
  'exercises.json',
]);
const LINK_KINDS = new Set([
  'Markdown link destination',
  'Markdown reference destination',
  'href attribute',
]);
const ORIGIN = 'https://book-scaffold.invalid';

/** Public component names that may appear in authored MDX. */
export const SCAFFOLD_MDX_COMPONENTS = Object.freeze([
  'AICollaborationDisclosure',
  'AssessmentTest',
  'BlockedByCallout',
  'BookLink',
  'CaseStudy',
  'Citation',
  'Cite',
  'CodeBlock',
  'CodeRef',
  'ConceptBox',
  'Convergence',
  'CounterBox',
  'DemoFrame',
  'Diagnostic',
  'Divergence',
  'DynConnect',
  'Epigraph',
  'EvidenceTag',
  'ExampleBox',
  'Exercise',
  'ExerciseSolutions',
  'Figure',
  'InsightBox',
  'KeyIdea',
  'MarginFigure',
  'MarginNote',
  'Newthought',
  'NoteBox',
  'ObjectiveMap',
  'OpenQuestion',
  'PaperBox',
  'PartReview',
  'Pitfall',
  'PocLayout',
  'PolicyRef',
  'Practice',
  'PreReleaseBanner',
  'Rationale',
  'Recovery',
  'ResultBox',
  'Sidenote',
  'SkillBox',
  'Slider',
  'Solution',
  'SourceArchive',
  'StatCards',
  'StatusBadge',
  'Tag',
  'Term',
  'Theorem',
  'Tip',
  'TipBox',
  'TipsCard',
  'TryThis',
  'VersionSelector',
  'WarnBox',
  'WeekRef',
  'WorkedExample',
  'XRef',
  'YouWillLearn',
]);
const SCAFFOLD_COMPONENT_SET = new Set(SCAFFOLD_MDX_COMPONENTS);

export class QaExecutionError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'QaExecutionError';
    this.code = 'QA_EXECUTION_FAILURE';
  }
}

function posix(path) {
  return path.split(sep).join('/');
}

function sourcePath(root, path) {
  return posix(relative(root, path));
}

function lineOf(source, index) {
  return source.slice(0, index).split('\n').length;
}

function normalizeRoute(pathname) {
  const value = pathname.startsWith('/') ? pathname : `/${pathname}`;
  try {
    return new URL(value, ORIGIN).pathname.replace(/\/+$/, '') || '/';
  } catch {
    return value.replace(/\/+$/, '') || '/';
  }
}

function routeTokens(pattern, tokens) {
  return pattern.replace(/:(book|slug|route|id)\b/g, (_match, key) => tokens[key] ?? '');
}

function chapterRouteFor(config, book, localId, frontmatter) {
  const entryId = book ? `${book.id}/${localId}` : localId;
  const bookValue = book?.id ?? (
    typeof frontmatter?.[config.bookField] === 'string'
      ? frontmatter[config.bookField]
      : ''
  );
  const slug = bookValue && entryId.startsWith(`${bookValue}/`)
    ? entryId.slice(bookValue.length + 1)
    : entryId;
  return normalizeRoute(routeTokens(config.chapterRoute, {
    id: entryId,
    book: bookValue,
    slug,
    route: '',
  }));
}

function worstState(states) {
  let worst = 'not_applicable';
  for (const state of states) {
    if ((STATE_RANK[state] ?? -1) > STATE_RANK[worst]) worst = state;
  }
  return worst;
}

function checkResult(state, metrics, diagnosticIds = []) {
  return { state, metrics, diagnosticIds };
}

function diagnostic({ severity, code, message, book, check, file, line, column }) {
  return {
    severity,
    code,
    message,
    book,
    check,
    ...(file ? { file } : {}),
    ...(Number.isInteger(line) && line > 0 ? { line } : {}),
    ...(Number.isInteger(column) && column > 0 ? { column } : {}),
  };
}

function compareDiagnostics(a, b) {
  return (a.file ?? '').localeCompare(b.file ?? '') ||
    (a.line ?? 0) - (b.line ?? 0) ||
    (a.column ?? 0) - (b.column ?? 0) ||
    (CHECK_ORDER.get(a.check) ?? 99) - (CHECK_ORDER.get(b.check) ?? 99) ||
    a.severity.localeCompare(b.severity) ||
    a.code.localeCompare(b.code) ||
    a.message.localeCompare(b.message);
}

function finalizeDiagnostics(book, diagnostics) {
  return [...diagnostics]
    .sort(compareDiagnostics)
    .map((entry, index) => {
      const { check: _check, ...publicEntry } = entry;
      return {
        id: `qa:${book}:${String(index + 1).padStart(4, '0')}`,
        ...publicEntry,
      };
    });
}

function idsForCheck(diagnostics, sourceDiagnostics, check) {
  const signatures = new Set(
    sourceDiagnostics
      .filter((entry) => entry.check === check)
      .map((entry) => [
        entry.severity,
        entry.code,
        entry.message,
        entry.file ?? '',
        entry.line ?? 0,
        entry.column ?? 0,
      ].join('\u0000')),
  );
  return diagnostics
    .filter((entry) => signatures.has([
      entry.severity,
      entry.code,
      entry.message,
      entry.file ?? '',
      entry.line ?? 0,
      entry.column ?? 0,
    ].join('\u0000')))
    .map((entry) => entry.id);
}

function validationDiagnostic(entry, severity, book) {
  const message = entry?.message ?? entry?.msg ?? String(entry);
  return diagnostic({
    severity,
    code: typeof entry?.code === 'string' && entry.code.length > 0
      ? entry.code
      : `validation.${severity === 'error' ? 'error' : 'advisory'}`,
    message,
    book,
    check: 'content_contract',
    file: entry?.file,
    line: entry?.line,
    column: entry?.column,
  });
}

function contentContractCheck(diagnostics, allDiagnostics) {
  const errors = diagnostics.filter((entry) => entry.severity === 'error').length;
  const advisories = diagnostics.filter((entry) => entry.severity === 'warning').length;
  return checkResult(
    errors > 0 ? 'red' : advisories > 0 ? 'amber' : 'green',
    { errors, advisories },
    idsForCheck(allDiagnostics, diagnostics, 'content_contract'),
  );
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function mathEnabled(preset) {
  return preset === 'academic' || preset === 'research-portfolio';
}

function mdxParser(preset) {
  const processor = unified().use(remarkParse).use(remarkMdx);
  if (mathEnabled(preset)) processor.use(remarkMath);
  return processor;
}

function literalAttribute(attribute) {
  if (typeof attribute?.value === 'string') return attribute.value;
  const expression = attribute?.value?.data?.estree?.body?.[0]?.expression;
  if (
    expression?.type === 'Literal' &&
    (typeof expression.value === 'string' || typeof expression.value === 'number')
  ) {
    return String(expression.value);
  }
  if (
    expression?.type === 'TemplateLiteral' &&
    expression.expressions?.length === 0 &&
    expression.quasis?.length === 1
  ) {
    return expression.quasis[0].value?.cooked ?? null;
  }
  return null;
}

function inspectMdxTree(tree) {
  const components = new Map();
  const ids = new Set();
  const uncertainIds = new Set();
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
      if (SCAFFOLD_COMPONENT_SET.has(node.name)) {
        components.set(node.name, (components.get(node.name) ?? 0) + 1);
      }
      const valueOf = (name) => literalAttribute(
        (node.attributes ?? []).find(
          (attribute) => attribute?.type === 'mdxJsxAttribute' && attribute.name === name,
        ),
      );
      const rawId = valueOf('id');
      let idSemanticsKnown = false;
      if (/^[a-z]/.test(node.name ?? '') && rawId) {
        ids.add(rawId);
        idSemanticsKnown = true;
      } else if (
        ['Theorem', 'Figure', 'MarginFigure', 'DemoFrame', 'Slider'].includes(node.name) &&
        rawId
      ) {
        ids.add(rawId);
        idSemanticsKnown = true;
      } else if (node.name === 'Exercise' && rawId) {
        ids.add(`exercise-${rawId}`);
        idSemanticsKnown = true;
      } else if (node.name === 'Practice' && rawId) {
        ids.add(`practice-${rawId}`);
        idSemanticsKnown = true;
      } else if (node.name === 'WorkedExample' && rawId) {
        ids.add(`worked-example-${rawId}`);
        idSemanticsKnown = true;
      }
      if (
        rawId &&
        !idSemanticsKnown &&
        /^[A-Z]/.test(node.name ?? '') &&
        !SCAFFOLD_COMPONENT_SET.has(node.name)
      ) {
        uncertainIds.add(rawId);
      }

      if (node.name === 'DemoFrame' && rawId) {
        ids.add(`${rawId}-title`);
        if (valueOf('description')) ids.add(`${rawId}-description`);
        if (valueOf('caption')) ids.add(`${rawId}-caption`);
      }
      if (node.name === 'Slider' && rawId && valueOf('description')) {
        ids.add(`${rawId}-description`);
      }

      const tipNumber = node.name === 'Tip' ? valueOf('n') : null;
      if (tipNumber) ids.add(`tip-${tipNumber}`);
      const solutionFor = node.name === 'Solution' ? valueOf('for') : null;
      if (solutionFor) ids.add(`solution-${solutionFor}`);
      if (node.name === 'ExerciseSolutions') ids.add('exercise-solutions');
      if (node.name === 'AICollaborationDisclosure') ids.add('ai-collab-h');
      if (node.name === 'BlockedByCallout') ids.add('blocked-by-h');
      if (node.name === 'SourceArchive') {
        for (const tier of [
          'T1-official',
          'T2-release-notes',
          'T3-practitioner',
          'T4-conjecture',
        ]) ids.add(`tier-${tier}`);
      }
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(tree);
  return { components, ids, uncertainIds };
}

async function* walkFiles(
  dir,
  baseDir = dir,
  { includeHidden = false, includeWellKnown = false } = {},
) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (
      !includeHidden &&
      (entry.name.startsWith('.') || entry.name.startsWith('_')) &&
      !(includeWellKnown && entry.name === '.well-known')
    ) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkFiles(full, baseDir, { includeHidden, includeWellKnown });
    }
    else yield posix(relative(baseDir, full));
  }
}

function addCounts(target, source) {
  for (const [name, count] of source) {
    target.set(name, (target.get(name) ?? 0) + count);
  }
}

function stableComponentMetrics(counts) {
  const byName = {};
  let total = 0;
  for (const name of [...counts.keys()].sort((a, b) => a.localeCompare(b))) {
    const count = counts.get(name);
    if (!count) continue;
    byName[name] = count;
    total += count;
  }
  return { total, byName };
}

function objectiveAnalysis(chapter, book, diagnostics) {
  if (!chapter.hasObjectives) return { applicable: false, declared: 0, resolved: 0 };

  const los = chapter.frontmatter.los;
  const entries = Array.isArray(los) ? los : [];
  const markers = [...chapter.body.matchAll(
    /\{\s*\/\*\s*anchor:\s*([^\s*]+)\s*\*\/\s*\}/g,
  )];
  const markerSlugs = new Set(markers.map((match) => match[1]));
  const declaredSlugs = new Set();
  let resolvedCount = 0;

  if (!Array.isArray(los)) {
    diagnostics.push(diagnostic({
      severity: 'error',
      code: 'qa.learning_objectives.invalid_declaration',
      message: 'Frontmatter los must be an array of objective objects.',
      book,
      check: 'learning_objectives',
      file: chapter.file,
      line: chapter.frontmatterLines.los ?? 2,
    }));
  }

  entries.forEach((entry, index) => {
    const anchor = isRecord(entry) && typeof entry.anchor === 'string'
      ? entry.anchor.trim()
      : '';
    if (!anchor) {
      diagnostics.push(diagnostic({
        severity: 'error',
        code: 'qa.learning_objectives.missing_anchor',
        message: `Learning objective ${index + 1} has no non-empty anchor.`,
        book,
        check: 'learning_objectives',
        file: chapter.file,
        line: chapter.frontmatterLines.los ?? 2,
      }));
      return;
    }
    declaredSlugs.add(anchor);
    if (markerSlugs.has(anchor)) {
      resolvedCount += 1;
      return;
    }
    diagnostics.push(diagnostic({
      severity: 'error',
      code: 'qa.learning_objectives.unresolved_anchor',
      message: `Learning objective anchor ${JSON.stringify(anchor)} has no matching prose marker.`,
      book,
      check: 'learning_objectives',
      file: chapter.file,
      line: chapter.frontmatterLines.los ?? 2,
    }));
  });

  for (const marker of markers) {
    if (declaredSlugs.has(marker[1])) continue;
    diagnostics.push(diagnostic({
      severity: 'error',
      code: 'qa.learning_objectives.orphan_marker',
      message: `Prose anchor marker ${JSON.stringify(marker[1])} has no declared learning objective.`,
      book,
      check: 'learning_objectives',
      file: chapter.file,
      line: chapter.bodyLineOffset + lineOf(chapter.body, marker.index),
    }));
  }

  return {
    applicable: true,
    declared: entries.length,
    resolved: resolvedCount,
  };
}

async function inspectChapter({
  root,
  path,
  file,
  book,
  runDir,
  preset,
  config,
  parser,
  headingProcessor,
}) {
  const source = await readFile(path, 'utf8');
  let parsed;
  try {
    parsed = parseFrontmatter(source, file);
  } catch {
    parsed = { frontmatter: {}, body: source, lines: {} };
  }
  const localIdFromFile = posix(relative(runDir, path)).replace(/\.mdx?$/, '');
  const localId = typeof parsed.frontmatter.slug === 'string' && parsed.frontmatter.slug.length > 0
    ? parsed.frontmatter.slug
    : localIdFromFile;
  const route = chapterRouteFor(config, book, localId, parsed.frontmatter);
  const result = {
    path,
    file,
    source,
    body: parsed.body,
    frontmatter: parsed.frontmatter,
    frontmatterLines: parsed.lines,
    bodyLineOffset: source.slice(0, source.length - parsed.body.length).split('\n').length - 1,
    localId,
    route,
    draft: parsed.frontmatter.draft === true,
    hasObjectives: Object.prototype.hasOwnProperty.call(parsed.frontmatter, 'los'),
    components: new Map(),
    anchors: new Set(),
    uncertainAnchors: new Set(),
    targets: [],
    parseDiagnostics: [],
  };

  try {
    const tree = parser.parse(parsed.body);
    const inspected = inspectMdxTree(tree);
    result.components = inspected.components;
    for (const id of inspected.ids) result.anchors.add(id);
    for (const id of inspected.uncertainIds) result.uncertainAnchors.add(id);
  } catch (error) {
    result.parseDiagnostics.push(diagnostic({
      severity: 'warning',
      code: 'qa.components.parse_failed',
      message: `Could not count scaffold components: ${error?.reason ?? error?.message ?? error}`,
      book: book?.id ?? QA_SINGLE_BOOK_ID,
      check: 'components',
      file,
      line: result.bodyLineOffset + (error?.position?.start?.line ?? error?.line ?? 1),
    }));
  }

  try {
    result.targets = findAuthoredTargets(source, {
      format: extname(file).toLowerCase() === '.md' ? 'md' : 'mdx',
      math: mathEnabled(preset),
    }).filter((target) => LINK_KINDS.has(target.kind));
  } catch (error) {
    result.parseDiagnostics.push(diagnostic({
      severity: 'error',
      code: 'qa.links.parse_failed',
      message: `Could not inspect internal links: ${error?.reason ?? error?.message ?? error}`,
      book: book?.id ?? QA_SINGLE_BOOK_ID,
      check: 'links',
      file,
      line: error?.position?.start?.line ?? error?.line ?? 1,
    }));
  }

  try {
    const rendered = await headingProcessor.render(parsed.body, {
      fileURL: pathToFileURL(path),
      frontmatter: parsed.frontmatter,
    });
    for (const heading of rendered.metadata.headings ?? []) {
      if (heading.depth >= 2 && heading.depth <= 6) result.anchors.add(heading.slug);
    }
  } catch (error) {
    result.parseDiagnostics.push(diagnostic({
      severity: 'error',
      code: 'qa.links.anchor_index_failed',
      message: `Could not index chapter anchors: ${error?.message ?? error}`,
      book: book?.id ?? QA_SINGLE_BOOK_ID,
      check: 'links',
      file,
      line: result.bodyLineOffset + (error?.position?.start?.line ?? 1),
    }));
  }
  return result;
}

async function collectChapters({ root, chaptersRoot, corpus, preset, config }) {
  const parser = mdxParser(preset);
  const headingProcessor = await createMarkdownProcessor({ syntaxHighlight: false });
  const runs = corpus
    ? corpus.books.map((book) => ({ book, dir: resolve(chaptersRoot, book.id) }))
    : [{ book: null, dir: chaptersRoot }];
  const chapters = new Map(runs.map((run) => [run.book?.id ?? QA_SINGLE_BOOK_ID, []]));
  for (const run of runs) {
    for await (const localFile of walkMdx(run.dir)) {
      const path = resolve(run.dir, localFile);
      const file = sourcePath(root, path);
      chapters.get(run.book?.id ?? QA_SINGLE_BOOK_ID).push(await inspectChapter({
        root,
        path,
        file,
        book: run.book,
        runDir: run.dir,
        preset,
        config,
        parser,
        headingProcessor,
      }));
    }
  }
  return chapters;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function routePatternMatcher(pattern) {
  const normalized = `/${String(pattern).replace(/^\/+|\/+$/g, '')}`;
  if (normalized === '/') return /^\/?$/;
  const segments = normalized.slice(1).split('/');
  let expression = '^';
  for (const segment of segments) {
    if (/^\[\.\.\.[^\]]+\]$/.test(segment)) {
      expression += '(?:/(?:.*))?';
      continue;
    }
    let cursor = 0;
    let compiled = '';
    for (const match of segment.matchAll(/\[(\.\.\.)?[^\]]+\]/g)) {
      compiled += escapeRegex(segment.slice(cursor, match.index));
      compiled += match[1] ? '(?:.*)' : '[^/]+';
      cursor = match.index + match[0].length;
    }
    expression += `/${compiled}${escapeRegex(segment.slice(cursor))}`;
  }
  return new RegExp(`${expression}/?$`);
}

async function collectConsumerRoutes(root) {
  const matchers = [];
  const pagesRoot = resolve(root, 'src/pages');
  for await (const file of walkFiles(pagesRoot, pagesRoot, { includeWellKnown: true })) {
    if (!/\.(?:astro|html|md|markdown|mdown|mkdn|mkd|mdwn|mdx|js|ts)$/.test(file)) continue;
    const withoutExtension = file.replace(/\.[^.]+$/, '');
    const segments = withoutExtension.split('/');
    if (segments.at(-1) === 'index') segments.pop();
    matchers.push(routePatternMatcher(`/${segments.join('/')}`));
  }
  return matchers;
}

async function collectPublicRoutes(root) {
  const routes = new Set();
  const publicRoot = resolve(root, 'public');
  for await (const file of walkFiles(publicRoot, publicRoot, { includeHidden: true })) {
    routes.add(normalizeRoute(`/${file}`));
    if (file.endsWith('/index.html') || file === 'index.html') {
      routes.add(normalizeRoute(`/${file.replace(/(?:^|\/)index\.html$/, '')}`));
    }
  }
  return routes;
}

function knownScaffoldRoutes(config, corpus) {
  const enabled = new Set(config.enabledRoutes ?? []);
  const routes = new Set();
  const apparatusRouteByToggle = {
    references: 'references',
    print: 'print',
    convergence: 'convergence',
    tips: 'tips',
    exercises: 'exercises',
    practiceExam: 'practice-exam',
    glossary: 'glossary',
    answers: 'answers',
    flashcards: 'flashcards',
  };
  if (!corpus) {
    if (enabled.has('landing')) routes.add('/');
    if (enabled.has('chapters')) routes.add('/chapters');
    if (enabled.has('search')) routes.add('/search');
    for (const [toggle, route] of Object.entries(apparatusRouteByToggle)) {
      if (!enabled.has(toggle)) continue;
      routes.add(normalizeRoute(routeTokens(config.apparatusRoute, {
        book: '', id: '', slug: '', route,
      })));
    }
    return routes;
  }
  if (enabled.has('landing')) routes.add('/');
  if (enabled.has('chapters')) routes.add('/chapters');
  if (enabled.has('search')) routes.add('/search');
  for (const book of corpus.books) {
    if (enabled.has('landing')) routes.add(normalizeRoute(`/${book.id}`));
    if (enabled.has('chapters')) routes.add(normalizeRoute(`/chapters/${book.id}`));
    for (const route of book.apparatus ?? config.apparatusRoutes ?? []) {
      routes.add(normalizeRoute(routeTokens(config.apparatusRoute, {
        book: book.id, id: '', slug: '', route,
      })));
    }
  }
  return routes;
}

function knownScaffoldRouteMatchers(config) {
  const enabled = new Set(config.enabledRoutes ?? []);
  return enabled.has('frontmatter')
    ? [routePatternMatcher(config.frontmatterRoute)]
    : [];
}

function internalTarget(target, currentRoute, base) {
  const value = target.trim();
  if (!value || value.startsWith('//')) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null;
  let url;
  try {
    url = new URL(value, `${ORIGIN}${currentRoute.endsWith('/') ? currentRoute : `${currentRoute}/`}`);
  } catch {
    return { malformed: true, pathname: '', fragment: '', original: target };
  }
  if (url.origin !== ORIGIN) return null;
  const normalizedBase = normalizeAstroBase(base);
  let pathname = url.pathname;
  if (
    normalizedBase !== '/' &&
    (pathname === normalizedBase || pathname.startsWith(`${normalizedBase}/`))
  ) {
    pathname = pathname.slice(normalizedBase.length) || '/';
  }
  let fragment = url.hash.slice(1);
  try {
    fragment = decodeURIComponent(fragment);
  } catch {
    return { malformed: true, pathname, fragment, original: target };
  }
  return {
    malformed: false,
    pathname: normalizeRoute(pathname),
    fragment,
    original: target,
  };
}

async function analyzeLinks({ root, chapters, selectedIds, config, corpus, diagnosticsByBook }) {
  const routeAnchors = new Map();
  const scaffoldChaptersEnabled = (config.enabledRoutes ?? []).includes('chapters');
  for (const entries of chapters.values()) {
    for (const chapter of entries) {
      // Draft sources are scanned for outgoing defects, but Astro does not
      // publish their chapter routes, so they cannot satisfy an inbound link.
      if (scaffoldChaptersEnabled && !chapter.draft) {
        routeAnchors.set(chapter.route, {
          verified: new Set([...chapter.anchors, 'provenance-h']),
          uncertain: chapter.uncertainAnchors,
        });
      }
    }
  }
  const scaffoldRoutes = knownScaffoldRoutes(config, corpus);
  const scaffoldMatchers = knownScaffoldRouteMatchers(config);
  const consumerMatchers = await collectConsumerRoutes(root);
  const publicRoutes = await collectPublicRoutes(root);
  const metrics = new Map();

  for (const book of selectedIds) {
    let checked = 0;
    let broken = 0;
    let skippedFragments = 0;
    const bookDiagnostics = diagnosticsByBook.get(book);
    for (const chapter of chapters.get(book) ?? []) {
      bookDiagnostics.push(...chapter.parseDiagnostics.filter((entry) => entry.check === 'links'));
      broken += chapter.parseDiagnostics.filter(
        (entry) => entry.check === 'links' && entry.severity === 'error',
      ).length;
      for (const authored of chapter.targets) {
        const target = internalTarget(authored.target, chapter.route, config.base);
        if (target === null) continue;
        checked += 1;
        let reason = null;
        const localTarget = authored.target.trim().startsWith('#');
        const indexed = localTarget
          ? {
              verified: scaffoldChaptersEnabled
                ? new Set([...chapter.anchors, 'provenance-h'])
                : chapter.anchors,
              uncertain: chapter.uncertainAnchors,
            }
          : routeAnchors.get(target.pathname);
        if (target.malformed) {
          reason = 'is malformed';
        } else {
          const routeExists = localTarget ||
            routeAnchors.has(target.pathname) ||
            scaffoldRoutes.has(target.pathname) ||
            publicRoutes.has(target.pathname) ||
            scaffoldMatchers.some((matcher) => matcher.test(target.pathname)) ||
            consumerMatchers.some((matcher) => matcher.test(target.pathname));
          if (!routeExists) reason = 'does not resolve to a known route or public asset';
          else if (target.fragment && indexed) {
            if (indexed.verified.has(target.fragment)) {
              // Verified chapter/local fragment.
            } else if (indexed.uncertain.has(target.fragment)) {
              skippedFragments += 1;
              bookDiagnostics.push(diagnostic({
                severity: 'warning',
                code: 'qa.links.fragment_unverified',
                message: `Internal link ${JSON.stringify(authored.target)} may be rendered by a custom MDX component, so QA could not verify its fragment.`,
                book,
                check: 'links',
                file: chapter.file,
                line: lineOf(chapter.source, authored.index),
              }));
            } else {
              reason = `has no fragment ${JSON.stringify(target.fragment)}`;
            }
          } else if (target.fragment) {
            skippedFragments += 1;
            bookDiagnostics.push(diagnostic({
              severity: 'warning',
              code: 'qa.links.fragment_unverified',
              message: `Internal link ${JSON.stringify(authored.target)} reaches a known non-chapter route, but QA could not index that route's fragments.`,
              book,
              check: 'links',
              file: chapter.file,
              line: lineOf(chapter.source, authored.index),
            }));
          }
        }
        if (!reason) continue;
        broken += 1;
        bookDiagnostics.push(diagnostic({
          severity: 'error',
          code: 'qa.links.broken_target',
          message: `Internal link ${JSON.stringify(authored.target)} ${reason}.`,
          book,
          check: 'links',
          file: chapter.file,
          line: lineOf(chapter.source, authored.index),
        }));
      }
    }
    metrics.set(book, { checked, broken, skippedFragments });
  }
  return metrics;
}

function jsonErrorLocation(source, error) {
  const match = String(error?.message ?? error).match(/position\s+(\d+)/i);
  if (!match) return {};
  const index = Number(match[1]);
  const before = source.slice(0, index);
  const lines = before.split('\n');
  return { line: lines.length, column: lines.at(-1).length + 1 };
}

function schemaReference(root, fixturePath, reference) {
  if (typeof reference !== 'string' || reference.trim().length === 0) {
    return { error: 'must be a non-empty string' };
  }
  let pathPart = reference.trim();
  const hash = pathPart.indexOf('#');
  const fragment = hash >= 0 ? pathPart.slice(hash) : '';
  if (hash >= 0) pathPart = pathPart.slice(0, hash);
  if (/^https?:/i.test(pathPart)) {
    return { error: 'must reference a local schema; QA never fetches network schemas' };
  }
  if (pathPart.startsWith('//') || pathPart.startsWith('\\\\')) {
    return { error: 'must not use a protocol-relative or network path' };
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(pathPart) && !pathPart.startsWith('file:')) {
    return { error: `uses unsupported URI scheme in ${JSON.stringify(reference)}` };
  }
  let path;
  try {
    if (pathPart.startsWith('file:')) path = fileURLToPath(pathPart);
    else if (isAbsolute(pathPart)) path = resolve(root, `.${pathPart}`);
    else path = resolve(dirname(fixturePath), pathPart);
  } catch (error) {
    return { error: `cannot be resolved: ${error?.message ?? error}` };
  }
  const rootPrefix = `${resolve(root)}${sep}`;
  if (path !== resolve(root) && !path.startsWith(rootPrefix)) {
    return { error: 'resolves outside the project root' };
  }
  if (path === fixturePath && !fragment) {
    return { error: 'resolves to the fixture itself' };
  }
  return { path, fragment, reference };
}

function schemaFailureMessage(errors) {
  if (!Array.isArray(errors) || errors.length === 0) return 'does not satisfy its JSON Schema';
  return errors
    .map((error) => {
      const at = error?.instancePath || error?.dataPath || '/';
      return `${at}: ${error?.message ?? String(error)}`;
    })
    .sort((a, b) => a.localeCompare(b))
    .join('; ');
}

function* nestedSchemaReferences(value) {
  if (Array.isArray(value)) {
    for (const entry of value) yield* nestedSchemaReferences(entry);
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, entry] of Object.entries(value)) {
    if (
      (key === '$ref' || key === '$dynamicRef' || key === '$recursiveRef') &&
      typeof entry === 'string'
    ) {
      yield entry;
    } else {
      yield* nestedSchemaReferences(entry);
    }
  }
}

async function analyzeDemoFixtures({
  root,
  corpus,
  selectedIds,
  validateJsonSchema,
  diagnosticsByBook,
  sharedDiagnostics,
}) {
  const dataRoot = resolve(root, 'src/data');
  const canonicalRoot = await realpath(root);
  const candidates = [];
  for await (const file of walkFiles(dataRoot, dataRoot, { includeHidden: true })) {
    if (!file.endsWith('.json') || GENERATED_DATA_PATHS.has(file)) continue;
    const path = resolve(dataRoot, file);
    const source = await readFile(path, 'utf8');
    let value;
    let parseError = null;
    try {
      value = JSON.parse(source);
    } catch (error) {
      parseError = error;
    }
    candidates.push({ path, file: sourcePath(root, path), dataFile: file, source, value, parseError });
  }

  const referencedSchemas = new Set();
  const candidateByPath = new Map(candidates.map((candidate) => [candidate.path, candidate]));
  for (const candidate of candidates) {
    if (candidate.parseError || !isRecord(candidate.value) || !('$schema' in candidate.value)) continue;
    const resolved = schemaReference(root, candidate.path, candidate.value.$schema);
    if (resolved.path) referencedSchemas.add(resolved.path);
  }
  const pendingSchemas = [...referencedSchemas];
  for (let index = 0; index < pendingSchemas.length; index += 1) {
    const candidate = candidateByPath.get(pendingSchemas[index]);
    if (!candidate || candidate.parseError) continue;
    for (const reference of nestedSchemaReferences(candidate.value)) {
      if (reference.startsWith('#')) continue;
      const resolved = schemaReference(root, candidate.path, reference);
      if (
        resolved.path &&
        candidateByPath.has(resolved.path) &&
        !referencedSchemas.has(resolved.path)
      ) {
        referencedSchemas.add(resolved.path);
        pendingSchemas.push(resolved.path);
      }
    }
  }

  const bookMetrics = new Map(selectedIds.map((id) => [id, {
    discovered: 0,
    valid: 0,
    invalid: 0,
    schemasValidated: 0,
  }]));
  const sharedMetrics = { discovered: 0, valid: 0, invalid: 0, schemasValidated: 0 };
  const registered = new Set(corpus?.books.map((book) => book.id) ?? []);

  for (const candidate of candidates) {
    if (referencedSchemas.has(candidate.path)) continue;
    const firstSegment = candidate.dataFile.split('/')[0];
    const owner = corpus && registered.has(firstSegment) ? firstSegment : null;
    if (owner && !selectedIds.includes(owner)) continue;
    const book = owner ?? (corpus ? QA_CORPUS_BOOK_ID : QA_SINGLE_BOOK_ID);
    const metrics = book === QA_CORPUS_BOOK_ID ? sharedMetrics : bookMetrics.get(book);
    const diagnostics = book === QA_CORPUS_BOOK_ID ? sharedDiagnostics : diagnosticsByBook.get(book);
    metrics.discovered += 1;

    if (candidate.parseError) {
      metrics.invalid += 1;
      diagnostics.push(diagnostic({
        severity: 'error',
        code: 'qa.demo_fixtures.invalid_json',
        message: `Demo fixture contains invalid JSON: ${candidate.parseError.message}`,
        book,
        check: 'demo_fixtures',
        file: candidate.file,
        ...jsonErrorLocation(candidate.source, candidate.parseError),
      }));
      continue;
    }

    if (isRecord(candidate.value) && Object.prototype.hasOwnProperty.call(candidate.value, '$schema')) {
      const reference = schemaReference(root, candidate.path, candidate.value.$schema);
      if (reference.error) {
        metrics.invalid += 1;
        diagnostics.push(diagnostic({
          severity: 'error',
          code: 'qa.demo_fixtures.invalid_schema_reference',
          message: `Demo fixture $schema ${reference.error}.`,
          book,
          check: 'demo_fixtures',
          file: candidate.file,
          line: 1,
        }));
        continue;
      }
      let schemaSource;
      let schema;
      try {
        const canonicalSchemaPath = await realpath(reference.path);
        const local = relative(canonicalRoot, canonicalSchemaPath);
        if (local.startsWith('..') || isAbsolute(local)) {
          throw new Error('resolved schema escapes the project root after symlink resolution');
        }
        schemaSource = await readFile(reference.path, 'utf8');
        schema = JSON.parse(schemaSource);
      } catch (error) {
        metrics.invalid += 1;
        diagnostics.push(diagnostic({
          severity: 'error',
          code: 'qa.demo_fixtures.unreadable_schema',
          message: `Referenced JSON Schema ${JSON.stringify(sourcePath(root, reference.path))} is missing or invalid: ${error?.message ?? error}`,
          book,
          check: 'demo_fixtures',
          file: candidate.file,
          line: 1,
        }));
        continue;
      }
      if (typeof validateJsonSchema !== 'function') {
        throw new QaExecutionError(
          `QA found ${candidate.file} with $schema but no validateJsonSchema adapter was provided.`,
        );
      }
      let outcome;
      try {
        outcome = await validateJsonSchema({
          value: candidate.value,
          schema,
          schemaPath: reference.path,
          schemaReference: reference.reference,
          schemaFragment: reference.fragment,
          fixturePath: candidate.path,
          root,
        });
      } catch (error) {
        metrics.invalid += 1;
        diagnostics.push(diagnostic({
          severity: 'error',
          code: 'qa.demo_fixtures.schema_error',
          message: `Referenced JSON Schema could not be evaluated: ${error?.message ?? error}`,
          book,
          check: 'demo_fixtures',
          file: candidate.file,
          line: 1,
        }));
        continue;
      }
      const valid = outcome === true || outcome?.valid === true;
      metrics.schemasValidated += 1;
      if (!valid) {
        metrics.invalid += 1;
        diagnostics.push(diagnostic({
          severity: 'error',
          code: 'qa.demo_fixtures.schema_mismatch',
          message: `Demo fixture ${schemaFailureMessage(outcome?.errors)}.`,
          book,
          check: 'demo_fixtures',
          file: candidate.file,
          line: 1,
        }));
        continue;
      }
    }
    metrics.valid += 1;
  }
  return { bookMetrics, sharedMetrics };
}

function checkFromDiagnostics(stateWhenClean, metrics, sourceDiagnostics, publicDiagnostics, check) {
  const relevant = sourceDiagnostics.filter((entry) => entry.check === check);
  const state = relevant.some((entry) => entry.severity === 'error')
    ? 'red'
    : relevant.some((entry) => entry.severity === 'warning')
      ? 'amber'
      : stateWhenClean;
  return checkResult(state, metrics, idsForCheck(publicDiagnostics, sourceDiagnostics, check));
}

function validationResultBook(entry, corpus, selectedIds) {
  if (!corpus) return QA_SINGLE_BOOK_ID;
  if (selectedIds.includes(entry?.book)) return entry.book;
  return QA_CORPUS_BOOK_ID;
}

function validationBookResult(bookResults, id) {
  if (bookResults instanceof Map) return bookResults.get(id) ?? null;
  if (Array.isArray(bookResults)) {
    return bookResults.find((entry) => entry?.book === id || entry?.id === id) ?? null;
  }
  return isRecord(bookResults) && isRecord(bookResults[id]) ? bookResults[id] : null;
}

async function resolveValidation(options) {
  if (options.validationResult) return options.validationResult;
  if (typeof options.runValidation !== 'function') {
    throw new QaExecutionError('runQa requires an injected runValidation function or validationResult.');
  }
  try {
    return await options.runValidation({
      root: options.root,
      argv: options.argv,
      env: options.env,
      ...(options.validationOptions ?? {}),
    });
  } catch (error) {
    throw new QaExecutionError(`Content validation failed to execute: ${error?.message ?? error}`, {
      cause: error,
    });
  }
}

function fatalMessage(fatal) {
  if (fatal instanceof Error) return fatal.message;
  if (typeof fatal === 'string') return fatal;
  if (isRecord(fatal)) return fatal.message ?? JSON.stringify(fatal);
  return String(fatal);
}

/**
 * Run the complete QA analysis without process side effects.
 *
 * `runValidation` must implement the shared validator-core contract:
 *   ({ root, argv, env, ... }) =>
 *     { preset, scope: { selected }, bookResults, errors?, warnings?, notices?, fatal? }
 * Evaluated config/corpus metadata may be omitted; QA resolves the same
 * tooling config as a fallback. Legacy aggregate diagnostic fields are also
 * accepted and de-duplicated with per-book results.
 *
 * `validateJsonSchema`, when needed, receives local parsed schema/value data
 * and returns `{ valid, errors? }` (or boolean true). It must never fetch.
 */
export async function runQa(options = {}) {
  const root = resolve(options.root ?? process.cwd());
  const argv = options.argv ?? [];
  const env = options.env ?? process.env;
  const validation = await resolveValidation({ ...options, root, argv, env });
  if (!isRecord(validation)) throw new QaExecutionError('Validation core returned no result object.');
  if (validation.fatal) {
    throw new QaExecutionError(`Validation reported a fatal failure: ${fatalMessage(validation.fatal)}`);
  }

  const preset = validation.preset;
  if (!QA_PRESETS.includes(preset)) {
    throw new QaExecutionError(
      `Validation returned invalid preset ${JSON.stringify(preset)}; expected ${QA_PRESETS.join(' | ')}.`,
    );
  }
  const config = validation.toolingConfig ?? validation.config ?? options.toolingConfig ??
    await loadResolvedBookConfig(root);
  const corpus = validation.corpus ?? config.corpus ?? null;
  const fallbackSelection = resolveBookSelection(config, argv, 'book-scaffold qa');
  const scopedBooks = Array.isArray(validation.scope?.selected)
    ? validation.scope.selected
    : [];
  const returnedBooks = scopedBooks.length > 0
    ? scopedBooks
    : Array.isArray(validation.selectedBooks)
      ? validation.selectedBooks.map((book) => typeof book === 'string' ? book : book?.id)
      : [];
  const selectedIds = corpus
    ? (returnedBooks.length > 0 ? returnedBooks : fallbackSelection.books.map((book) => book.id))
    : [QA_SINGLE_BOOK_ID];
  const registeredIds = new Set(corpus?.books.map((book) => book.id) ?? []);
  if (corpus && selectedIds.some((id) => !registeredIds.has(id))) {
    throw new QaExecutionError('Validation returned an unregistered selected corpus book.');
  }

  const diagnosticsByBook = new Map(selectedIds.map((id) => [id, []]));
  const sharedDiagnostics = [];
  const seenValidationDiagnostics = new Set();
  const addValidationDiagnostics = (severity, entries, forcedBook = null) => {
    if (!Array.isArray(entries)) {
      throw new QaExecutionError(`Validation ${severity} diagnostics must be an array.`);
    }
    for (const entry of entries) {
      const book = forcedBook ?? validationResultBook(entry, corpus, selectedIds);
      const normalized = validationDiagnostic(entry, severity, book);
      const signature = [
        normalized.severity,
        normalized.code,
        normalized.message,
        normalized.book,
        normalized.file ?? '',
        normalized.line ?? 0,
        normalized.column ?? 0,
      ].join('\u0000');
      if (seenValidationDiagnostics.has(signature)) continue;
      seenValidationDiagnostics.add(signature);
      if (book === QA_CORPUS_BOOK_ID) sharedDiagnostics.push(normalized);
      else diagnosticsByBook.get(book).push(normalized);
    }
  };
  addValidationDiagnostics('error', validation.errors ?? []);
  addValidationDiagnostics('warning', validation.warnings ?? []);
  addValidationDiagnostics('warning', validation.notices ?? []);
  for (const book of selectedIds) {
    const bookResult = validationBookResult(validation.bookResults, book);
    if (!bookResult) continue;
    addValidationDiagnostics('error', bookResult.errors ?? [], book);
    addValidationDiagnostics('warning', bookResult.warnings ?? [], book);
    addValidationDiagnostics('warning', bookResult.notices ?? [], book);
  }

  const chaptersRoot = options.chaptersRoot ?? (
    env.BOOK_CHAPTERS_DIR
      ? resolve(root, env.BOOK_CHAPTERS_DIR)
      : await readChaptersBase(root, { corpus })
  );
  const chapters = await collectChapters({ root, chaptersRoot, corpus, preset, config });

  const chapterMetrics = new Map();
  const objectiveMetrics = new Map();
  const componentMetrics = new Map();
  for (const book of selectedIds) {
    const entries = chapters.get(book) ?? [];
    const nonDraft = entries.filter((chapter) => !chapter.draft).length;
    const draft = entries.length - nonDraft;
    chapterMetrics.set(book, { total: entries.length, nonDraft, draft });
    if (nonDraft === 0) {
      diagnosticsByBook.get(book).push(diagnostic({
        severity: 'error',
        code: 'qa.chapters.no_non_draft',
        message: 'Book must contain at least one non-draft chapter.',
        book,
        check: 'chapters',
      }));
    }

    let applicable = false;
    let declared = 0;
    let resolvedObjectives = 0;
    const componentCounts = new Map();
    for (const chapter of entries) {
      diagnosticsByBook.get(book).push(
        ...chapter.parseDiagnostics.filter((entry) => entry.check === 'components'),
      );
      addCounts(componentCounts, chapter.components);
      const objective = objectiveAnalysis(chapter, book, diagnosticsByBook.get(book));
      applicable ||= objective.applicable;
      declared += objective.declared;
      resolvedObjectives += objective.resolved;
    }
    objectiveMetrics.set(book, applicable
      ? {
          declared,
          resolved: resolvedObjectives,
          coverage: declared === 0 ? 1 : resolvedObjectives / declared,
        }
      : null);
    componentMetrics.set(book, stableComponentMetrics(componentCounts));
  }

  const linkMetrics = await analyzeLinks({
    root,
    chapters,
    selectedIds,
    config,
    corpus,
    diagnosticsByBook,
  });
  const fixtureAnalysis = await analyzeDemoFixtures({
    root,
    corpus,
    selectedIds,
    validateJsonSchema: options.validateJsonSchema,
    diagnosticsByBook,
    sharedDiagnostics,
  });

  const books = {};
  for (const book of selectedIds) {
    const sourceDiagnostics = diagnosticsByBook.get(book);
    const publicDiagnostics = finalizeDiagnostics(book, sourceDiagnostics);
    const objective = objectiveMetrics.get(book);
    const fixtureMetrics = fixtureAnalysis.bookMetrics.get(book);
    const checks = {
      content_contract: contentContractCheck(
        sourceDiagnostics.filter((entry) => entry.check === 'content_contract'),
        publicDiagnostics,
      ),
      chapters: checkFromDiagnostics(
        'green', chapterMetrics.get(book), sourceDiagnostics, publicDiagnostics, 'chapters',
      ),
      links: checkFromDiagnostics(
        'green', linkMetrics.get(book), sourceDiagnostics, publicDiagnostics, 'links',
      ),
      learning_objectives: objective === null
        ? checkResult('not_applicable', {}, [])
        : checkFromDiagnostics(
            'green', objective, sourceDiagnostics, publicDiagnostics, 'learning_objectives',
          ),
      components: checkFromDiagnostics(
        'green', componentMetrics.get(book), sourceDiagnostics, publicDiagnostics, 'components',
      ),
      demo_fixtures: fixtureMetrics.discovered === 0
        ? checkResult('not_applicable', fixtureMetrics, [])
        : checkFromDiagnostics(
            'green', fixtureMetrics, sourceDiagnostics, publicDiagnostics, 'demo_fixtures',
          ),
    };
    books[book] = {
      verdict: worstState(Object.values(checks).map((check) => check.state)),
      checks,
      diagnostics: publicDiagnostics,
    };
  }

  let shared;
  if (!corpus) {
    shared = { verdict: 'not_applicable', checks: {}, diagnostics: [] };
  } else {
    const sourceDiagnostics = sharedDiagnostics;
    const publicDiagnostics = finalizeDiagnostics(QA_CORPUS_BOOK_ID, sourceDiagnostics);
    const checks = {};
    const contentDiagnostics = sourceDiagnostics.filter(
      (entry) => entry.check === 'content_contract',
    );
    if (contentDiagnostics.length > 0) {
      checks.content_contract = contentContractCheck(contentDiagnostics, publicDiagnostics);
    }
    checks.demo_fixtures = fixtureAnalysis.sharedMetrics.discovered === 0
      ? checkResult('not_applicable', fixtureAnalysis.sharedMetrics, [])
      : checkFromDiagnostics(
          'green',
          fixtureAnalysis.sharedMetrics,
          sourceDiagnostics,
          publicDiagnostics,
          'demo_fixtures',
        );
    shared = {
      verdict: worstState(Object.values(checks).map((check) => check.state)),
      checks,
      diagnostics: publicDiagnostics,
    };
  }

  const allDiagnostics = [
    ...Object.values(books).flatMap((book) => book.diagnostics),
    ...shared.diagnostics,
  ];
  const verdict = worstState([
    ...Object.values(books).map((book) => book.verdict),
    shared.verdict,
  ]);
  return {
    schemaVersion: QA_SCHEMA_VERSION,
    preset,
    scope: {
      kind: corpus ? 'corpus' : 'single',
      selected: [...selectedIds],
    },
    verdict,
    books,
    shared,
    summary: {
      booksChecked: selectedIds.length,
      blockingFailures: allDiagnostics.filter((entry) => entry.severity === 'error').length,
      advisories: allDiagnostics.filter((entry) => entry.severity === 'warning').length,
    },
  };
}

const STATE_LABEL = Object.freeze({
  green: 'GREEN',
  amber: 'AMBER',
  red: 'RED',
  not_applicable: 'N/A',
});
const STATE_COLOR = Object.freeze({ green: 32, amber: 33, red: 31, not_applicable: 2 });

function stateLabel(state, color) {
  const label = STATE_LABEL[state] ?? String(state).toUpperCase();
  return color ? `\u001b[${STATE_COLOR[state] ?? 0}m${label}\u001b[0m` : label;
}

function checkSummary(name, check) {
  const metrics = check.metrics;
  switch (name) {
    case 'content_contract':
      return `${metrics.errors} error${metrics.errors === 1 ? '' : 's'}, ` +
        `${metrics.advisories} ${metrics.advisories === 1 ? 'advisory' : 'advisories'}`;
    case 'chapters':
      return `${metrics.nonDraft} ready, ${metrics.draft} draft`;
    case 'links':
      return `${metrics.checked} checked` +
        (metrics.broken ? `, ${metrics.broken} broken` : '') +
        (metrics.skippedFragments ? `, ${metrics.skippedFragments} fragment checks skipped` : '');
    case 'learning_objectives':
      return check.state === 'not_applicable'
        ? 'objective-anchor convention not exposed'
        : `${metrics.resolved}/${metrics.declared} anchors`;
    case 'components': {
      const entries = Object.entries(metrics.byName ?? {});
      return entries.length === 0
        ? 'none found'
        : entries.map(([component, count]) => `${component} ${count}`).join(', ');
    }
    case 'demo_fixtures':
      return check.state === 'not_applicable'
        ? 'none discovered'
        : `${metrics.valid}/${metrics.discovered} valid` +
            (metrics.schemasValidated ? `, ${metrics.schemasValidated} schema-validated` : '') +
            (metrics.invalid ? `, ${metrics.invalid} invalid` : '');
    default:
      return '';
  }
}

function diagnosticLine(entry) {
  const location = entry.file
    ? `${entry.file}${entry.line ? `:${entry.line}${entry.column ? `:${entry.column}` : ''}` : ''}`
    : '(no source location)';
  return `    ${entry.severity.toUpperCase()} [${entry.code}] ${location}  ${entry.message}`;
}

function renderSection(lines, name, result, color) {
  lines.push(`${name.padEnd(24)} ${stateLabel(result.verdict, color)}`);
  for (const [checkName, check] of Object.entries(result.checks)) {
    lines.push(
      `  ${checkName.padEnd(22)} ${stateLabel(check.state, color).padEnd(color ? 18 : 7)} ` +
      checkSummary(checkName, check),
    );
  }
  for (const entry of result.diagnostics) lines.push(diagnosticLine(entry));
}

/** Render the stable result as JSON with a single trailing newline. */
export function renderQaJson(result) {
  if (result?.schemaVersion !== QA_SCHEMA_VERSION) {
    throw new QaExecutionError('Cannot render a QA result with an unknown schemaVersion.');
  }
  return `${JSON.stringify(result, null, 2)}\n`;
}

/** Render compact human output. Caller decides terminal color support. */
export function renderQaHuman(result, { color = false } = {}) {
  if (result?.schemaVersion !== QA_SCHEMA_VERSION) {
    throw new QaExecutionError('Cannot render a QA result with an unknown schemaVersion.');
  }
  const selected = result.scope.selected.join(', ');
  const lines = [
    `preset                   ${result.preset}`,
    `scope                    ${result.scope.kind}${selected ? ` (${selected})` : ''}`,
    '',
  ];
  for (const id of result.scope.selected) {
    renderSection(lines, id, result.books[id], color);
    lines.push('');
  }
  if (result.scope.kind === 'corpus') {
    if (result.shared.verdict !== 'not_applicable') {
      renderSection(lines, 'shared', result.shared, color);
      lines.push('');
    }
    lines.push(
      `${'corpus'.padEnd(24)} ${stateLabel(result.verdict, color)}   ` +
      `${result.summary.booksChecked} book${result.summary.booksChecked === 1 ? '' : 's'} checked`,
    );
  }
  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}

/** Map a completed content verdict to the public QA command's CI exit code. */
export function qaExitCode(result) {
  return result?.verdict === 'red' ? 1 : 0;
}
