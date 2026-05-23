/**
 * tests/scaffold.test.mjs — node:test suite for the create-book CLI.
 *
 * First tests for this package. Covers v3.6.1 fixes:
 *   #28 — create-book now emits src/pages/index.astro + chapters/[...slug].astro.
 *   #38 — --preset is accepted as canonical synonym of --profile.
 *   #39 — bibliography.bib placeholder is parseable (non-empty + has @entry).
 *
 * Lightweight: spawns the CLI in a tmp dir per case, then file-system asserts.
 * Does NOT run `npm install + npm run build` — that's the smoke test step in
 * the v3.6.1 release verification.
 *
 * Run: node --test tests/scaffold.test.mjs
 */
import { test, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtemp, rm, readFile, access, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(__dirname, '..', 'bin', 'create-book.mjs');

let workRoot;
before(async () => {
  workRoot = await mkdtemp(join(tmpdir(), 'create-book-test-'));
});
after(async () => {
  await rm(workRoot, { recursive: true, force: true });
});

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function runCli(args, cwd) {
  const res = spawnSync('node', [CLI, ...args], { cwd, encoding: 'utf8' });
  return {
    status: res.status,
    stdout: res.stdout,
    stderr: res.stderr,
  };
}

// ===== #28: src/pages/ scaffolding =====

test('#28: scaffold emits src/pages/index.astro for academic preset', async () => {
  const r = runCli(['demo-academic-28', '--preset=academic'], workRoot);
  assert.equal(r.status, 0, `expected exit 0; stderr: ${r.stderr}`);
  const indexPath = join(workRoot, 'demo-academic-28', 'src', 'pages', 'index.astro');
  assert.ok(await exists(indexPath), `expected ${indexPath} to exist`);
  const body = await readFile(indexPath, 'utf8');
  assert.match(body, /Base/, 'index.astro should import Base layout');
});

test('#28: scaffold emits src/pages/chapters/[...slug].astro for tools preset', async () => {
  const r = runCli(['demo-tools-28', '--preset=tools'], workRoot);
  assert.equal(r.status, 0, `expected exit 0; stderr: ${r.stderr}`);
  const routePath = join(
    workRoot,
    'demo-tools-28',
    'src',
    'pages',
    'chapters',
    '[...slug].astro',
  );
  assert.ok(await exists(routePath), `expected ${routePath} to exist`);
  const body = await readFile(routePath, 'utf8');
  assert.match(body, /getCollection/, 'chapter route should call getCollection');
  assert.match(body, /Chapter/, 'chapter route should use Chapter layout');
});

test('#28: scaffold emits both pages files for minimal preset', async () => {
  const r = runCli(['demo-minimal-28', '--preset=minimal'], workRoot);
  assert.equal(r.status, 0, `expected exit 0; stderr: ${r.stderr}`);
  const dir = join(workRoot, 'demo-minimal-28');
  assert.ok(await exists(join(dir, 'src', 'pages', 'index.astro')));
  assert.ok(await exists(join(dir, 'src', 'pages', 'chapters', '[...slug].astro')));
});

// ===== #38: --preset as alias of --profile =====

test('#38: --preset=academic and --profile=academic produce identical file lists', async () => {
  const r1 = runCli(['demo-preset-38', '--preset=academic'], workRoot);
  const r2 = runCli(['demo-profile-38', '--profile=academic'], workRoot);
  assert.equal(r1.status, 0);
  assert.equal(r2.status, 0);

  // Recursively gather relative file paths from each scaffolded tree.
  async function fileList(root) {
    const out = [];
    async function walk(dir, prefix = '') {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        const rel = prefix ? `${prefix}/${e.name}` : e.name;
        if (e.isDirectory()) await walk(join(dir, e.name), rel);
        else out.push(rel);
      }
    }
    await walk(root);
    return out.sort();
  }

  const files1 = await fileList(join(workRoot, 'demo-preset-38'));
  const files2 = await fileList(join(workRoot, 'demo-profile-38'));
  assert.deepEqual(files1, files2, '--preset and --profile must scaffold identical file sets');
});

test('#38: --preset=invalid-name fails with non-zero exit', async () => {
  const r = runCli(['demo-bad-preset-38', '--preset=not-a-real-preset'], workRoot);
  assert.notEqual(r.status, 0, 'invalid preset should fail');
  assert.match(r.stderr, /invalid profile|invalid preset/i);
});

test('#38: help text mentions --preset before --profile', async () => {
  const r = runCli(['--help'], workRoot);
  assert.equal(r.status, 0);
  const presetIdx = r.stdout.indexOf('--preset');
  const profileIdx = r.stdout.indexOf('--profile');
  assert.ok(presetIdx >= 0, 'help should mention --preset');
  assert.ok(profileIdx >= 0, 'help should mention --profile');
  assert.ok(
    presetIdx < profileIdx,
    '--preset should appear before --profile in help text (canonical first)',
  );
});

// ===== #39: bibliography.bib is parseable =====

test('#39: academic scaffold ships a bibliography.bib with at least one parseable entry', async () => {
  const r = runCli(['demo-bib-39', '--preset=academic'], workRoot);
  assert.equal(r.status, 0);
  const bibPath = join(workRoot, 'demo-bib-39', 'bibliography.bib');
  assert.ok(await exists(bibPath));
  const bib = await readFile(bibPath, 'utf8');
  // Must contain at least one @entry directive (citation-js requires
  // non-zero entries; comments-only crashes the Grammar parser).
  assert.match(bib, /^@\w+\{/m, 'bibliography.bib must contain at least one @entry');
});

test('v3.6.4: demo academic chapter Cite keys must exist in bibliography.bib placeholder', async () => {
  // The academic demo chapter references a bibkey via <Cite key="..."/>.
  // book-scaffold validate (a hard CI gate as of Phase 2.6) fails the build
  // if the key isn't in the generated references.json. So the scaffolded
  // book must ship with the demo chapter's Cite key matching an entry in
  // the placeholder bibliography.bib.
  //
  // Pre-v3.6.4 the demo chapter said key="example-key2024" but the bib
  // contained only @misc{placeholder2026} — every new academic book failed
  // validate on the first build with "Unknown bibkey".
  const r = runCli(['demo-bibkey-match-v364', '--preset=academic'], workRoot);
  assert.equal(r.status, 0);
  const scaffoldDir = join(workRoot, 'demo-bibkey-match-v364');
  const bib = await readFile(join(scaffoldDir, 'bibliography.bib'), 'utf8');
  const chapter = await readFile(
    join(scaffoldDir, 'src', 'content', 'chapters', 'week01-hello-world.mdx'),
    'utf8',
  );

  // Extract bibkeys from the bib file (the identifier after `@type{`).
  const bibKeys = new Set();
  for (const m of bib.matchAll(/^@\w+\{([^,\s]+)/gm)) bibKeys.add(m[1]);
  assert.ok(bibKeys.size > 0, 'bibliography.bib must define at least one bibkey');

  // Extract Cite keys from the chapter.
  const citeKeys = [];
  for (const m of chapter.matchAll(/<Cite\s+key="([^"]+)"/g)) citeKeys.push(m[1]);

  const unknownCites = citeKeys.filter((k) => !bibKeys.has(k));
  assert.equal(
    unknownCites.length,
    0,
    `demo chapter cites bibkeys not in bibliography.bib: ${unknownCites.join(', ')}\n` +
      `Defined bibkeys: ${[...bibKeys].join(', ')}`,
  );
});

test('#39 (v3.6.3): bibliography.bib comments must NOT contain ANY @<word> token', async () => {
  // citation-js's BibTeX grammar tokenizes ANY `@word` token (with or without
  // a trailing `{`) inside %-prefixed comment lines as an entry start. If the
  // parser can't find valid entry syntax after it, the Grammar parser crashes.
  //
  // History of this bug:
  //   v3.6.0 — template was comments-only (no @entry at all): zero-entry crash.
  //   v3.6.1 — template added an @entry + a trailing commented "% @article{..."
  //            example block: still crashed (commented @<word>{).
  //   v3.6.2 — template removed the commented example but mentioned
  //            "(@article, @book, ...)" in a comment listing entry types:
  //            still crashed (commented @<word>, even without `{`).
  //   v3.6.3 — bib comments now contain NO @-prefixed words at all.
  //
  // The regression test must reflect the actual failure mode (any @<word>),
  // not just the @<word>{ pattern from v3.6.1.
  const r = runCli(['demo-bib-no-at-word-in-comments', '--preset=academic'], workRoot);
  assert.equal(r.status, 0);
  const bib = await readFile(join(workRoot, 'demo-bib-no-at-word-in-comments', 'bibliography.bib'), 'utf8');
  const offenders = bib
    .split('\n')
    .map((line, i) => ({ line: line.trim(), n: i + 1 }))
    .filter(({ line }) => /^%[^\n]*@\w+/.test(line));
  assert.equal(
    offenders.length,
    0,
    `bibliography.bib comment lines contain @<word> tokens that crash citation-js:\n` +
      offenders.map((o) => `  line ${o.n}: ${o.line}`).join('\n'),
  );
});

test('#39: tools scaffold does NOT ship bibliography.bib (tools profile uses YAML manifest)', async () => {
  const r = runCli(['demo-no-bib-39', '--preset=tools'], workRoot);
  assert.equal(r.status, 0);
  const bibPath = join(workRoot, 'demo-no-bib-39', 'bibliography.bib');
  assert.equal(await exists(bibPath), false, 'tools profile should not emit bibliography.bib');
});
