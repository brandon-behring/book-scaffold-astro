/**
 * Distribution contracts for D12 and the dual-license split.
 *
 * Run npm's own pack enumerator so the test guards what registry consumers
 * receive, rather than merely checking that source-tree files exist.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..', '..');

function dryRunPackFiles(directory) {
  const result = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd: directory,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `npm pack failed in ${directory}:\n${result.stderr}`);
  const parsed = JSON.parse(result.stdout);
  const entry = Array.isArray(parsed) ? parsed[0] : Object.values(parsed)[0];
  assert.ok(entry, `npm pack returned no package record in ${directory}`);
  return new Set(entry.files.map((file) => file.path));
}

test('toolkit tarball ships both agent-guide names and both scoped licenses', () => {
  const files = dryRunPackFiles(join(root, 'package'));
  for (const path of [
    'README.md',
    'CLAUDE.md',
    'AGENTS.md',
    'LICENSE',
    'LICENSE-CONTENT',
    'dist/demo.mjs',
    'dist/demo.d.ts',
    'styles/demo.css',
    'recipes/22-interactive-demo-substrate.md',
  ]) {
    assert.ok(files.has(path), `toolkit tarball must contain ${path}`);
  }
});

test('create-book tarball ships its documentation and both scoped licenses', () => {
  const files = dryRunPackFiles(join(root, 'create-book'));
  for (const path of ['README.md', 'LICENSE', 'LICENSE-CONTENT', 'bin/create-book.mjs']) {
    assert.ok(files.has(path), `create-book tarball must contain ${path}`);
  }
});

test('repository and toolkit AGENTS.md pointers resolve to maintained CLAUDE.md files', () => {
  for (const directory of [root, join(root, 'package')]) {
    const pointer = readFileSync(join(directory, 'AGENTS.md'), 'utf8');
    assert.match(pointer, /\[?`?CLAUDE\.md`?\]?\(CLAUDE\.md\)/);
    assert.ok(existsSync(join(directory, 'CLAUDE.md')), `${directory} is missing CLAUDE.md`);
  }
});
