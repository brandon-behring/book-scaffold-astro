import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const createBookRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(createBookRoot, '..');
const createBookBin = join(createBookRoot, 'bin/create-book.mjs');
const qaBin = join(repoRoot, 'package/bin/book-scaffold.mjs');
const rootNodeModules = join(repoRoot, 'node_modules');
const presets = ['academic', 'tools', 'minimal', 'course-notes', 'research-portfolio'];

test('#158: every generated preset runs scaffold QA green without a bespoke script', () => {
  const root = mkdtempSync(join(tmpdir(), 'create-book-qa-'));
  try {
    for (const preset of presets) {
      const name = `qa-${preset}`;
      const generated = spawnSync(
        process.execPath,
        [createBookBin, name, `--preset=${preset}`],
        { cwd: root, encoding: 'utf8' },
      );
      assert.equal(generated.status, 0, `${preset} generation failed: ${generated.stderr}`);

      const bookRoot = join(root, name);
      symlinkSync(rootNodeModules, join(bookRoot, 'node_modules'), 'dir');
      const qa = spawnSync(
        process.execPath,
        [qaBin, 'qa', '--format', 'json'],
        {
          cwd: bookRoot,
          encoding: 'utf8',
          env: { ...process.env, NO_COLOR: '1' },
          maxBuffer: 8 * 1024 * 1024,
        },
      );
      assert.equal(qa.status, 0, `${preset} QA failed:\n${qa.stderr}\n${qa.stdout}`);
      const result = JSON.parse(qa.stdout);
      assert.equal(result.schemaVersion, 1);
      assert.equal(result.preset, preset);
      assert.equal(result.verdict, 'green');
      assert.deepEqual(result.scope, { kind: 'single', selected: ['book'] });
      assert.equal(result.books.book.checks.chapters.metrics.nonDraft, 1);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
