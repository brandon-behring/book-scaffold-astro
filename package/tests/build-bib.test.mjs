/**
 * tests/build-bib.test.mjs — node:test suite for scripts/build-bib.mjs.
 *
 * Covers both pipelines the script drives:
 *   - BibTeX → src/data/references.json (graceful empty when no .bib).
 *   - sources/manifest.yaml → src/data/sources.json (v4.10.0, #85) — the
 *     fix that makes the tools-profile /references page non-empty. Absent
 *     manifest must emit NO sources.json (academic/minimal stay clean).
 *
 * Runs the script in a temp cwd (like build-labels.test.mjs). Zero external
 * deps beyond node:test.
 * Run: node --test tests/build-bib.test.mjs
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  mkdtempSync,
  mkdirSync,
  copyFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(__dirname, '..', 'scripts', 'build-bib.mjs');
const MANIFEST_FIXTURE = resolve(__dirname, 'fixtures', 'sources', 'manifest.yaml');

/** Run build-bib in a temp cwd; optionally seed sources/manifest.yaml. */
function runInTempDir({ withManifest } = {}) {
  const tmp = mkdtempSync(join(tmpdir(), 'book-scaffold-bib-'));
  try {
    if (withManifest) {
      const sdir = join(tmp, 'sources');
      mkdirSync(sdir, { recursive: true });
      copyFileSync(MANIFEST_FIXTURE, join(sdir, 'manifest.yaml'));
    }
    execSync(`node ${SCRIPT}`, { cwd: tmp, stdio: 'pipe' });
    const refs = JSON.parse(
      readFileSync(join(tmp, 'src', 'data', 'references.json'), 'utf8'),
    );
    const sourcesPath = join(tmp, 'src', 'data', 'sources.json');
    const sources = existsSync(sourcesPath)
      ? JSON.parse(readFileSync(sourcesPath, 'utf8'))
      : null;
    return { refs, sources };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

test('build-bib: no .bib → empty references.json (no crash)', () => {
  const { refs } = runInTempDir({ withManifest: false });
  assert.deepEqual(refs, {});
});

test('build-bib: no manifest → no sources.json emitted (academic/minimal stay clean)', () => {
  const { sources } = runInTempDir({ withManifest: false });
  assert.equal(sources, null);
});

test('build-bib: manifest present → sources.json with ids + fields preserved', () => {
  const { sources } = runInTempDir({ withManifest: true });
  assert.ok(Array.isArray(sources), 'sources.json should be an array');
  assert.equal(sources.length, 2);
  assert.deepEqual(
    sources.map((s) => s.id),
    ['alpha-source', 'beta-source'],
  );
  const alpha = sources.find((s) => s.id === 'alpha-source');
  assert.equal(alpha.tier, 'T1-official');
  assert.equal(alpha.url, 'https://example.com/alpha');
  assert.equal(alpha.tool, 'claude-code');
});

test('build-bib: manifest present, no .bib → references.json still empty (independent pipelines)', () => {
  const { refs } = runInTempDir({ withManifest: true });
  assert.deepEqual(refs, {});
});
