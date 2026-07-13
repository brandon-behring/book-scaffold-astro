/**
 * tests/v4.6-seo-and-sitemap.test.mjs — focused tests for v4.6.0 behaviors.
 *
 * Covers the validator-side changes that the demo build doesn't exercise
 * directly:
 *
 *   - Layer 3b: chapter-route shadow warning (4 edge cases per issue #76)
 *   - Layer E (issue #77): missing-prereq abort with leading re-framed error
 *
 * Tests 1 + 2 from the v4.6.0 plan (virtual-module payload rename + sitemap
 * filter composition) are deferred to the demo-build integration test (see
 * Task #24 in the v4.6.0 plan) — the demo's astro.config.mjs exercises the
 * full propagation chain end-to-end, and the demo/dist/ output is grep'd
 * for the new tags. Reproducing that via unit-level mocks of Astro's
 * `astro:config:setup` hook would duplicate the integration coverage
 * without adding bug-finding power for the seo plumbing (which is
 * serialization + virtual-module emission, both highly mechanical).
 *
 * Run: node --test tests/v4.6-seo-and-sitemap.test.mjs
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VALIDATE_SCRIPT = resolve(__dirname, '..', 'scripts', 'validate.mjs');
const DIST_INDEX_URL = pathToFileURL(resolve(__dirname, '..', 'dist', 'index.mjs')).href;

/** Build a minimal valid book fixture; returns the root. Caller cleans up. */
function setupFixture({ withReferences = true, withLabels = true, profile = 'academic' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'bs-v46-'));
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

import Cite from '@brandon_m_behring/book-scaffold-astro/components/Cite.astro';

A test chapter with a <Cite key="example2026" /> citation.
`,
  );

  // Empty references.json by default — only populated when withReferences=true.
  // Cite key "example2026" intentionally NOT in this file so the test can
  // assert validator behavior under missing vs. populated state.
  if (withReferences) {
    writeFileSync(join(dataDir, 'references.json'), JSON.stringify({ example2026: { title: 'X' } }));
  }
  if (withLabels) {
    writeFileSync(join(dataDir, 'labels.json'), '{}');
  }

  // Minimal astro.config.mjs (validator regex-greps it for `chapters: false`
  // to suppress the chapter-route shadow warning). Default config: NO
  // chapters: false directive.
  writeFileSync(
    join(root, 'astro.config.mjs'),
    `import { defineBookConfig, academicStyle } from ${JSON.stringify(DIST_INDEX_URL)};
export default await defineBookConfig({ styles: [academicStyle], site: 'https://example.invalid' });
`,
  );

  return { root, chaptersDir, dataDir };
}

function runValidate(root, env = {}) {
  // Use BOOK_PRESET env (not --preset=academic, which the validator's
  // argv parser doesn't handle — it expects `--preset academic` two-arg
  // form). Env is also closer to how CI environments invoke validate.
  const res = spawnSync('node', [VALIDATE_SCRIPT], {
    cwd: root,
    env: { ...process.env, BOOK_PRESET: 'academic', ...env },
    encoding: 'utf8',
  });
  return { status: res.status, stdout: res.stdout, stderr: res.stderr };
}

// =====================================================================
// Layer 3b — chapter-route shadow warning (4 edge cases per issue #76)
// =====================================================================

test('3b: file present + chapters undefined (default true) → WARN', () => {
  const { root } = setupFixture();
  try {
    // Induce the shadow: create consumer-owned chapter route.
    mkdirSync(join(root, 'src', 'pages', 'chapters'), { recursive: true });
    writeFileSync(join(root, 'src', 'pages', 'chapters', '[...slug].astro'), '<!-- shadow -->');
    const r = runValidate(root);
    assert.match(
      r.stderr,
      /Consumer-owned chapter route/,
      'expected chapter-route shadow warning when file present + chapters undefined',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('3b: file present + chapters: false → SILENT (intentional override)', () => {
  const { root } = setupFixture();
  try {
    mkdirSync(join(root, 'src', 'pages', 'chapters'), { recursive: true });
    writeFileSync(join(root, 'src', 'pages', 'chapters', '[...slug].astro'), '<!-- shadow -->');
    // Override the astro.config.mjs to set chapters: false
    writeFileSync(
      join(root, 'astro.config.mjs'),
      `import { defineBookConfig, academicStyle } from ${JSON.stringify(DIST_INDEX_URL)};
export default await defineBookConfig({
  styles: [academicStyle],
  site: 'https://example.invalid',
  routes: { chapters: false },
});
`,
    );
    const r = runValidate(root);
    assert.doesNotMatch(
      r.stderr,
      /Consumer-owned chapter route/,
      'expected NO warning when consumer explicitly disabled chapters route',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('3b: no file + chapters undefined → SILENT (clean state)', () => {
  const { root } = setupFixture();
  try {
    const r = runValidate(root);
    assert.doesNotMatch(
      r.stderr,
      /Consumer-owned chapter route/,
      'expected NO warning when no consumer chapter-route file exists',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('3b: no file + chapters: false → SILENT (consumer opted out)', () => {
  const { root } = setupFixture();
  try {
    writeFileSync(
      join(root, 'astro.config.mjs'),
      `import { defineBookConfig, academicStyle } from ${JSON.stringify(DIST_INDEX_URL)};
export default await defineBookConfig({
  styles: [academicStyle],
  site: 'https://example.invalid',
  routes: { chapters: false },
});
`,
    );
    const r = runValidate(root);
    assert.doesNotMatch(
      r.stderr,
      /Consumer-owned chapter route/,
      'expected NO warning in clean opt-out state',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// =====================================================================
// Layer E (#77 superseded by #186) — missing artifacts self-heal
// =====================================================================

test('E/#186: missing references.json + bibliography + Cite tags self-heals', () => {
  const { root } = setupFixture({ withReferences: false, withLabels: true });
  try {
    writeFileSync(
      join(root, 'bibliography.bib'),
      '@article{example2026, title={Self-healed reference}, year={2026}}\n',
    );
    const r = runValidate(root);
    assert.equal(r.status, 0, `expected exit 0; got ${r.status}; stderr: ${r.stderr}`);
    assert.match(
      r.stdout,
      /references\.json is missing.*regenerating via build-bib\.mjs/s,
      'expected deterministic regeneration before checks',
    );
    assert.doesNotMatch(r.stderr, /Unknown bibkey/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('E: present references.json + valid Cite → clean exit 0', () => {
  // references.json exists and contains the Cite key → validator should pass.
  const { root } = setupFixture({ withReferences: true });
  try {
    const r = runValidate(root);
    assert.equal(r.status, 0, `expected exit 0; got ${r.status}; stderr: ${r.stderr}`);
    assert.doesNotMatch(
      r.stderr,
      /Validate cannot run/,
      'should not emit re-framed error when references.json exists',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('E/#186: missing references.json + NO Cite tags emits empty artifact and passes', () => {
  const root = mkdtempSync(join(tmpdir(), 'bs-v46-'));
  try {
    const chaptersDir = join(root, 'src', 'content', 'chapters');
    const dataDir = join(root, 'src', 'data');
    mkdirSync(chaptersDir, { recursive: true });
    mkdirSync(dataDir, { recursive: true });
    // Chapter without any <Cite> tags
    writeFileSync(
      join(chaptersDir, 'week01.mdx'),
      `---
week: 1
part: foundations
title: "No-cite chapter"
status: implemented
---

Just prose. No citations.
`,
    );
    writeFileSync(join(dataDir, 'labels.json'), '{}');
    // references.json intentionally missing
    writeFileSync(
      join(root, 'astro.config.mjs'),
      `import { defineBookConfig, academicStyle } from ${JSON.stringify(DIST_INDEX_URL)};
export default await defineBookConfig({ styles: [academicStyle], site: 'https://example.invalid' });
`,
    );
    const r = runValidate(root);
    assert.equal(r.status, 0, 'no cite tags + no references.json: validator should pass cleanly');
    assert.match(r.stdout, /regenerating via build-bib\.mjs/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
