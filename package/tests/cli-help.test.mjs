/**
 * tests/cli-help.test.mjs — node:test suite asserting `--help` is non-mutating.
 *
 * v3.4.0 closes issue #14: each subcommand script (validate, build-labels,
 * build-bib, build-figures, render-notebooks) prints usage + exits 0 when
 * called with --help, WITHOUT performing any FS reads/writes beyond loading
 * the script.
 *
 * Each test spawns the script in a temp dir + asserts (a) exit code 0,
 * (b) stdout starts with "Usage:", (c) no files created in the temp dir
 * (the script's natural FS targets, like src/data/labels.json, would land
 * here if --help didn't short-circuit).
 *
 * Run: node --test tests/cli-help.test.mjs
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = resolve(__dirname, '..', 'scripts');

const SUBCOMMANDS = [
  'validate.mjs',
  'qa.mjs',
  'init-qa.mjs',
  'build-labels.mjs',
  'build-bib.mjs',
  'build-figures.mjs',
  'render-notebooks.mjs',
];

for (const script of SUBCOMMANDS) {
  test(`cli-help: ${script} --help is non-mutating + exits 0`, () => {
    const tmp = mkdtempSync(join(tmpdir(), 'book-scaffold-help-'));
    try {
      const scriptPath = join(SCRIPTS_DIR, script);
      const result = spawnSync('node', [scriptPath, '--help'], {
        cwd: tmp,
        encoding: 'utf8',
        timeout: 5000,
      });

      assert.equal(result.status, 0, `${script} --help should exit 0, got ${result.status}\nstderr: ${result.stderr}`);
      assert.match(result.stdout, /^Usage: /, `${script} --help should print "Usage:" prefix`);

      // The tmp dir should still be empty — no scripts/data/json files created.
      const entries = readdirSync(tmp);
      assert.deepEqual(entries, [], `${script} --help mutated the temp dir: ${entries.join(', ')}`);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test(`cli-help: ${script} -h is non-mutating + exits 0`, () => {
    const tmp = mkdtempSync(join(tmpdir(), 'book-scaffold-help-'));
    try {
      const scriptPath = join(SCRIPTS_DIR, script);
      const result = spawnSync('node', [scriptPath, '-h'], {
        cwd: tmp,
        encoding: 'utf8',
        timeout: 5000,
      });
      assert.equal(result.status, 0, `${script} -h should exit 0`);
      assert.match(result.stdout, /^Usage: /, `${script} -h should print "Usage:" prefix`);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
}
