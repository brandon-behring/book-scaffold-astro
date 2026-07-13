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
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VALIDATE_SCRIPT = resolve(__dirname, '..', 'scripts', 'validate.mjs');
const DIST_INDEX_URL = pathToFileURL(resolve(__dirname, '..', 'dist', 'index.mjs')).href;

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

function setupSiblingConfig(root, siblingBooks) {
  writeFileSync(
    join(root, 'astro.config.mjs'),
    `import { defineBookConfig, minimalStyle } from ${JSON.stringify(DIST_INDEX_URL)};\n` +
      `export default await defineBookConfig({ styles: [minimalStyle], site: 'https://test.invalid', ` +
      `siblingBooks: ${JSON.stringify(siblingBooks)} });\n`,
  );
}

function writeBookLinkChapter(root, body) {
  writeFileSync(
    join(root, 'src', 'content', 'chapters', 'week03.mdx'),
    `---
week: 3
part: foundations
title: "Cross-book links"
status: implemented
---

${body}
`,
  );
}

/**
 * Add a study-guide `questions` collection + an `astro.config.mjs` declaring
 * `examDomains` to a fixture root, for validate check #8 (v4.17.0, #112).
 * `files` maps filename → MDX body.
 */
function setupQuestionsFixture(root, files) {
  const qDir = join(root, 'src', 'content', 'questions');
  mkdirSync(qDir, { recursive: true });
  // validate.mjs regex-extracts examDomains from the config TEXT (never imports it).
  writeFileSync(
    join(root, 'astro.config.mjs'),
    `export default { examDomains: ['arrays', 'strings'] };\n`,
  );
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(qDir, name), body);
  }
}

/** A minimal valid MCQ question file (frontmatter id/type/domain + a stem). */
const questionFile = (id, domain) => `---
id: ${id}
type: mcq
domain: ${domain}
chapter: 1
options:
  - { id: a, correct: true }
  - { id: b }
---
A question stem.
`;

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

// ---- validate check #8: study-guide questions (v4.17.0, #112) ----

test('validate #8: a clean questions fixture passes + reports the question count', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'book-scaffold-validate-'));
  try {
    setupCleanFixture(tmp);
    setupQuestionsFixture(tmp, {
      '01.mdx': questionFile('q-arrays-1', 'arrays'),
      '02.mdx': questionFile('q-strings-1', 'strings'),
    });
    const result = spawnSync('node', [VALIDATE_SCRIPT], { cwd: tmp, encoding: 'utf8', timeout: 10_000 });
    assert.equal(result.status, 0, `clean questions fixture should pass\nstderr: ${result.stderr}`);
    assert.match(result.stdout, /2 question\(s\) checked/, `got: ${result.stdout}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('validate #8: a duplicate question id fails loud (#112)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'book-scaffold-validate-'));
  try {
    setupCleanFixture(tmp);
    setupQuestionsFixture(tmp, {
      '01.mdx': questionFile('q-dup', 'arrays'),
      '02.mdx': questionFile('q-dup', 'strings'),
    });
    const result = spawnSync('node', [VALIDATE_SCRIPT], { cwd: tmp, encoding: 'utf8', timeout: 10_000 });
    assert.ok(result.status > 0, `duplicate id should fail (status=${result.status})`);
    assert.match(result.stderr, /Duplicate question id "q-dup"/, `got stderr: ${result.stderr}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('validate #8: a question domain not in examDomains fails loud (#112)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'book-scaffold-validate-'));
  try {
    setupCleanFixture(tmp);
    setupQuestionsFixture(tmp, { '01.mdx': questionFile('q-1', 'phantom') });
    const result = spawnSync('node', [VALIDATE_SCRIPT], { cwd: tmp, encoding: 'utf8', timeout: 10_000 });
    assert.ok(result.status > 0, `unknown domain should fail (status=${result.status})`);
    assert.match(
      result.stderr,
      /Question domain "phantom" not in defineBookConfig examDomains/,
      `got stderr: ${result.stderr}`,
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ---- validate check #6 (#126): a <Theorem id> must resolve in labels.json ----

test('validate (#126): <Theorem id> present in labels.json passes; a label= override is exempt', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'book-scaffold-validate-'));
  try {
    setupCleanFixture(tmp);
    // Only thm:ok is indexed. thm:custom carries a label= override → opts out of
    // auto-numbering (number:null) → exempt from the id-in-labels requirement.
    writeFileSync(
      join(tmp, 'src', 'data', 'labels.json'),
      JSON.stringify({
        'w3:thm:ok': { href: '/chapters/week03#w3:thm:ok', display: 'Theorem 3.1', number: '3.1' },
      }),
    );
    writeFileSync(
      join(tmp, 'src', 'content', 'chapters', 'week03.mdx'),
      `---
week: 3
part: foundations
title: "Themed chapter"
status: implemented
---

<Theorem id="w3:thm:ok" kind="theorem">Resolvable — present in labels.json.</Theorem>

<Theorem id="w3:thm:custom" kind="theorem" label="Custom">Override — id absent from labels.json, but exempt.</Theorem>
`,
    );
    const result = spawnSync('node', [VALIDATE_SCRIPT], { cwd: tmp, encoding: 'utf8', timeout: 10_000 });
    assert.equal(result.status, 0, `id-in-labels + label-override theorems should pass\nstderr: ${result.stderr}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('validate (#176): quoted and braced literal n= values must match labels.json', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'book-scaffold-validate-'));
  try {
    setupCleanFixture(tmp);
    writeFileSync(
      join(tmp, 'src', 'data', 'labels.json'),
      JSON.stringify({
        quoted: { display: 'Theorem 3.1', number: '3.1' },
        braced: { display: 'Theorem 3.2', number: '3.2' },
        numeric: { display: 'Theorem 3.3', number: '3.3' },
      }),
    );
    writeFileSync(
      join(tmp, 'src', 'content', 'chapters', 'week03.mdx'),
      `---
week: 3
title: Literals
status: implemented
---
<Theorem id="quoted" kind="theorem" n="9.9">Stale.</Theorem>
<Theorem id="braced" kind="theorem" n={'3.2'}>Matches.</Theorem>
<Theorem id="numeric" kind="theorem" n={8.8}>Stale numeric.</Theorem>
`,
    );
    const result = spawnSync(process.execPath, [VALIDATE_SCRIPT], {
      cwd: tmp,
      encoding: 'utf8',
      timeout: 10_000,
    });
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /n="9\.9".*labels\.json numbers it 3\.1/);
    assert.match(result.stderr, /n="8\.8".*labels\.json numbers it 3\.3/);
    assert.doesNotMatch(result.stderr, /n="3\.2"/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('validate (#176): dynamic n= expressions and label overrides are skipped', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'book-scaffold-validate-'));
  try {
    setupCleanFixture(tmp);
    writeFileSync(
      join(tmp, 'src', 'data', 'labels.json'),
      JSON.stringify({
        identifier: { display: 'Theorem 3.1', number: '3.1' },
        expression: { display: 'Theorem 3.2', number: '3.2' },
        custom: { display: 'Custom', number: null },
      }),
    );
    writeFileSync(
      join(tmp, 'src', 'content', 'chapters', 'week03.mdx'),
      `---
week: 3
title: Dynamic numbers
status: implemented
---
<Theorem id="identifier" kind="theorem" n={computedNumber}>Dynamic identifier.</Theorem>
<Theorem id="expression" kind="theorem" n={chapter + '.2'}>Dynamic expression.</Theorem>
<Theorem id="custom" kind="theorem" label="Custom" n="99.9">Override opts out.</Theorem>
`,
    );
    const result = spawnSync(process.execPath, [VALIDATE_SCRIPT], {
      cwd: tmp,
      encoding: 'utf8',
      timeout: 10_000,
    });
    assert.equal(result.status, 0, result.stderr);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ---- validate (#114, v4.21.0): <Rationale appendix> pre-flight ----

test('validate #114: <Rationale appendix> without for= fails; matching for= passes; prose "appendix" is inert', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'book-scaffold-validate-'));
  try {
    setupCleanFixture(tmp);
    setupQuestionsFixture(tmp, {
      // Bad: appendix without for= (component would throw at build).
      '01.mdx': `---
id: q-no-for
type: mcq
domain: arrays
chapter: 1
options:
  - { id: a, correct: true }
  - { id: b }
---
Stem.

<Rationale appendix>Missing anchor target.</Rationale>
`,
      // Good: appendix with for= equal to this file's id; plus the word
      // "appendix" inside a title attr must NOT trip the bare-prop anchor.
      '02.mdx': `---
id: q-good
type: mcq
domain: strings
chapter: 1
options:
  - { id: a, correct: true }
  - { id: b }
---
Stem.

<Rationale appendix for="q-good">Fine.</Rationale>

<Rationale title="See the appendix">Inline, no for= needed.</Rationale>
`,
    });
    const result = spawnSync('node', [VALIDATE_SCRIPT], { cwd: tmp, encoding: 'utf8', timeout: 10_000 });
    assert.equal(result.status, 1, `exactly the one missing-for failure expected (status=${result.status})\nstderr: ${result.stderr}`);
    assert.match(result.stderr, /<Rationale appendix> without for=/, `got stderr: ${result.stderr}`);
    assert.doesNotMatch(result.stderr, /q-good/, `the matching + prose cases must not fire; got: ${result.stderr}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('validate #114: <Rationale appendix for=> mismatching the question id fails loud (dangling anchor)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'book-scaffold-validate-'));
  try {
    setupCleanFixture(tmp);
    setupQuestionsFixture(tmp, {
      '01.mdx': `---
id: q-real
type: mcq
domain: arrays
chapter: 1
options:
  - { id: a, correct: true }
  - { id: b }
---
Stem.

<Rationale appendix for="q-typo">Copy-paste drift.</Rationale>
`,
    });
    const result = spawnSync('node', [VALIDATE_SCRIPT], { cwd: tmp, encoding: 'utf8', timeout: 10_000 });
    assert.ok(result.status > 0, `mismatched for= should fail (status=${result.status})`);
    assert.match(
      result.stderr,
      /<Rationale appendix for="q-typo"> does not match this question's id "q-real"/,
      `got stderr: ${result.stderr}`,
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ---- validate check #9 (#130): los[].anchor ↔ prose anchor-marker binding ----

/** A chapter declaring `los` objectives; `markers` lists the prose-side slugs. */
const losChapter = (declared, markers) => `---
week: 4
part: foundations
title: "LOS chapter"
status: implemented
los:
${declared.map((a, i) => `  - text: "Objective ${i + 1}"\n    anchor: ${a}`).join('\n')}
---

Intro paragraph.

${markers.map((a) => `{/* anchor: ${a} */}\n\nSection prose for ${a}.`).join('\n\n')}
`;

test('validate #9: matching los anchors and prose markers pass (#130)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'book-scaffold-validate-'));
  try {
    setupCleanFixture(tmp);
    writeFileSync(
      join(tmp, 'src', 'content', 'chapters', 'week04.mdx'),
      losChapter(['eval-metrics', 'eval-harness'], ['eval-metrics', 'eval-harness']),
    );
    const result = spawnSync('node', [VALIDATE_SCRIPT], { cwd: tmp, encoding: 'utf8', timeout: 10_000 });
    assert.equal(result.status, 0, `matched los/marker sets should pass\nstderr: ${result.stderr}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('validate #9: a declared los anchor with no prose marker fails loud (dangling objective, #130)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'book-scaffold-validate-'));
  try {
    setupCleanFixture(tmp);
    writeFileSync(
      join(tmp, 'src', 'content', 'chapters', 'week04.mdx'),
      losChapter(['eval-metrics', 'eval-harness'], ['eval-metrics']),
    );
    const result = spawnSync('node', [VALIDATE_SCRIPT], { cwd: tmp, encoding: 'utf8', timeout: 10_000 });
    assert.ok(result.status > 0, `dangling los anchor should fail (status=${result.status})`);
    assert.match(
      result.stderr,
      /los anchor "eval-harness" has no matching \{\/\* anchor: eval-harness \*\/\} marker/,
      `validate should name the dangling anchor; got stderr: ${result.stderr}`,
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('validate #9: a prose marker with no los declaration fails loud (orphan anchor, #130)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'book-scaffold-validate-'));
  try {
    setupCleanFixture(tmp);
    writeFileSync(
      join(tmp, 'src', 'content', 'chapters', 'week04.mdx'),
      losChapter(['eval-metrics'], ['eval-metrics', 'eval-rogue']),
    );
    const result = spawnSync('node', [VALIDATE_SCRIPT], { cwd: tmp, encoding: 'utf8', timeout: 10_000 });
    assert.ok(result.status > 0, `orphan prose marker should fail (status=${result.status})`);
    assert.match(
      result.stderr,
      /prose anchor marker "eval-rogue" has no matching los\[\]\.anchor/,
      `validate should name the orphan marker; got stderr: ${result.stderr}`,
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('validate #9: flow/inline-map los entries are recognized — `- { text, anchor }` (#130)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'book-scaffold-validate-'));
  try {
    setupCleanFixture(tmp);
    // YAML flow style — the same shape the questions fixtures use for options.
    // The first regex version only matched block style; flow-style anchors
    // were invisible, so every prose marker fired a spurious "orphan" error.
    writeFileSync(
      join(tmp, 'src', 'content', 'chapters', 'week04.mdx'),
      `---
week: 4
part: foundations
title: "Inline-map LOS chapter"
status: implemented
los:
  - { text: "Eval metrics", anchor: eval-metrics }
  - { anchor: eval-harness, text: "Eval harness" }
---

{/* anchor: eval-metrics */}

Section one.

{/* anchor: eval-harness */}

Section two.
`,
    );
    const result = spawnSync('node', [VALIDATE_SCRIPT], { cwd: tmp, encoding: 'utf8', timeout: 10_000 });
    assert.equal(result.status, 0, `flow-style los anchors should pass\nstderr: ${result.stderr}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('validate #9: chapters without a los key are exempt — markers alone do not fire (#130)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'book-scaffold-validate-'));
  try {
    setupCleanFixture(tmp);
    // A prose marker but NO `los:` frontmatter — the convention isn't opted
    // into, so the check must stay silent (los is consumer-defined).
    writeFileSync(
      join(tmp, 'src', 'content', 'chapters', 'week04.mdx'),
      `---
week: 4
part: foundations
title: "No-LOS chapter"
status: implemented
---

{/* anchor: free-floating */}

Prose using an anchor comment for an unrelated purpose.
`,
    );
    const result = spawnSync('node', [VALIDATE_SCRIPT], { cwd: tmp, encoding: 'utf8', timeout: 10_000 });
    assert.equal(result.status, 0, `marker without los: must not fire\nstderr: ${result.stderr}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ---- landing shadow warning (#129): consumer src/pages/index.astro ----

test('validate (#129): consumer index.astro without landing:false warns about the collision', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'book-scaffold-validate-'));
  try {
    setupCleanFixture(tmp);
    mkdirSync(join(tmp, 'src', 'pages'), { recursive: true });
    writeFileSync(join(tmp, 'src', 'pages', 'index.astro'), `---\n---\n<h1>Custom landing</h1>\n`);
    const result = spawnSync('node', [VALIDATE_SCRIPT], { cwd: tmp, encoding: 'utf8', timeout: 10_000 });
    assert.equal(result.status, 0, `warning is non-blocking — exit stays 0\nstderr: ${result.stderr}`);
    assert.match(
      result.stderr,
      /Consumer-owned landing page at src\/pages\/index\.astro/,
      `validate should warn about the landing collision; got stderr: ${result.stderr}`,
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('validate (#129): landing:false declares the override — no warning', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'book-scaffold-validate-'));
  try {
    setupCleanFixture(tmp);
    mkdirSync(join(tmp, 'src', 'pages'), { recursive: true });
    writeFileSync(join(tmp, 'src', 'pages', 'index.astro'), `---\n---\n<h1>Custom landing</h1>\n`);
    writeFileSync(
      join(tmp, 'astro.config.mjs'),
      `export default { routes: { landing: false } };\n`,
    );
    const result = spawnSync('node', [VALIDATE_SCRIPT], { cwd: tmp, encoding: 'utf8', timeout: 10_000 });
    assert.equal(result.status, 0, `clean fixture should pass\nstderr: ${result.stderr}`);
    assert.doesNotMatch(
      result.stderr,
      /Consumer-owned landing page/,
      `landing:false should silence the warning; got stderr: ${result.stderr}`,
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('validate (#126): a <Theorem id> absent from labels.json fails loud (silent-de-number guard)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'book-scaffold-validate-'));
  try {
    setupCleanFixture(tmp); // labels.json is {} — present but empty (no collapse)
    writeFileSync(
      join(tmp, 'src', 'content', 'chapters', 'week03.mdx'),
      `---
week: 3
part: foundations
title: "Themed chapter"
status: implemented
---

<Theorem id="w3:thm:missing" kind="theorem">Id not in labels.json — heading would silently de-number.</Theorem>
`,
    );
    const result = spawnSync('node', [VALIDATE_SCRIPT], { cwd: tmp, encoding: 'utf8', timeout: 10_000 });
    assert.ok(result.status > 0, `absent-id theorem should fail (status=${result.status})`);
    assert.match(
      result.stderr,
      /<Theorem id="w3:thm:missing"> — not in labels\.json/,
      `validate should name the unresolved theorem id; got stderr: ${result.stderr}`,
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ---- validate check #7 (#147): vendored sibling labels indexes ----

test('validate (#147): literal sibling targets resolve through a declared labels index', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'book-scaffold-validate-'));
  try {
    setupCleanFixture(tmp);
    mkdirSync(join(tmp, 'vendor'), { recursive: true });
    writeFileSync(
      join(tmp, 'vendor', 'design-labels.json'),
      JSON.stringify({
        'heading:chapters/patterns#layered': {
          href: 'chapters/patterns#layered',
          display: 'Section “Layered systems”',
          number: null,
        },
        'heading:chapters/alternate#layered': {
          href: 'chapters/alternate#layered',
          display: 'Layered (another chapter)',
          number: null,
        },
      }),
    );
    setupSiblingConfig(tmp, {
      design: {
        url: 'https://hub.example/library/design/',
        labels: './vendor/design-labels.json',
      },
    });
    writeBookLinkChapter(
      tmp,
      `<BookLink title="2 > 1" book="design" to="/chapters/patterns/#layered">Quoted target after a greater-than sign.</BookLink>

<BookLink book={'design'} to={\`chapters/patterns#layered\`}>Braced literals.</BookLink>

<BookLink disabled={count > 1} book="design" to="chapters/alternate#layered">Same fragment after an expression.</BookLink>

<BookLink note={'book="missing" to="chapters/wrong#fake"'} book={'design'} to={'chapters/patterns\\u0023layered'}>Unrelated prop text and a decoded JS escape.</BookLink>

<BookLink book="design" to="chapters/patterns&#35;layered">Decoded entity.</BookLink>

\`<BookLink book="missing" to="chapters/wrong#fake" />\`

\`\`\`mdx
<BookLink book="missing" to="chapters/wrong#fake" />
\`\`\``,
    );

    const result = spawnSync(process.execPath, [VALIDATE_SCRIPT], {
      cwd: tmp,
      encoding: 'utf8',
      timeout: 30_000,
    });
    assert.equal(result.status, 0, `stdout: ${result.stdout}\nstderr: ${result.stderr}`);
    assert.doesNotMatch(result.stderr, /BookLink.*skipped/);
    assert.doesNotMatch(result.stderr, /book="missing"/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('validate (#147): unknown anchors, wrong sibling paths, and unknown books fail loud', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'book-scaffold-validate-'));
  try {
    setupCleanFixture(tmp);
    mkdirSync(join(tmp, 'vendor'), { recursive: true });
    writeFileSync(
      join(tmp, 'vendor', 'design-labels.json'),
      JSON.stringify({
        'heading:chapters/patterns#layered': { href: 'chapters/patterns#layered' },
      }),
    );
    setupSiblingConfig(tmp, {
      design: {
        url: 'https://design.example',
        labels: './vendor/design-labels.json',
      },
    });
    writeBookLinkChapter(
      tmp,
      `<BookLink book="design" to="chapters/patterns/#layerd">Typo.</BookLink>
<BookLink book="design" to="chapters/wrong/#layered">Wrong path.</BookLink>
<BookLink book="missing" to="chapters/patterns/#layered">Unknown book.</BookLink>`,
    );

    const result = spawnSync(process.execPath, [VALIDATE_SCRIPT], {
      cwd: tmp,
      encoding: 'utf8',
      timeout: 30_000,
    });
    assert.equal(result.status, 3, result.stderr);
    assert.match(result.stderr, /fragment "layerd" is not in \.\/vendor\/design-labels\.json/);
    assert.match(
      result.stderr,
      /path\/fragment does not match.*indexes "layered" at "chapters\/patterns#layered"/s,
    );
    assert.match(result.stderr, /book="missing".*not in evaluated defineBookConfig siblingBooks \(design\)/s);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('validate (#147): every declared missing or malformed sibling index is an error', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'book-scaffold-validate-'));
  try {
    setupCleanFixture(tmp);
    mkdirSync(join(tmp, 'vendor'), { recursive: true });
    writeFileSync(join(tmp, 'vendor', 'malformed.json'), '{ not valid JSON');
    setupSiblingConfig(tmp, {
      missing: { url: 'https://missing.example', labels: './vendor/missing.json' },
      malformed: { url: 'https://malformed.example', labels: './vendor/malformed.json' },
    });

    const result = spawnSync(process.execPath, [VALIDATE_SCRIPT], {
      cwd: tmp,
      encoding: 'utf8',
      timeout: 30_000,
    });
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /siblingBooks\.missing\.labels.*missing, unreadable, or invalid/);
    assert.match(result.stderr, /siblingBooks\.malformed\.labels.*missing, unreadable, or invalid/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('validate (#147): dynamic props and URL-only entries warn and skip explicitly', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'book-scaffold-validate-'));
  try {
    setupCleanFixture(tmp);
    setupSiblingConfig(tmp, { legacy: 'https://legacy.example/books/design/' });
    writeBookLinkChapter(
      tmp,
      `<BookLink book="legacy" to="chapters/patterns/#layered">URL-only.</BookLink>
<BookLink book={selectedBook} to="chapters/patterns/#layered">Dynamic book.</BookLink>
<BookLink book="legacy" to={selectedTarget}>Dynamic target.</BookLink>
<BookLink {...linkProps}>Dynamic spread.</BookLink>`,
    );

    const result = spawnSync(process.execPath, [VALIDATE_SCRIPT], {
      cwd: tmp,
      encoding: 'utf8',
      timeout: 30_000,
    });
    assert.equal(result.status, 0, `stdout: ${result.stdout}\nstderr: ${result.stderr}`);
    assert.match(result.stderr, /siblingBooks entry is URL-only/);
    assert.match(result.stderr, /dynamic book= expression/);
    assert.match(result.stderr, /dynamic to= expression/);
    assert.match(result.stderr, /dynamic prop spread/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('validate (#186/#175): deleted artifacts self-heal with composed per-kind numbering', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'book-scaffold-validate-'));
  try {
    const chapters = join(tmp, 'src', 'content', 'chapters');
    mkdirSync(chapters, { recursive: true });
    writeFileSync(
      join(tmp, 'astro.config.mjs'),
      `import { defineBookConfig, minimalStyle } from ${JSON.stringify(DIST_INDEX_URL)};\n` +
        `export default await defineBookConfig({ styles: [minimalStyle], numberStyle: 'per-kind', site: 'https://test.invalid' });\n`,
    );
    writeFileSync(
      join(chapters, 'week03.mdx'),
      `---
week: 3
title: Self heal
status: implemented
---
<Theorem id="heal:thm:a" kind="theorem">A.</Theorem>
<Theorem id="heal:prop:a" kind="proposition">B.</Theorem>
<Theorem id="heal:thm:b" kind="theorem">C.</Theorem>
<XRef id="heal:prop:a" />
`,
    );
    const result = spawnSync(process.execPath, [VALIDATE_SCRIPT], {
      cwd: tmp,
      encoding: 'utf8',
      timeout: 30_000,
    });
    assert.equal(result.status, 0, `stdout: ${result.stdout}\nstderr: ${result.stderr}`);
    assert.match(result.stdout, /regenerating via build-labels\.mjs/);
    assert.match(result.stdout, /regenerating via build-bib\.mjs/);
    assert.match(result.stdout, /number-style=per-kind/);
    const labels = JSON.parse(readFileSync(join(tmp, 'src', 'data', 'labels.json'), 'utf8'));
    assert.equal(labels['heal:thm:a'].number, '3.1');
    assert.equal(labels['heal:prop:a'].number, '3.1');
    assert.equal(labels['heal:thm:b'].number, '3.2');
    assert.deepEqual(JSON.parse(readFileSync(join(tmp, 'src', 'data', 'references.json'), 'utf8')), {});
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('validate (#186): build-bib self-heal reads BOOK_BIB_PATH from root .env', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'book-scaffold-validate-'));
  try {
    const chapters = join(tmp, 'src', 'content', 'chapters');
    const bibDir = join(tmp, 'references');
    mkdirSync(chapters, { recursive: true });
    mkdirSync(bibDir, { recursive: true });
    writeFileSync(
      join(tmp, 'astro.config.mjs'),
      `import { defineBookConfig, academicStyle } from ${JSON.stringify(DIST_INDEX_URL)};\n` +
        `export default await defineBookConfig({ styles: [academicStyle], site: 'https://test.invalid' });\n`,
    );
    writeFileSync(join(tmp, '.env'), 'BOOK_BIB_PATH=references/custom.bib\n');
    writeFileSync(
      join(bibDir, 'custom.bib'),
      '@article{healed2026, title={Healed bibliography}, author={Ada Lovelace}, year={2026}}\n',
    );
    writeFileSync(
      join(chapters, 'week01.mdx'),
      `---
week: 1
part: foundations
title: Bibliography heal
status: implemented
---
See <Cite key="healed2026" />.
`,
    );
    const result = spawnSync(process.execPath, [VALIDATE_SCRIPT], {
      cwd: tmp,
      encoding: 'utf8',
      timeout: 30_000,
    });
    assert.equal(result.status, 0, `stdout: ${result.stdout}\nstderr: ${result.stderr}`);
    const references = JSON.parse(
      readFileSync(join(tmp, 'src', 'data', 'references.json'), 'utf8'),
    );
    assert.equal(references.healed2026.title, 'Healed bibliography');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('validate (#186): child generation failures propagate original diagnostics and exit', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'book-scaffold-validate-'));
  try {
    const chapters = join(tmp, 'src', 'content', 'chapters');
    mkdirSync(chapters, { recursive: true });
    writeFileSync(
      join(chapters, 'week01.mdx'),
      `---
week: 1
title: Broken generation
status: implemented
---
<Theorem id="broken" kind="thereom">Typo.</Theorem>
`,
    );
    const result = spawnSync(process.execPath, [VALIDATE_SCRIPT], {
      cwd: tmp,
      encoding: 'utf8',
      timeout: 30_000,
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /kind="thereom" is not one of/);
    assert.match(result.stderr, /build-labels\.mjs failed.*cannot self-heal/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('validate (#179): invalid schema preset and Astro config evaluation errors fail loudly', () => {
  for (const mode of ['schema', 'astro']) {
    const tmp = mkdtempSync(join(tmpdir(), 'book-scaffold-validate-'));
    try {
      setupCleanFixture(tmp);
      if (mode === 'schema') {
        writeFileSync(
          join(tmp, 'src', 'content.config.ts'),
          `defineBookSchemas({ preset: 'bogus' });\n`,
        );
      } else {
        writeFileSync(join(tmp, 'astro.config.mjs'), 'throw new Error("config fixture exploded");\n');
      }
      const result = spawnSync(process.execPath, [VALIDATE_SCRIPT], {
        cwd: tmp,
        encoding: 'utf8',
        timeout: 30_000,
        env: Object.fromEntries(
          Object.entries(process.env).filter(([key]) => key !== 'BOOK_PRESET' && key !== 'BOOK_PROFILE'),
        ),
      });
      assert.notEqual(result.status, 0);
      if (mode === 'schema') assert.match(result.stderr, /preset must be one of.*bogus/);
      else assert.match(result.stderr, /failed to evaluate.*config fixture exploded/);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }
});
