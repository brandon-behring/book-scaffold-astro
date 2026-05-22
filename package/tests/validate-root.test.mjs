/**
 * tests/validate-root.test.mjs — node:test suite for the v3.4.0 validate
 * root-resolution fix.
 *
 * Closes issue #8: pre-v3.4.0, validate.mjs resolved its ROOT from
 * import.meta.url, which pointed at the package's own directory inside
 * node_modules. Three reference consumers all reported "0 chapter(s)
 * checked" (false negative). The fix switches ROOT to process.cwd().
 *
 * This suite spawns validate against a small fixture book in a temp dir
 * and asserts (a) non-zero chapter count, (b) deliberate invalid XRef
 * triggers a failure exit code, (c) no false-positive errors on a clean
 * fixture.
 *
 * Run: node --test tests/validate-root.test.mjs
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VALIDATE_SCRIPT = resolve(__dirname, '..', 'scripts', 'validate.mjs');

/** Set up a minimal book fixture at `root`. Two chapters; clean baseline. */
function setupCleanFixture(root) {
  const chaptersDir = join(root, 'src', 'content', 'chapters');
  const dataDir = join(root, 'src', 'data');
  mkdirSync(chaptersDir, { recursive: true });
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(
    join(chaptersDir, 'week01.mdx'),
    `---
week: 1
part: foundations
title: "Test chapter"
status: implemented
---

A test paragraph.
`,
  );
  writeFileSync(
    join(chaptersDir, 'week02.mdx'),
    `---
week: 2
part: foundations
title: "Second test chapter"
status: implemented
---

Another paragraph.
`,
  );
  // Empty references + labels so XRef / Cite checks don't false-fail.
  writeFileSync(join(dataDir, 'references.json'), '{}');
  writeFileSync(join(dataDir, 'labels.json'), '{}');
}

test('validate-root: resolves chapters from CWD (closes #8 — was 0 from package root)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'book-scaffold-validate-'));
  try {
    setupCleanFixture(tmp);
    const result = spawnSync('node', [VALIDATE_SCRIPT], {
      cwd: tmp,
      encoding: 'utf8',
      timeout: 10_000,
    });
    assert.equal(result.status, 0, `validate should exit 0 on clean fixture\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
    assert.match(
      result.stdout,
      /2 chapter\(s\) checked/,
      `validate should report 2 chapters in the fixture (not 0); got: ${result.stdout}`,
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('validate-root: detects invalid XRef in consumer-rooted fixture', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'book-scaffold-validate-'));
  try {
    setupCleanFixture(tmp);
    // Inject a deliberate broken XRef. labels.json is empty, so this fails.
    writeFileSync(
      join(tmp, 'src', 'content', 'chapters', 'week03.mdx'),
      `---
week: 3
part: foundations
title: "Chapter with bad XRef"
status: implemented
---

See <XRef id="nonexistent-id" /> for details.
`,
    );
    const result = spawnSync('node', [VALIDATE_SCRIPT], {
      cwd: tmp,
      encoding: 'utf8',
      timeout: 10_000,
    });
    // Exit code = error count. Bad XRef => >=1.
    assert.ok(result.status > 0, `validate should fail on invalid XRef (status=${result.status})`);
    assert.match(
      result.stderr,
      /Unknown XRef id "nonexistent-id"/,
      `validate should name the bad XRef; got stderr: ${result.stderr}`,
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('validate-root: --preset CLI flag overrides env (closes #9 single-source resolution)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'book-scaffold-validate-'));
  try {
    setupCleanFixture(tmp);
    const result = spawnSync('node', [VALIDATE_SCRIPT, '--preset', 'academic'], {
      cwd: tmp,
      encoding: 'utf8',
      timeout: 10_000,
      env: { ...process.env, BOOK_PRESET: 'tools' }, // env says tools but flag says academic
    });
    assert.equal(result.status, 0, `validate should exit 0 with --preset flag override`);
    assert.match(result.stdout, /profile=academic/, `validate should report academic from --preset flag, not tools from env`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('validate-root: .env BOOK_PROFILE is honored when no env or flag is set (closes #20)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'book-scaffold-validate-'));
  try {
    setupCleanFixture(tmp);
    // Write .env at the consumer root — the same pattern create-book scaffolds.
    writeFileSync(join(tmp, '.env'), 'BOOK_PROFILE=academic\nBOOK_TITLE=Test Book\n');
    // Strip BOOK_PRESET / BOOK_PROFILE from inherited env so the .env file is
    // the only source of preset information.
    const env = { ...process.env };
    delete env.BOOK_PRESET;
    delete env.BOOK_PROFILE;
    const result = spawnSync('node', [VALIDATE_SCRIPT], {
      cwd: tmp,
      encoding: 'utf8',
      timeout: 10_000,
      env,
    });
    assert.equal(result.status, 0, `validate should exit 0 on clean fixture with .env-driven academic profile`);
    assert.match(
      result.stdout,
      /profile=academic/,
      `validate should read BOOK_PROFILE from .env when no env var or flag is set; got: ${result.stdout}\nstderr: ${result.stderr}`,
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('validate-root: BOOK_PROFILE env still wins over .env (closes #20)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'book-scaffold-validate-'));
  try {
    setupCleanFixture(tmp);
    writeFileSync(join(tmp, '.env'), 'BOOK_PROFILE=tools\n');
    const result = spawnSync('node', [VALIDATE_SCRIPT], {
      cwd: tmp,
      encoding: 'utf8',
      timeout: 10_000,
      env: { ...process.env, BOOK_PROFILE: 'academic' },
    });
    assert.equal(result.status, 0, `validate should exit 0`);
    assert.match(
      result.stdout,
      /profile=academic/,
      `process.env.BOOK_PROFILE should win over .env BOOK_PROFILE; got: ${result.stdout}`,
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
