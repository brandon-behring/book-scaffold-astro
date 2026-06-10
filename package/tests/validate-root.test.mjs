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
