/**
 * tests/scaffold.test.mjs — node:test suite for the create-book CLI.
 *
 * First tests for this package. Covers v3.6.1 fixes:
 *   #28 — create-book now emits src/pages/index.astro.
 *         v4.6.0 (issue #76 Layer 3c) — scaffold NO LONGER emits
 *         src/pages/chapters/[...slug].astro. The book-scaffold-astro
 *         package auto-injects that route since v4.3.0; pre-v4.6 templates
 *         shipped a redundant mechanical copy. New books are clean from
 *         day one. Tests updated to assert the absence.
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

test('v4.6.0 Layer 3c: scaffold does NOT emit src/pages/chapters/[...slug].astro (tools)', async () => {
  // book-scaffold-astro v4.3.0+ auto-injects the per-chapter route via
  // bookScaffoldIntegration (see package/src/integration.ts ROUTE_REGISTRY).
  // v4.6.0 Layer 3c removed the redundant template copy so new books are
  // clean from day one. Verify absence.
  const r = runCli(['demo-tools-46', '--preset=tools'], workRoot);
  assert.equal(r.status, 0, `expected exit 0; stderr: ${r.stderr}`);
  const routePath = join(
    workRoot,
    'demo-tools-46',
    'src',
    'pages',
    'chapters',
    '[...slug].astro',
  );
  assert.ok(
    !(await exists(routePath)),
    `expected ${routePath} to NOT exist (v4.6.0 Layer 3c — scaffold owns this route)`,
  );
});

test('#28 / v4.6.0 Layer 3c: scaffold emits index.astro but NOT chapter route (minimal)', async () => {
  const r = runCli(['demo-minimal-46', '--preset=minimal'], workRoot);
  assert.equal(r.status, 0, `expected exit 0; stderr: ${r.stderr}`);
  const dir = join(workRoot, 'demo-minimal-46');
  assert.ok(await exists(join(dir, 'src', 'pages', 'index.astro')));
  assert.ok(
    !(await exists(join(dir, 'src', 'pages', 'chapters', '[...slug].astro'))),
    'v4.6.0 Layer 3c: chapter route should NOT be in the scaffold template',
  );
});

test('v4.6.0 Layer D: academic preset adds prevalidate hook in package.json', async () => {
  const r = runCli(['demo-academic-46-d', '--preset=academic'], workRoot);
  assert.equal(r.status, 0, `expected exit 0; stderr: ${r.stderr}`);
  const pkgPath = join(workRoot, 'demo-academic-46-d', 'package.json');
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
  assert.ok(
    pkg.scripts.prevalidate,
    'expected prevalidate npm-lifecycle hook in academic-profile scaffold',
  );
  assert.match(
    pkg.scripts.prevalidate,
    /build:bib/,
    'prevalidate should call build:bib so npm run validate auto-regenerates references.json',
  );
});

test('v4.6.0 Layer D: research-portfolio preset adds prevalidate hook', async () => {
  const r = runCli(['demo-rp-46-d', '--preset=research-portfolio'], workRoot);
  assert.equal(r.status, 0, `expected exit 0; stderr: ${r.stderr}`);
  const pkgPath = join(workRoot, 'demo-rp-46-d', 'package.json');
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
  assert.ok(
    pkg.scripts.prevalidate,
    'expected prevalidate in research-portfolio scaffold (cite-key validation enabled)',
  );
});

test('v4.6.0 Layer D: tools preset does NOT add prevalidate (no cite-key validation)', async () => {
  const r = runCli(['demo-tools-46-d', '--preset=tools'], workRoot);
  assert.equal(r.status, 0, `expected exit 0; stderr: ${r.stderr}`);
  const pkgPath = join(workRoot, 'demo-tools-46-d', 'package.json');
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
  assert.equal(
    pkg.scripts.prevalidate,
    undefined,
    'tools profile has no bib pipeline — prevalidate would be a no-op',
  );
  assert.match(
    pkg.scripts.prebuild,
    /build:bib/,
    'non-academic profiles keep the explicit prebuild chain',
  );
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

test('#181: help text and invalid-preset error both list all five presets', async () => {
  const help = runCli(['--help'], workRoot);
  assert.equal(help.status, 0);
  const err = runCli(['demo-bad-preset-181', '--preset=bogus'], workRoot);
  assert.notEqual(err.status, 0);
  for (const preset of ['academic', 'tools', 'minimal', 'course-notes', 'research-portfolio']) {
    assert.ok(help.stdout.includes(preset), `help must list ${preset}`);
    assert.ok(err.stderr.includes(preset), `invalid-preset error must list ${preset}`);
  }
});

test('#181: scaffolded self-docs pin links to the installed toolkit version', async () => {
  const { version } = JSON.parse(
    await readFile(resolve(__dirname, '..', 'package.json'), 'utf8'),
  );
  const r = runCli(['demo-doclinks-181', '--preset=course-notes'], workRoot);
  assert.equal(r.status, 0);
  const dir = join(workRoot, 'demo-doclinks-181');
  for (const rel of ['CLAUDE.md', 'README.md', 'sources/manifest.yaml']) {
    const text = await readFile(join(dir, rel), 'utf8');
    if (text.includes('PACKAGE_DESIGN.md')) {
      assert.ok(
        text.includes(`blob/v${version}/PACKAGE_DESIGN.md`),
        `${rel} PACKAGE_DESIGN link must target the matching release tag`,
      );
      assert.ok(!text.includes('blob/main/'), `${rel} must not float documentation links on main`);
    }
  }
});

// ===== #206: author metadata, dual licenses, and D12 guide symmetry =====

test('#206: --author supports equals and separated forms and reaches package + licenses', async () => {
  const cases = [
    ['demo-author-equals-206', '--author=Ada Lovelace', 'Ada Lovelace'],
    ['demo-author-space-206', '--author', 'Grace Hopper', 'Grace Hopper'],
  ];
  for (const [name, flag, value, expected = value] of cases) {
    const args = [name, '--preset=minimal', flag];
    if (flag === '--author') args.push(value);
    const result = runCli(args, workRoot);
    assert.equal(result.status, 0, `${name}: ${result.stderr}`);
    const dir = join(workRoot, name);
    const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
    assert.equal(pkg.author, expected);
    assert.match(await readFile(join(dir, 'LICENSE'), 'utf8'), new RegExp(expected));
    assert.match(await readFile(join(dir, 'LICENSE-CONTENT'), 'utf8'), new RegExp(expected));
  }
});

test('#206: omitted author uses neutral Book contributors attribution', async () => {
  const name = 'demo-author-default-206';
  const result = runCli([name, '--preset=minimal'], workRoot);
  assert.equal(result.status, 0, result.stderr);
  const dir = join(workRoot, name);
  const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
  assert.equal(pkg.author, 'Book contributors');
  assert.match(await readFile(join(dir, 'LICENSE-CONTENT'), 'utf8'), /Book contributors/);
});

test('#206: empty --author values fail loudly', () => {
  for (const args of [
    ['demo-empty-author-206-a', '--author='],
    ['demo-empty-author-206-b', '--author'],
  ]) {
    const result = runCli(args, workRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /--author requires a non-empty name/);
  }
});

test('D12: every preset emits CLAUDE.md plus a valid AGENTS.md pointer', async () => {
  for (const preset of ['academic', 'tools', 'minimal', 'course-notes', 'research-portfolio']) {
    const name = `demo-guides-d12-${preset}`;
    const result = runCli([name, `--preset=${preset}`], workRoot);
    assert.equal(result.status, 0, `${preset}: ${result.stderr}`);
    const dir = join(workRoot, name);
    assert.ok(await exists(join(dir, 'CLAUDE.md')), `${preset}: missing CLAUDE.md`);
    const pointer = await readFile(join(dir, 'AGENTS.md'), 'utf8');
    assert.match(pointer, /\[?`?CLAUDE\.md`?\]?\(CLAUDE\.md\)/, `${preset}: invalid pointer`);
  }
});

// ===== #207: turnkey generated PDF pipeline =====

test('#207: every preset receives build-before-render PDF scripts and dependencies', async () => {
  for (const preset of ['academic', 'tools', 'minimal', 'course-notes', 'research-portfolio']) {
    const name = `demo-pdf-207-${preset}`;
    const result = runCli([name, `--preset=${preset}`], workRoot);
    assert.equal(result.status, 0, `${preset}: ${result.stderr}`);
    const pkg = JSON.parse(await readFile(join(workRoot, name, 'package.json'), 'utf8'));
    assert.equal(pkg.scripts.prepdf, 'npm run build');
    assert.match(pkg.scripts['pdf:render'], /pagedjs-cli http:\/\/localhost:4321\/print\//);
    assert.match(pkg.scripts['pdf:render'], /dist-pdf\/book\.pdf/);
    assert.equal(pkg.scripts.pdf, 'start-server-and-test preview http://localhost:4321/ pdf:render');
    assert.equal(pkg.devDependencies['pagedjs-cli'], '^0.4.3');
    assert.equal(pkg.devDependencies['start-server-and-test'], '^3.0.11');
  }
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

// ===== v4.12.0 (#91): default favicon =====

test('#91: scaffold emits public/favicon.svg (Base.astro links it on every page)', async () => {
  const r = runCli(['demo-favicon-91', '--preset=academic'], workRoot);
  assert.equal(r.status, 0, `expected exit 0; stderr: ${r.stderr}`);
  const faviconPath = join(workRoot, 'demo-favicon-91', 'public', 'favicon.svg');
  assert.ok(await exists(faviconPath), `expected ${faviconPath} to exist`);
  const svg = await readFile(faviconPath, 'utf8');
  assert.match(svg, /<svg[\s>]/, 'favicon should be valid SVG markup');
  assert.ok(svg.trim().length > 0, 'favicon should be non-empty');
});

test('#91: favicon is scaffolded for every preset (universal)', async () => {
  for (const preset of ['tools', 'minimal', 'research-portfolio', 'course-notes']) {
    const name = `demo-favicon-91-${preset}`;
    const r = runCli([name, `--preset=${preset}`], workRoot);
    assert.equal(r.status, 0, `${preset}: expected exit 0; stderr: ${r.stderr}`);
    assert.ok(
      await exists(join(workRoot, name, 'public', 'favicon.svg')),
      `${preset}: expected public/favicon.svg to be scaffolded`,
    );
  }
});

// ===== v4.12.0 (#90): decision-log convention =====

test('#90: scaffold emits decisions/ dir with template, README, and seed ADR', async () => {
  const r = runCli(['demo-decisions-90', '--preset=academic'], workRoot);
  assert.equal(r.status, 0, `expected exit 0; stderr: ${r.stderr}`);
  const dir = join(workRoot, 'demo-decisions-90', 'decisions');
  assert.ok(await exists(join(dir, 'ADR_TEMPLATE.md')), 'expected decisions/ADR_TEMPLATE.md');
  assert.ok(await exists(join(dir, 'README.md')), 'expected decisions/README.md');
  assert.ok(
    await exists(join(dir, '0001-built-on-book-scaffold-astro.md')),
    'expected seed decisions/0001-*.md',
  );

  const template = await readFile(join(dir, 'ADR_TEMPLATE.md'), 'utf8');
  assert.match(template, /^# ADR-NNN:/m, 'template should use the numbered ADR-NNN heading');
  assert.match(template, /\*\*Status\*\*/, 'template should have a Status field');
  assert.match(template, /Superseded/, 'template should document supersession');
});

test('#90: seed ADR interpolates the book name + profile and is Accepted', async () => {
  const r = runCli(['demo-decisions-90-seed', '--preset=tools'], workRoot);
  assert.equal(r.status, 0, `expected exit 0; stderr: ${r.stderr}`);
  const seed = await readFile(
    join(workRoot, 'demo-decisions-90-seed', 'decisions', '0001-built-on-book-scaffold-astro.md'),
    'utf8',
  );
  assert.match(seed, /demo-decisions-90-seed/, 'seed ADR should reference the book name');
  assert.match(seed, /tools profile/, 'seed ADR should reference the resolved profile');
  assert.match(seed, /\*\*Status\*\*: Accepted/, 'seed ADR should be Accepted');
});

test('#90: generated README references the decisions/ log', async () => {
  const r = runCli(['demo-decisions-90-readme', '--preset=minimal'], workRoot);
  assert.equal(r.status, 0, `expected exit 0; stderr: ${r.stderr}`);
  const readme = await readFile(
    join(workRoot, 'demo-decisions-90-readme', 'README.md'),
    'utf8',
  );
  assert.match(readme, /decisions\//, 'generated README should point at decisions/');
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

// ===== v4.0.0 P5: per-preset wrangler.toml (#50) =====

test('v4.0.0 #50: academic scaffold ships Workers-style wrangler.toml ([assets] directive)', async () => {
  const r = runCli(['demo-workers-v4', '--preset=academic'], workRoot);
  assert.equal(r.status, 0);
  const wrangler = await readFile(
    join(workRoot, 'demo-workers-v4', 'wrangler.toml'),
    'utf8',
  );
  assert.match(wrangler, /^\[assets\]$/m, 'expected [assets] directive');
  assert.doesNotMatch(wrangler, /pages_build_output_dir/, 'should NOT have Pages directive');
});

test('v4.0.0 #50: research-portfolio scaffold ships Pages-style wrangler.toml (pages_build_output_dir)', async () => {
  const r = runCli(['demo-pages-v4', '--preset=research-portfolio'], workRoot);
  assert.equal(r.status, 0);
  const wrangler = await readFile(
    join(workRoot, 'demo-pages-v4', 'wrangler.toml'),
    'utf8',
  );
  assert.match(wrangler, /pages_build_output_dir\s*=\s*"\.\/dist"/, 'expected Pages directive');
  assert.doesNotMatch(wrangler, /^\[assets\]$/m, 'should NOT have Workers directive');
});

test('v4.0.0 #50: course-notes scaffold also ships Pages-style wrangler.toml', async () => {
  const r = runCli(['demo-course-pages-v4', '--preset=course-notes'], workRoot);
  assert.equal(r.status, 0);
  const wrangler = await readFile(
    join(workRoot, 'demo-course-pages-v4', 'wrangler.toml'),
    'utf8',
  );
  assert.match(wrangler, /pages_build_output_dir/);
});

// ===== v4.0.0 architecture: scaffold uses new styles: [...] pattern =====

test('v4.0.0 architecture: scaffolded astro.config.mjs uses styles: [<preset>Style] (not v3 preset:)', async () => {
  const r = runCli(['demo-v4-config', '--preset=academic'], workRoot);
  assert.equal(r.status, 0);
  const astroConfig = await readFile(
    join(workRoot, 'demo-v4-config', 'astro.config.mjs'),
    'utf8',
  );
  // Must use new v4 API
  assert.match(astroConfig, /styles:\s*\[academicStyle\]/, 'expected v4 styles: [...] composition');
  assert.match(astroConfig, /import\s*\{[^}]*academicStyle[^}]*\}\s*from\s*'@brandon_m_behring\/book-scaffold-astro'/);
  // Must NOT use removed v3 fields
  assert.doesNotMatch(astroConfig, /\bpreset:\s*['"]/, 'v3 preset: field must not appear');
  assert.doesNotMatch(astroConfig, /\bprofile:\s*['"]/, 'v3 profile: field must not appear');
});

test('v4.0.0 architecture: research-portfolio scaffold imports researchPortfolioStyle', async () => {
  const r = runCli(['demo-v4-rp', '--preset=research-portfolio'], workRoot);
  assert.equal(r.status, 0);
  const astroConfig = await readFile(
    join(workRoot, 'demo-v4-rp', 'astro.config.mjs'),
    'utf8',
  );
  assert.match(astroConfig, /researchPortfolioStyle/);
  assert.match(astroConfig, /styles:\s*\[researchPortfolioStyle\]/);
});
