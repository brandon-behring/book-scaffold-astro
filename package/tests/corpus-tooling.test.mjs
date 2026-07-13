import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  legacyFrontmatterBook,
  mergeCorpusArtifact,
  parseFrontmatter,
  resolveBookSelection,
} from '../scripts/corpus-tooling.mjs';
import { loadResolvedBookConfig } from '../scripts/resolve-book-config.mjs';
import { resolveCorpusBookHref } from '../dist/index.mjs';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SCRIPTS = resolve(TEST_DIR, '..', 'scripts');
const CORPUS = Object.freeze({
  __bookCorpusVersion: 1,
  preset: 'minimal',
  books: Object.freeze([
    Object.freeze({ id: 'alpha', title: 'Alpha', apparatus: Object.freeze(['references']) }),
    Object.freeze({ id: 'beta', title: 'Beta' }),
  ]),
});

function setupCorpus(root) {
  mkdirSync(join(root, 'src/content/alpha'), { recursive: true });
  mkdirSync(join(root, 'src/content/beta'), { recursive: true });
  mkdirSync(join(root, 'src/data'), { recursive: true });
  writeFileSync(
    join(root, 'astro.config.mjs'),
    `export default { integrations: [{ name: 'book-scaffold-astro',\n` +
      `__bookScaffoldResolvedConfig: ${JSON.stringify({
        preset: 'minimal',
        numberStyle: 'shared',
        siblingBooks: {},
        corpus: CORPUS,
        chapterRoute: '/chapters/:id/',
        bookField: 'book',
        apparatusRoute: '/:book/:route/',
        apparatusRoutes: ['references'],
      })} }] };\n`,
  );
  writeChapter(root, 'alpha', '', 'alpha');
  writeChapter(root, 'beta', '', null, 'nested/explicit');
  mkdirSync(join(root, 'src/content/alpha/_drafts'), { recursive: true });
  writeFileSync(
    join(root, 'src/content/alpha/_drafts/ignored.mdx'),
    '---\ntitle: Ignored\nchapter: 99\n---\n' +
      '<Theorem id="shared" kind="theorem" />\n' +
      '<Tip n="99" title="Ignored">Ignored.</Tip>\n' +
      '<Exercise id="ignored">Ignored.</Exercise>\n',
  );
  writeFileSync(
    join(root, 'bibliography.bib'),
    '@book{shared, title={Shared source}, author={Example, Ada}, year={2025}}\n',
  );
  mkdirSync(join(root, 'sources'), { recursive: true });
  writeFileSync(join(root, 'sources/manifest.yaml'), '- id: shared-source\n  title: Shared source\n');
}

function writeChapter(root, book, extra = '', legacyBook = null, slug = null) {
  writeFileSync(
    join(root, `src/content/${book}/same.mdx`),
    `---\ntitle: ${book}\nchapter: 1\n${slug ? `slug: "${slug}" # canonical\n` : ''}` +
      `${legacyBook ? `book: "${legacyBook}" # owner\n` : ''}---\n\n` +
      `## Shared heading\n\n<Theorem id="shared" kind="theorem" />\n\n` +
      `<Tip n="1" title="Shared tip">A ${book} tip.</Tip>\n\n` +
      `<Exercise id="shared-exercise">A ${book} exercise.</Exercise>\n\n${extra}\n`,
  );
}

function run(root, script, args = []) {
  return spawnSync(process.execPath, [join(SCRIPTS, script), ...args], {
    cwd: root,
    encoding: 'utf8',
    timeout: 15_000,
  });
}

function json(root, name) {
  return JSON.parse(readFileSync(join(root, 'src/data', name), 'utf8'));
}

test('#80: common selector preserves manifest order and rejects single-book --book', () => {
  const full = resolveBookSelection({ corpus: CORPUS }, [], 'test-tool');
  assert.deepEqual(full.books.map((book) => book.id), ['alpha', 'beta']);
  assert.equal(full.requestedBook, null);

  const selected = resolveBookSelection({ corpus: CORPUS }, ['--book', 'beta'], 'test-tool');
  assert.deepEqual(selected.books.map((book) => book.id), ['beta']);
  assert.equal(selected.requestedBook, 'beta');
  assert.throws(
    () => resolveBookSelection({ corpus: null }, ['--book', 'alpha'], 'test-tool'),
    /available only.*corpus/,
  );
  assert.throws(
    () => resolveBookSelection({ corpus: CORPUS }, ['--book', 'missing'], 'test-tool'),
    /alpha \| beta/,
  );
});

test('#80: shared YAML frontmatter parsing honors quotes/comments and source lines', () => {
  const parsed = parseFrontmatter(
    '---\ntitle: Example\nslug: "clean # canonical" # comment\nbook: alpha # owner\n---\nBody\n',
  );
  assert.equal(parsed.frontmatter.slug, 'clean # canonical');
  assert.equal(parsed.frontmatter.book, 'alpha');
  assert.equal(parsed.lines.slug, 3);
  assert.deepEqual(
    legacyFrontmatterBook('---\ntitle: Example\nbook: alpha # owner\n---\n'),
    { value: 'alpha', line: 3 },
  );
  assert.equal(parsed.body, 'Body\n');
});

test('#80: evaluated tooling config carries corpus metadata in manifest order', async () => {
  const root = mkdtempSync(join(tmpdir(), 'book-corpus-config-'));
  try {
    setupCorpus(root);
    const config = await loadResolvedBookConfig(root);
    assert.equal(config.corpus.__bookCorpusVersion, 1);
    assert.equal(config.corpus.preset, 'minimal');
    assert.deepEqual(config.corpus.books.map((book) => book.id), ['alpha', 'beta']);
    assert.deepEqual(config.apparatusRoutes, ['references']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('#80: selected artifact merge initializes all keys and preserves unselected payloads', async () => {
  const root = mkdtempSync(join(tmpdir(), 'book-corpus-envelope-'));
  const path = join(root, 'artifact.json');
  try {
    const initial = await mergeCorpusArtifact({
      path,
      corpus: CORPUS,
      requestedBook: 'alpha',
      values: new Map([['alpha', ['fresh']]]),
      emptyValue: () => [],
      artifact: 'artifact.json',
      validateValue: Array.isArray,
    });
    assert.deepEqual(initial, {
      schemaVersion: 1,
      books: { alpha: ['fresh'], beta: [] },
    });

    writeFileSync(path, JSON.stringify({ schemaVersion: 1, books: {
      alpha: ['old'],
      beta: ['keep'],
    } }));
    const merged = await mergeCorpusArtifact({
      path,
      corpus: CORPUS,
      requestedBook: 'alpha',
      values: new Map([['alpha', ['new']]]),
      emptyValue: () => [],
      artifact: 'artifact.json',
      validateValue: Array.isArray,
    });
    assert.deepEqual(merged.books, { alpha: ['new'], beta: ['keep'] });

    writeFileSync(path, '{}');
    await assert.rejects(
      mergeCorpusArtifact({
        path,
        corpus: CORPUS,
        requestedBook: 'alpha',
        values: new Map([['alpha', []]]),
        emptyValue: () => [],
        artifact: 'artifact.json',
        validateValue: Array.isArray,
      }),
      /not a corpus artifact envelope/,
    );

    writeFileSync(path, JSON.stringify({
      schemaVersion: 1,
      books: { alpha: [], beta: [] },
      extra: true,
    }));
    await assert.rejects(
      mergeCorpusArtifact({
        path,
        corpus: CORPUS,
        requestedBook: 'alpha',
        values: new Map([['alpha', []]]),
        emptyValue: () => [],
        artifact: 'artifact.json',
        validateValue: Array.isArray,
      }),
      /unknown top-level field: extra/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('#80: producer --book fails in single-book mode without mutating artifacts', () => {
  const root = mkdtempSync(join(tmpdir(), 'book-single-selector-'));
  try {
    mkdirSync(join(root, 'src/content/chapters'), { recursive: true });
    const result = run(root, 'build-tips.mjs', ['--book', 'alpha']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /--book is available only.*corpus/s);
    assert.throws(() => readFileSync(join(root, 'src/data/tips.json')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('#80: corpus producers namespace duplicate local ids and share root bibliography inputs', () => {
  const root = mkdtempSync(join(tmpdir(), 'book-corpus-producers-'));
  try {
    setupCorpus(root);
    for (const script of [
      'build-labels.mjs',
      'build-tips.mjs',
      'build-exercises.mjs',
      'build-bib.mjs',
    ]) {
      const result = run(root, script);
      assert.equal(result.status, 0, `${script}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
      assert.match(result.stdout, /\[book:alpha\]/);
      assert.match(result.stdout, /\[book:beta\]/);
      assert.match(result.stdout, /\[book:corpus\]/);
    }

    const labels = json(root, 'labels.json');
    assert.deepEqual(Object.keys(labels.books), ['alpha', 'beta']);
    assert.equal(labels.schemaVersion, 1);
    assert.equal(labels.books.alpha.shared.href, 'chapters/alpha/same#shared');
    assert.equal(labels.books.beta.shared.href, 'chapters/beta/nested/explicit#shared');

    const duplicatePath = join(root, 'src/content/alpha/duplicate.mdx');
    writeFileSync(
      duplicatePath,
      '---\ntitle: Duplicate\nchapter: 2\n---\n<Theorem id="shared" kind="theorem" />\n',
    );
    const duplicate = run(root, 'build-labels.mjs', ['--book', 'alpha']);
    assert.notEqual(duplicate.status, 0);
    assert.match(duplicate.stderr, /^\[book:alpha\]/);
    assert.match(duplicate.stderr, /\[book:alpha\].*duplicate label id "shared"/s);
    rmSync(duplicatePath);

    const tips = json(root, 'tips.json');
    assert.equal(tips.books.alpha[0].chapter, 'same');
    assert.equal(tips.books.beta[0].chapter, 'nested/explicit');
    const exercises = json(root, 'exercises.json');
    assert.equal(exercises.books.alpha.same[0].id, 'shared-exercise');
    assert.equal(exercises.books.beta['nested/explicit'][0].id, 'shared-exercise');

    const references = json(root, 'references.json');
    assert.deepEqual(references.books.alpha.shared, references.books.beta.shared);
    const sources = json(root, 'sources.json');
    assert.deepEqual(sources.books.alpha, sources.books.beta);
    const sharedSources = structuredClone(sources.books.beta);

    rmSync(join(root, 'sources/manifest.yaml'));
    const selectedSources = run(root, 'build-bib.mjs', ['--book', 'alpha']);
    assert.equal(selectedSources.status, 0, selectedSources.stderr);
    const sourcesAfterSelected = json(root, 'sources.json');
    assert.deepEqual(sourcesAfterSelected.books.alpha, []);
    assert.deepEqual(sourcesAfterSelected.books.beta, sharedSources);

    const fullSources = run(root, 'build-bib.mjs');
    assert.equal(fullSources.status, 0, fullSources.stderr);
    assert.deepEqual(json(root, 'sources.json').books, { alpha: [], beta: [] });

    tips.books.beta = [{ n: 99, title: 'preserved', chapter: 'keep', preview: '' }];
    writeFileSync(join(root, 'src/data/tips.json'), JSON.stringify(tips));
    writeChapter(root, 'alpha', '<Tip n="2" title="Selected">Selected update.</Tip>');
    const selected = run(root, 'build-tips.mjs', ['--book', 'alpha']);
    assert.equal(selected.status, 0, selected.stderr);
    const updated = json(root, 'tips.json');
    assert.equal(updated.books.alpha.length, 2);
    assert.deepEqual(updated.books.beta, tips.books.beta);

    writeChapter(root, 'alpha', '', 'beta');
    for (const script of ['build-labels.mjs', 'build-tips.mjs', 'build-exercises.mjs']) {
      const mismatch = run(root, script, ['--book', 'alpha']);
      assert.notEqual(mismatch.status, 0);
      assert.match(mismatch.stderr, /^\[book:alpha\]/);
      assert.match(mismatch.stderr, /does not match.*"alpha"/s);
    }

    writeFileSync(
      join(root, 'bibliography.bib'),
      '@book{duplicate, title={One}}\n@book{duplicate, title={Two}}\n',
    );
    const duplicateBib = run(root, 'build-bib.mjs', ['--book', 'alpha']);
    assert.notEqual(duplicateBib.status, 0);
    assert.match(duplicateBib.stderr, /^\[book:corpus\]/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('#80: validate resolves local BookLink targets in the target book namespace', () => {
  const root = mkdtempSync(join(tmpdir(), 'book-corpus-validate-'));
  try {
    setupCorpus(root);
    for (const script of ['build-labels.mjs', 'build-bib.mjs']) {
      const built = run(root, script);
      assert.equal(built.status, 0, built.stderr);
    }
    mkdirSync(join(root, 'src/content/questions/alpha'), { recursive: true });
    mkdirSync(join(root, 'src/content/questions/beta'), { recursive: true });
    const question = (title) =>
      `---\nid: " shared-question " # local id\ntype: free\n` +
      `domain: " shared " # registry id\nchapter: 1\ntitle: ${title}\n---\nQuestion.\n`;
    writeFileSync(join(root, 'src/content/questions/alpha/one.mdx'), question('Alpha'));
    // Deliberately invalid only in the unselected namespace: selected alpha
    // validation must neither scan nor collide with beta's local ids.
    writeFileSync(join(root, 'src/content/questions/beta/one.mdx'), question('Beta one'));
    writeFileSync(join(root, 'src/content/questions/beta/two.mdx'), question('Beta two'));

    writeChapter(
      root,
      'alpha',
      '<BookLink book="beta" to="chapters/nested/explicit/#shared">Beta theorem</BookLink>\n\n' +
        '<BookLink book="beta" to="about/team">Beta team</BookLink>\n\n' +
        '<BookLink book="beta" to="glossary/term#definition">Beta term</BookLink>\n\n' +
        '[Beta references](/beta/references/)\n\n' +
        '[Flat references](/references/)',
    );
    assert.equal(resolveCorpusBookHref('beta', 'about/team'), '/beta/about/team/');
    assert.equal(
      resolveCorpusBookHref('beta', 'glossary/term#definition'),
      '/beta/glossary/term/#definition',
    );
    rmSync(join(root, 'src/data/labels.json'));
    rmSync(join(root, 'src/data/references.json'));
    const valid = run(root, 'validate.mjs', ['--book', 'alpha']);
    assert.equal(valid.status, 0, `stdout: ${valid.stdout}\nstderr: ${valid.stderr}`);
    assert.match(valid.stdout, /\[book:alpha\].*1 chapter\(s\) \+ 1 question\(s\) checked/);
    assert.match(valid.stdout, /\[book:corpus\]/);
    assert.equal(
      json(root, 'labels.json').books.beta.shared.href,
      'chapters/beta/nested/explicit#shared',
    );
    assert.doesNotMatch(valid.stderr, /beta\/references.*may not resolve/);
    assert.match(valid.stderr, /\[book:alpha\].*\/references\/.*may not resolve/s);
    assert.match(valid.stderr, /non-chapter fragment validation skipped/);

    writeChapter(
      root,
      'alpha',
      '<BookLink book="beta" to="chapters/missing/#shared">Missing chapter</BookLink>',
    );
    const missing = run(root, 'validate.mjs', ['--book', 'alpha']);
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /\[book:alpha\].*unknown local corpus target/s);

    writeChapter(
      root,
      'alpha',
      '<BookLink book="beta" to="chapters/nested/explicit/#missing">Missing fragment</BookLink>',
    );
    const fragment = run(root, 'validate.mjs', ['--book', 'alpha']);
    assert.notEqual(fragment.status, 0);
    assert.match(fragment.stderr, /\[book:alpha\].*does not resolve.*"beta"/s);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('#80: selected self-heal ignores invalid unreferenced book labels', () => {
  const root = mkdtempSync(join(tmpdir(), 'book-corpus-selected-isolation-'));
  try {
    setupCorpus(root);
    writeFileSync(
      join(root, 'src/content/beta/duplicate.mdx'),
      '---\ntitle: Duplicate\nchapter: 2\n---\n' +
        '<Theorem id="shared" kind="theorem" />\n',
    );

    // No artifacts exist. Alpha has no route/link dependency on beta, so a
    // clean-checkout selected run must not scan beta's duplicate label.
    const result = run(root, 'validate.mjs', ['--book', 'alpha']);
    assert.equal(result.status, 0, `stdout: ${result.stdout}\nstderr: ${result.stderr}`);
    assert.deepEqual(json(root, 'labels.json').books.beta, {});
    assert.match(result.stdout, /\[book:alpha\].*no errors/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('#80: selected self-heal materializes cached empty namespaces on demand', () => {
  const root = mkdtempSync(join(tmpdir(), 'book-corpus-selected-cache-'));
  try {
    setupCorpus(root);

    const alphaFirst = run(root, 'validate.mjs', ['--book', 'alpha']);
    assert.equal(alphaFirst.status, 0, alphaFirst.stderr);
    assert.deepEqual(json(root, 'labels.json').books.beta, {});
    assert.deepEqual(json(root, 'references.json').books.beta, {});

    const fullAfterSelected = run(root, 'validate.mjs');
    assert.equal(fullAfterSelected.status, 0, fullAfterSelected.stderr);
    assert.equal(
      json(root, 'labels.json').books.beta.shared.href,
      'chapters/beta/nested/explicit#shared',
    );
    assert.ok(json(root, 'references.json').books.beta.shared);

    // Recreate a cached target placeholder to exercise selected dependency
    // materialization independently of the full-run repair above.
    const cachedLabels = json(root, 'labels.json');
    cachedLabels.books.beta = {};
    writeFileSync(join(root, 'src/data/labels.json'), JSON.stringify(cachedLabels));

    writeChapter(
      root,
      'alpha',
      '<BookLink book="beta" to="chapters/nested/explicit/#shared">Beta theorem</BookLink>',
    );
    const alphaWithDependency = run(root, 'validate.mjs', ['--book', 'alpha']);
    assert.equal(
      alphaWithDependency.status,
      0,
      `stdout: ${alphaWithDependency.stdout}\nstderr: ${alphaWithDependency.stderr}`,
    );
    assert.equal(
      json(root, 'labels.json').books.beta.shared.href,
      'chapters/beta/nested/explicit#shared',
    );

    // Simulate the inverse selected-run history for the requested namespace:
    // an earlier beta-only artifact has alpha placeholders.
    const labels = json(root, 'labels.json');
    const references = json(root, 'references.json');
    labels.books.alpha = {};
    references.books.alpha = {};
    writeFileSync(join(root, 'src/data/labels.json'), JSON.stringify(labels));
    writeFileSync(join(root, 'src/data/references.json'), JSON.stringify(references));
    writeChapter(root, 'alpha');

    const alphaAfterBeta = run(root, 'validate.mjs', ['--book', 'alpha']);
    assert.equal(alphaAfterBeta.status, 0, alphaAfterBeta.stderr);
    assert.equal(json(root, 'labels.json').books.alpha.shared.href, 'chapters/alpha/same#shared');
    assert.ok(json(root, 'references.json').books.alpha.shared);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('#80: validate reports invalid YAML as scoped diagnostics without a stack', () => {
  const root = mkdtempSync(join(tmpdir(), 'book-corpus-yaml-diagnostic-'));
  try {
    setupCorpus(root);
    for (const script of ['build-labels.mjs', 'build-bib.mjs']) {
      const built = run(root, script);
      assert.equal(built.status, 0, built.stderr);
    }
    writeFileSync(
      join(root, 'src/content/alpha/same.mdx'),
      '---\ntitle: [unterminated\nchapter: 1\n---\nBody.\n',
    );
    mkdirSync(join(root, 'src/content/questions/alpha'), { recursive: true });
    writeFileSync(
      join(root, 'src/content/questions/alpha/bad.mdx'),
      '---\nid: [unterminated\ntype: free\n---\nQuestion.\n',
    );

    const result = run(root, 'validate.mjs', ['--book', 'alpha']);
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /\[book:alpha\] alpha\/same\.mdx:\d+\s+invalid YAML frontmatter:/,
    );
    assert.match(
      result.stderr,
      /\[book:alpha\] questions\/alpha\/bad\.mdx:\d+\s+invalid YAML frontmatter:/,
    );
    assert.doesNotMatch(result.stderr, /file:\/\/|\n\s+at /);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('#80: validate never self-heals by overwriting an invalid strict envelope', () => {
  const root = mkdtempSync(join(tmpdir(), 'book-corpus-strict-validate-'));
  try {
    setupCorpus(root);
    for (const script of ['build-labels.mjs', 'build-bib.mjs']) {
      const built = run(root, script);
      assert.equal(built.status, 0, built.stderr);
    }
    const invalid = {
      schemaVersion: 1,
      books: { alpha: {}, beta: {} },
      checksum: 'forged',
    };
    writeFileSync(join(root, 'src/data/labels.json'), JSON.stringify(invalid));

    const result = run(root, 'validate.mjs');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /^\[book:corpus\] validate: fatal:/);
    assert.match(result.stderr, /unknown top-level field: checksum/);
    assert.deepEqual(json(root, 'labels.json'), invalid);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('#80: every corpus command prefixes selector failures in the shared namespace', () => {
  const root = mkdtempSync(join(tmpdir(), 'book-corpus-diagnostics-'));
  try {
    setupCorpus(root);
    for (const script of [
      'build-labels.mjs',
      'build-bib.mjs',
      'build-tips.mjs',
      'build-exercises.mjs',
      'validate.mjs',
    ]) {
      const result = run(root, script, ['--book', 'missing']);
      assert.notEqual(result.status, 0, script);
      assert.match(result.stderr, /^\[book:corpus\]/, `${script}: ${result.stderr}`);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('#80: selected validate rejects collection content outside manifest namespaces', () => {
  const root = mkdtempSync(join(tmpdir(), 'book-corpus-content-owner-'));
  try {
    setupCorpus(root);
    for (const script of ['build-labels.mjs', 'build-bib.mjs']) {
      const built = run(root, script);
      assert.equal(built.status, 0, built.stderr);
    }
    mkdirSync(join(root, 'src/content/questions'), { recursive: true });
    mkdirSync(join(root, 'src/content/glossary/unknown'), { recursive: true });
    writeFileSync(
      join(root, 'src/content/questions/orphan.mdx'),
      '---\nid: orphan\ntype: free\ndomain: shared\nchapter: 1\ntitle: Orphan\n---\n',
    );
    writeFileSync(
      join(root, 'src/content/glossary/unknown/orphan.mdx'),
      '---\nterm: Orphan\n---\n',
    );
    const result = run(root, 'validate.mjs', ['--book', 'alpha']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /\[book:corpus\] questions\/orphan\.mdx:1/);
    assert.match(result.stderr, /\[book:corpus\] glossary\/unknown\/orphan\.mdx:1/);
    assert.match(result.stderr, /registered corpus book id/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
