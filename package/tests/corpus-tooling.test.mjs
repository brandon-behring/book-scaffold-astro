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
  mergeCorpusArtifact,
  resolveBookSelection,
} from '../scripts/corpus-tooling.mjs';
import { loadResolvedBookConfig } from '../scripts/resolve-book-config.mjs';

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
  writeChapter(root, 'alpha');
  writeChapter(root, 'beta', '', null, 'nested/explicit');
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
    `---\ntitle: ${book}\nchapter: 1\n${slug ? `slug: ${slug}\n` : ''}` +
      `${legacyBook ? `book: ${legacyBook}\n` : ''}---\n\n` +
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

    tips.books.beta = [{ n: 99, title: 'preserved', chapter: 'keep', preview: '' }];
    writeFileSync(join(root, 'src/data/tips.json'), JSON.stringify(tips));
    writeChapter(root, 'alpha', '<Tip n="2" title="Selected">Selected update.</Tip>');
    const selected = run(root, 'build-tips.mjs', ['--book', 'alpha']);
    assert.equal(selected.status, 0, selected.stderr);
    const updated = json(root, 'tips.json');
    assert.equal(updated.books.alpha.length, 2);
    assert.deepEqual(updated.books.beta, tips.books.beta);

    writeChapter(root, 'alpha', '', 'beta');
    const mismatch = run(root, 'build-exercises.mjs', ['--book', 'alpha']);
    assert.notEqual(mismatch.status, 0);
    assert.match(mismatch.stderr, /\[book:alpha\].*does not match.*"alpha"/s);
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
      `---\nid: shared-question\ntype: free\ndomain: shared\nchapter: 1\ntitle: ${title}\n---\nQuestion.\n`;
    writeFileSync(join(root, 'src/content/questions/alpha/one.mdx'), question('Alpha'));
    // Deliberately invalid only in the unselected namespace: selected alpha
    // validation must neither scan nor collide with beta's local ids.
    writeFileSync(join(root, 'src/content/questions/beta/one.mdx'), question('Beta one'));
    writeFileSync(join(root, 'src/content/questions/beta/two.mdx'), question('Beta two'));

    writeChapter(
      root,
      'alpha',
      '<BookLink book="beta" to="chapters/nested/explicit/#shared">Beta theorem</BookLink>\n\n' +
        '[Beta references](/beta/references/)',
    );
    const valid = run(root, 'validate.mjs', ['--book', 'alpha']);
    assert.equal(valid.status, 0, `stdout: ${valid.stdout}\nstderr: ${valid.stderr}`);
    assert.match(valid.stdout, /\[book:alpha\].*1 chapter\(s\) \+ 1 question\(s\) checked/);
    assert.match(valid.stdout, /\[book:corpus\]/);
    assert.doesNotMatch(valid.stderr, /beta\/references.*may not resolve/);

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
