import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runValidation } from '../scripts/validate-core.mjs';

const VALIDATE_SCRIPT = fileURLToPath(new URL('../scripts/validate.mjs', import.meta.url));

function writeChapter(root, relative, body = 'A clean paragraph.') {
  const path = join(root, 'src/content', relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    `---\ntitle: Validation fixture\n---\n\n${body}\n`,
  );
}

function setupSingle(root, { artifacts = true, body } = {}) {
  writeChapter(root, 'chapters/one.mdx', body);
  mkdirSync(join(root, 'src/data'), { recursive: true });
  writeFileSync(
    join(root, 'src/content.config.ts'),
    `defineBookSchemas({ preset: 'minimal' });\n`,
  );
  if (artifacts) {
    writeFileSync(join(root, 'src/data/labels.json'), '{}\n');
    writeFileSync(join(root, 'src/data/references.json'), '{}\n');
  }
}

function setupCorpus(root) {
  writeChapter(root, 'alpha/one.mdx');
  writeChapter(root, 'beta/one.mdx', '<XRef id="missing" />');
  mkdirSync(join(root, 'src/data'), { recursive: true });
  const corpus = {
    __bookCorpusVersion: 1,
    preset: 'minimal',
    books: [
      { id: 'alpha', title: 'Alpha' },
      { id: 'beta', title: 'Beta' },
    ],
  };
  const metadata = {
    preset: 'minimal',
    numberStyle: 'shared',
    siblingBooks: {},
    corpus,
    chapterRoute: '/chapters/:id/',
    bookField: 'book',
    apparatusRoute: '/:book/:route/',
    apparatusRoutes: [],
  };
  writeFileSync(
    join(root, 'astro.config.mjs'),
    `export default { integrations: [{ name: 'book-scaffold-astro', ` +
      `__bookScaffoldResolvedConfig: ${JSON.stringify(metadata)} }] };\n`,
  );
  const labels = {
    schemaVersion: 1,
    books: {
      alpha: { fixture: { href: 'chapters/alpha/one#fixture' } },
      beta: { fixture: { href: 'chapters/beta/one#fixture' } },
    },
  };
  const references = {
    schemaVersion: 1,
    books: { alpha: { fixture: {} }, beta: { fixture: {} } },
  };
  writeFileSync(join(root, 'src/data/labels.json'), `${JSON.stringify(labels)}\n`);
  writeFileSync(join(root, 'src/data/references.json'), `${JSON.stringify(references)}\n`);
}

test('validate core returns structured single-book results without process-global mutation', async () => {
  const root = mkdtempSync(join(tmpdir(), 'validate-core-single-'));
  const originalArgv = [...process.argv];
  const originalCwd = process.cwd();
  try {
    setupSingle(root, { body: '<XRef id="missing" />' });
    const observed = [];
    const result = await runValidation({
      root,
      argv: ['--preset', 'minimal'],
      env: {},
      onOutput: (event) => observed.push(event),
    });

    assert.equal(result.status, 'invalid');
    assert.equal(result.exitCode, 1);
    assert.equal(result.fatal, null);
    assert.deepEqual(result.scope, { kind: 'single', requestedBook: null, selected: [] });
    assert.equal(result.counts.chapters, 1);
    assert.equal(result.toolingConfig.numberStyle, 'shared');
    assert.equal(result.toolingConfig.corpus, null);
    assert.equal(result.bookResults.length, 1);
    assert.equal(result.bookResults[0].errors.length, 1);
    assert.equal(result.diagnostics[0].severity, 'error');
    assert.match(result.diagnostics[0].message, /Unknown XRef id "missing"/);
    assert.equal(observed.map((event) => event.text).join(''), result.output.stderr);
    assert.deepEqual(process.argv, originalArgv);
    assert.equal(process.cwd(), originalCwd);

    const cli = spawnSync(process.execPath, [VALIDATE_SCRIPT, '--preset', 'minimal'], {
      cwd: root,
      env: {},
      encoding: 'utf8',
    });
    assert.equal(cli.status, result.exitCode);
    assert.equal(cli.stdout, result.output.stdout);
    assert.equal(cli.stderr, result.output.stderr);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validate core injects artifact regeneration and never spawns on its own', async () => {
  const root = mkdtempSync(join(tmpdir(), 'validate-core-regenerate-'));
  try {
    setupSingle(root, { artifacts: false });
    const requests = [];
    const result = await runValidation({
      root,
      argv: [],
      env: {},
      regenerateArtifact: ({ scriptName, artifact }) => {
        requests.push({ scriptName, artifact });
        const name = artifact.split('/').pop();
        writeFileSync(join(root, 'src/data', name), '{}\n');
        return { status: 0, stdout: `${scriptName}: generated\n`, stderr: '' };
      },
    });

    assert.equal(result.status, 'valid');
    assert.equal(result.exitCode, 0);
    assert.deepEqual(requests, [
      { scriptName: 'build-labels.mjs', artifact: 'src/data/labels.json' },
      { scriptName: 'build-bib.mjs', artifact: 'src/data/references.json' },
    ]);
    assert.match(result.output.stdout, /build-labels\.mjs: generated/);
    assert.match(result.output.stdout, /build-bib\.mjs: generated/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validate core reports a distinguishable artifact fatal without a callback', async () => {
  const root = mkdtempSync(join(tmpdir(), 'validate-core-artifact-fatal-'));
  try {
    setupSingle(root, { artifacts: false });
    const result = await runValidation({ root, argv: [], env: {} });
    assert.equal(result.status, 'fatal');
    assert.equal(result.exitCode, 1);
    assert.equal(result.fatal.kind, 'artifact');
    assert.match(result.fatal.message, /labels\.json requires regeneration/);
    assert.deepEqual(result.errors, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validate core distinguishes invocation and unresolved-config fatals', async () => {
  const root = mkdtempSync(join(tmpdir(), 'validate-core-config-fatal-'));
  try {
    writeChapter(root, 'chapters/one.mdx');
    mkdirSync(join(root, 'src/data'), { recursive: true });
    writeFileSync(join(root, 'src/data/labels.json'), '{}\n');
    writeFileSync(join(root, 'src/data/references.json'), '{}\n');

    const config = await runValidation({ root, argv: [], env: {} });
    assert.equal(config.status, 'fatal');
    assert.equal(config.fatal.kind, 'config');
    assert.match(config.fatal.message, /no book preset was resolved/);

    const invocation = await runValidation({ root, argv: ['--preset'], env: {} });
    assert.equal(invocation.status, 'fatal');
    assert.equal(invocation.fatal.kind, 'invocation');
    assert.equal(invocation.exitCode, 2);
    assert.match(invocation.fatal.message, /requires a value/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validate core honors corpus --book selection and partitions diagnostics', async () => {
  const root = mkdtempSync(join(tmpdir(), 'validate-core-corpus-'));
  try {
    setupCorpus(root);
    const alpha = await runValidation({ root, argv: ['--book', 'alpha'], env: {} });
    assert.equal(alpha.status, 'valid');
    assert.deepEqual(alpha.scope, {
      kind: 'corpus',
      requestedBook: 'alpha',
      selected: ['alpha'],
    });
    assert.deepEqual(alpha.bookResults.map((book) => book.book), ['alpha']);
    assert.equal(alpha.bookResults[0].chapters, 1);
    assert.equal(alpha.errors.length, 0);

    const beta = await runValidation({ root, argv: ['--book', 'beta'], env: {} });
    assert.equal(beta.status, 'invalid');
    assert.deepEqual(beta.bookResults.map((book) => book.book), ['beta']);
    assert.equal(beta.errors.length, 1);
    assert.equal(beta.errors[0].book, 'beta');
    assert.match(beta.errors[0].msg, /Unknown XRef id "missing"/);

    const unknown = await runValidation({ root, argv: ['--book', 'missing'], env: {} });
    assert.equal(unknown.status, 'fatal');
    assert.equal(unknown.fatal.kind, 'invocation');
    assert.equal(unknown.exitCode, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
