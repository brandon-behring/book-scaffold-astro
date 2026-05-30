/**
 * tests/build-labels.test.mjs — node:test suite for scripts/build-labels.mjs.
 *
 * Runs the script against fixtures in a temp dir, verifies the emitted
 * labels.json shape + values per chapter / per type counter rules.
 * Zero external deps (D4 — node:test built-in).
 *
 * Run: node --test tests/build-labels.test.mjs
 */
import { test, before } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(__dirname, '..', 'scripts', 'build-labels.mjs');
const FIXTURE_CHAPTER = resolve(__dirname, 'fixtures', 'chapters', 'valid-academic.mdx');
const SLUG_FIXTURE = resolve(__dirname, 'fixtures', 'chapters', 'slug-override.mdx');

/** Run build-labels.mjs in a temp dir containing one fixture chapter. Returns parsed labels.json. */
function runInTempDir(fixturePaths = [FIXTURE_CHAPTER]) {
  const tmp = mkdtempSync(join(tmpdir(), 'book-scaffold-test-'));
  try {
    const chaptersDir = join(tmp, 'src', 'content', 'chapters');
    mkdirSync(chaptersDir, { recursive: true });
    for (const fp of fixturePaths) {
      copyFileSync(fp, join(chaptersDir, fp.split('/').pop()));
    }
    execSync(`node ${SCRIPT}`, { cwd: tmp, stdio: 'pipe' });
    const labelsRaw = readFileSync(join(tmp, 'src', 'data', 'labels.json'), 'utf8');
    return JSON.parse(labelsRaw);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

test('build-labels: extracts 4 ids from valid-academic.mdx', () => {
  const labels = runInTempDir();
  assert.equal(Object.keys(labels).length, 4);
});

test('build-labels: per-chapter per-type counter (Theorem 4.1, 4.2)', () => {
  const labels = runInTempDir();
  assert.equal(labels['w4:thm:stability'].display, 'Theorem 4.1');
  // w4:thm:convergence has a label override, so its display is the custom label.
  assert.equal(labels['w4:thm:convergence'].display, 'Convergence (custom)');
});

test('build-labels: Figure gets its own counter (Figure 4.1)', () => {
  const labels = runInTempDir();
  assert.equal(labels['w4:fig:phase-portrait'].display, 'Figure 4.1');
});

test('build-labels: ExampleBox renders as "Example N.M"', () => {
  const labels = runInTempDir();
  assert.equal(labels['w4:ex:harmonic'].display, 'Example 4.1');
});

test('build-labels: href shape is /chapters/<slug>#<id>', () => {
  const labels = runInTempDir();
  assert.equal(
    labels['w4:thm:stability'].href,
    '/chapters/valid-academic#w4:thm:stability',
  );
});

test('build-labels: frontmatter slug: overrides the filename in the href (v4.9.0)', () => {
  // slug-override.mdx has filename `slug-override` but `slug: clean-name`.
  // The href must use the slug (matching Astro's entry.id), NOT the filename.
  const labels = runInTempDir([SLUG_FIXTURE]);
  assert.equal(
    labels['slug:thm:demo'].href,
    '/chapters/clean-name#slug:thm:demo',
  );
});

test('build-labels: empty chapters dir → empty labels.json', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'book-scaffold-test-empty-'));
  try {
    mkdirSync(join(tmp, 'src', 'content', 'chapters'), { recursive: true });
    execSync(`node ${SCRIPT}`, { cwd: tmp, stdio: 'pipe' });
    const labelsRaw = readFileSync(join(tmp, 'src', 'data', 'labels.json'), 'utf8');
    assert.deepEqual(JSON.parse(labelsRaw), {});
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('build-labels: missing chapters dir → empty labels.json (no throw)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'book-scaffold-test-noexist-'));
  try {
    // Don't create src/content/chapters at all.
    execSync(`node ${SCRIPT}`, { cwd: tmp, stdio: 'pipe' });
    const labelsRaw = readFileSync(join(tmp, 'src', 'data', 'labels.json'), 'utf8');
    assert.deepEqual(JSON.parse(labelsRaw), {});
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('build-labels: keys sorted alphabetically (deterministic output)', () => {
  const labels = runInTempDir();
  const keys = Object.keys(labels);
  const sortedKeys = [...keys].sort();
  assert.deepEqual(keys, sortedKeys);
});
