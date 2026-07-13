import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SCRIPT = (name) => join(PACKAGE_ROOT, 'scripts', name);

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'book-scaffold-errors-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function write(root, rel, content) {
  const path = join(root, rel);
  mkdirSync(resolve(path, '..'), { recursive: true });
  writeFileSync(path, content);
  return path;
}

function run(script, cwd, extraEnv = {}, args = []) {
  const env = { ...process.env, ...extraEnv };
  for (const key of [
    'BOOK_BIB_PATH',
    'BOOK_CHAPTERS_DIR',
    'BOOK_LABELS_OUT',
    'BOOK_NOTEBOOKS_PATH',
    'BOOK_FIGURES_PATH',
    'BOOK_PRESET',
    'BOOK_PROFILE',
  ]) {
    if (!(key in extraEnv)) delete env[key];
  }
  return spawnSync(process.execPath, [script, ...args], {
    cwd,
    env,
    encoding: 'utf8',
  });
}

function assertFailure(result, pattern) {
  assert.notEqual(result.status, 0, `expected failure; stdout=${result.stdout}`);
  assert.match(result.stderr, pattern, `stderr must be actionable; got ${result.stderr}`);
}

test('CLI dispatcher rejects an unknown sub-command with exit 2', () => {
  const result = run(join(PACKAGE_ROOT, 'bin/book-scaffold.mjs'), PACKAGE_ROOT, {}, ['unknown-task']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /unknown sub-command 'unknown-task'/);
});

for (const command of ['qa', 'init-qa']) {
  test(`CLI dispatcher routes ${command} help without project reads`, () => {
    const result = run(
      join(PACKAGE_ROOT, 'bin/book-scaffold.mjs'),
      PACKAGE_ROOT,
      {},
      [command, '--help'],
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, new RegExp(`^Usage: book-scaffold ${command}\\b`));
    assert.equal(result.stderr, '');
  });
}

test('build-bib reports output write failures and exits non-zero', (t) => {
  const root = fixture(t);
  write(root, 'src/data', 'not a directory');
  const result = run(SCRIPT('build-bib.mjs'), root);
  assertFailure(result, /build-bib: failed[\s\S]*(EEXIST|ENOTDIR)/);
});

test('build-labels reports invalid theorem metadata and exits non-zero', (t) => {
  const root = fixture(t);
  write(root, 'src/content/chapters/01.mdx', `---\nchapter: 1\n---\n<Theorem id="broken" />\n`);
  const result = run(SCRIPT('build-labels.mjs'), root);
  assertFailure(result, /build-labels: fatal:[\s\S]*no kind=/);
});

for (const [name, prefix] of [
  ['build-tips.mjs', 'build-tips'],
  ['build-exercises.mjs', 'build-exercises'],
]) {
  test(`${prefix} reports output write failures and exits non-zero`, (t) => {
    const root = fixture(t);
    write(root, 'src/data', 'not a directory');
    const result = run(SCRIPT(name), root);
    assertFailure(result, new RegExp(`${prefix}: failed[\\s\\S]*(EEXIST|ENOTDIR)`));
  });
}

test('build-figures surfaces converter failures and exits non-zero', (t) => {
  const root = fixture(t);
  write(root, 'figures/example.pdf', '%PDF-not-a-real-pdf');
  const bin = join(root, 'fake-bin');
  mkdirSync(bin);
  for (const command of ['pdftocairo', 'pdftoppm']) {
    const path = write(root, `fake-bin/${command}`, '#!/bin/sh\necho converter exploded >&2\nexit 17\n');
    chmodSync(path, 0o755);
  }
  const result = run(SCRIPT('build-figures.mjs'), root, {
    PATH: `${bin}:${process.env.PATH}`,
  });
  assertFailure(result, /build-figures: failed[\s\S]*pdftocairo failed[\s\S]*converter exploded/);
});

test('render-notebooks surfaces nbconvert failures and exits non-zero', (t) => {
  const root = fixture(t);
  write(root, 'notebooks/example.ipynb', JSON.stringify({ cells: [] }).padEnd(1800, ' '));
  const bin = join(root, 'fake-bin');
  mkdirSync(bin);
  const uv = write(root, 'fake-bin/uv', '#!/bin/sh\necho nbconvert exploded >&2\nexit 19\n');
  chmodSync(uv, 0o755);
  const result = run(SCRIPT('render-notebooks.mjs'), root, {
    PATH: `${bin}:${process.env.PATH}`,
  });
  assertFailure(result, /render-notebooks: failed[\s\S]*nbconvert failed[\s\S]*nbconvert exploded/);
});

test('validate reports content failures and exits non-zero', (t) => {
  const root = fixture(t);
  write(root, 'src/content/chapters/01.mdx', `---\ntitle: Bad ref\n---\n<XRef id="missing" />\n`);
  write(root, 'src/data/labels.json', '{}\n');
  write(root, 'src/data/references.json', '{}\n');
  const result = run(SCRIPT('validate.mjs'), root, { BOOK_PRESET: 'minimal' });
  assertFailure(result, /validate: .*error[\s\S]*missing/);
});
