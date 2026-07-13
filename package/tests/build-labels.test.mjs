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
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(__dirname, '..', 'scripts', 'build-labels.mjs');
const FIXTURE_CHAPTER = resolve(__dirname, 'fixtures', 'chapters', 'valid-academic.mdx');
const SLUG_FIXTURE = resolve(__dirname, 'fixtures', 'chapters', 'slug-override.mdx');
const KINDS_FIXTURE = resolve(__dirname, 'fixtures', 'chapters', 'theorem-kinds.mdx');
const BAD_KIND_FIXTURE = resolve(__dirname, 'fixtures', 'chapters', 'bad-theorem-kind.mdx');
const OVERRIDE_NOKIND_FIXTURE = resolve(__dirname, 'fixtures', 'chapters', 'theorem-override-nokind.mdx');
const NO_KIND_FIXTURE = resolve(__dirname, 'fixtures', 'chapters', 'bad-theorem-nokind.mdx');
const NO_CHAPTER_FIXTURE = resolve(__dirname, 'fixtures', 'chapters', 'theorem-no-chapter.mdx');
const NUMBER_STYLES_FIXTURE = resolve(__dirname, 'fixtures', 'chapters', 'theorem-number-styles.mdx');
const HEADING_ANCHORS_FIXTURE = resolve(__dirname, 'fixtures', 'chapters', 'heading-anchors.mdx');
const DIST_INDEX_URL = pathToFileURL(resolve(__dirname, '..', 'dist', 'index.mjs')).href;

function headingLabel(labels, href) {
  return labels[`heading:${href}`];
}

/** Run build-labels.mjs in a temp consumer. String fixtures copy flat; an
 *  object `{ path, destination }` can exercise nested content entry IDs. */
function runInTempDir(fixturePaths = [FIXTURE_CHAPTER], config = {}) {
  // Preserve the historical helper call used by the numberStyle tests.
  if (typeof config === 'string') config = { numberStyle: config };
  const tmp = mkdtempSync(join(tmpdir(), 'book-scaffold-test-'));
  try {
    const chaptersDir = join(tmp, 'src', 'content', 'chapters');
    mkdirSync(chaptersDir, { recursive: true });
    for (const fixture of fixturePaths) {
      const fp = typeof fixture === 'string' ? fixture : fixture.path;
      const destination = typeof fixture === 'string'
        ? fp.split('/').pop()
        : fixture.destination;
      const target = join(chaptersDir, destination);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(fp, target);
    }
    if (config.numberStyle || config.chapterRoute || config.bookField) {
      const options = {
        ...(config.numberStyle ? { numberStyle: config.numberStyle } : {}),
        ...(config.chapterRoute ? { chapterRoute: config.chapterRoute } : {}),
        ...(config.bookField ? { bookField: config.bookField } : {}),
      };
      writeFileSync(
        join(tmp, 'astro.config.mjs'),
        `import { defineBookConfig, minimalStyle } from ${JSON.stringify(DIST_INDEX_URL)};\n` +
          `const options = ${JSON.stringify(options)};\n` +
          `export default await defineBookConfig({ styles: [minimalStyle], ...options, site: 'https://test.invalid' });\n`,
      );
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

test('build-labels: href shape is base-less chapters/<slug>#<id> (#142)', () => {
  // #142: labels.json stores a base-less ref (no leading slash); XRef.astro
  // prefixes BASE_URL at render so one artifact serves any deploy base.
  const labels = runInTempDir();
  assert.equal(
    labels['w4:thm:stability'].href,
    'chapters/valid-academic#w4:thm:stability',
  );
});

test('build-labels: frontmatter slug: overrides the filename in the href (v4.9.0)', () => {
  // slug-override.mdx has filename `slug-override` but `slug: clean-name`.
  // The href must use the slug (matching Astro's entry.id), NOT the filename.
  const labels = runInTempDir([SLUG_FIXTURE]);
  assert.equal(
    labels['slug:thm:demo'].href,
    'chapters/clean-name#slug:thm:demo',
  );
});

test('#147: h2–h6 use Astro heading text and GitHub duplicate slugs', () => {
  const labels = runInTempDir([HEADING_ANCHORS_FIXTURE]);

  // h1 is the chapter title and deliberately not a cross-chapter anchor.
  assert.equal(headingLabel(labels, 'chapters/heading-anchors#chapter-title-is-not-indexed'), undefined);
  assert.equal(labels['build--verify'], undefined, 'heading keys are path-qualified and opaque');
  assert.deepEqual(headingLabel(labels, 'chapters/heading-anchors#build--verify'), {
    href: 'chapters/heading-anchors#build--verify',
    display: 'Build & Verify',
    number: null,
  });
  assert.equal(
    headingLabel(labels, 'chapters/heading-anchors#the-ultrathink-keyword').display,
    'The ultrathink keyword',
  );
  assert.equal(
    headingLabel(labels, 'chapters/heading-anchors#adrs-the-why-one-decision-at-a-time').display,
    'ADRs: the why, one decision at a time',
  );
  assert.equal(headingLabel(labels, 'chapters/heading-anchors#link-text').display, 'Link text');

  // Astro smartypants turns `--` into an em dash before its heading collector;
  // GitHubSlugger removes the punctuation but preserves the surrounding spaces.
  assert.equal(headingLabel(labels, 'chapters/heading-anchors#a--b').display, 'A — B');
  assert.equal(headingLabel(labels, 'chapters/heading-anchors#repeat').href, 'chapters/heading-anchors#repeat');
  assert.equal(headingLabel(labels, 'chapters/heading-anchors#repeat-1').href, 'chapters/heading-anchors#repeat-1');
  assert.equal(headingLabel(labels, 'chapters/heading-anchors#repeat-2').href, 'chapters/heading-anchors#repeat-2');
});

test('#147: nested chapter IDs survive the default /chapters/:id/ route', () => {
  const labels = runInTempDir([
    { path: HEADING_ANCHORS_FIXTURE, destination: 'part-one/heading-anchors.mdx' },
  ]);
  assert.equal(
    headingLabel(labels, 'chapters/part-one/heading-anchors#build--verify').href,
    'chapters/part-one/heading-anchors#build--verify',
  );
});

test('#147: identical headings in separate chapters remain separately indexed', () => {
  const labels = runInTempDir([
    { path: HEADING_ANCHORS_FIXTURE, destination: 'part-one/heading-anchors.mdx' },
    { path: HEADING_ANCHORS_FIXTURE, destination: 'part-two/heading-anchors.mdx' },
  ]);
  assert.equal(
    headingLabel(labels, 'chapters/part-one/heading-anchors#repeat').display,
    'Repeat',
  );
  assert.equal(
    headingLabel(labels, 'chapters/part-two/heading-anchors#repeat').display,
    'Repeat',
  );
});

test('#147: evaluated root chapterRoute replaces the historical /chapters/ prefix', () => {
  const labels = runInTempDir([HEADING_ANCHORS_FIXTURE], { chapterRoute: '/:id/' });
  assert.equal(
    headingLabel(labels, 'heading-anchors#build--verify').href,
    'heading-anchors#build--verify',
  );
});

test('#147: chapterRoute :book/:slug tokens honor the evaluated bookField', () => {
  const labels = runInTempDir(
    [{ path: HEADING_ANCHORS_FIXTURE, destination: 'design/heading-anchors.mdx' }],
    { chapterRoute: '/:book/:slug/', bookField: 'series' },
  );
  assert.equal(
    headingLabel(labels, 'design/heading-anchors#build--verify').href,
    'design/heading-anchors#build--verify',
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

// ===== #126: structured number + kind-aware display word =====

test('build-labels: emits a structured number field for auto-counted entries (#126)', () => {
  const labels = runInTempDir();
  // Theorem.astro reads `number` by id and renders it, so heading == xref.
  assert.equal(labels['w4:thm:stability'].number, '4.1');
  assert.equal(labels['w4:fig:phase-portrait'].number, '4.1');
  assert.equal(labels['w4:ex:harmonic'].number, '4.1');
});

test('build-labels: a label override → custom display, number is null (#126)', () => {
  const labels = runInTempDir();
  // An override opts out of auto-numbering; number:null → the heading shows no
  // number rather than mis-parsing the custom string into a wrong one.
  assert.equal(labels['w4:thm:convergence'].display, 'Convergence (custom)');
  assert.equal(labels['w4:thm:convergence'].number, null);
});

test('build-labels: <Theorem kind> is kind-aware and shares one counter (#126)', () => {
  const labels = runInTempDir([KINDS_FIXTURE]);
  // Shared <Theorem> counter — one amsthm sequence 9.1 / 9.2 / 9.3 ...
  assert.equal(labels['w9:thm:main'].number, '9.1');
  assert.equal(labels['w9:prop:dual'].number, '9.2');
  assert.equal(labels['w9:lem:helper'].number, '9.3');
  // ... but the display WORD is the actual kind, not a kind-blind "Theorem".
  assert.equal(labels['w9:thm:main'].display, 'Theorem 9.1');
  assert.equal(labels['w9:prop:dual'].display, 'Proposition 9.2');
  assert.equal(labels['w9:lem:helper'].display, 'Lemma 9.3'); // legacy type=
});

test('build-labels (#175): per-kind sequences repeat and interleave independently', () => {
  const labels = runInTempDir([NUMBER_STYLES_FIXTURE], 'per-kind');
  assert.equal(labels['w9:thm:a'].number, '9.1');
  assert.equal(labels['w9:prop:a'].number, '9.1');
  assert.equal(labels['w9:lem:a'].number, '9.1');
  assert.equal(labels['w9:thm:b'].number, '9.2');
  assert.equal(labels['w9:prop:b'].number, '9.2');
});

test('build-labels (#175): shared remains the default and label overrides consume no number', () => {
  const labels = runInTempDir([NUMBER_STYLES_FIXTURE]);
  assert.equal(labels['w9:thm:a'].number, '9.1');
  assert.equal(labels['w9:prop:a'].number, '9.2');
  assert.equal(labels['w9:custom'].number, null);
  assert.equal(labels['w9:lem:a'].number, '9.3');
  assert.equal(labels['w9:thm:b'].number, '9.4');
  assert.equal(labels['w9:prop:b'].number, '9.5');
});

test('build-labels: an unknown <Theorem> kind FAILS the build (#126, #121 contract)', () => {
  let threw = false;
  let stderr = '';
  try {
    runInTempDir([BAD_KIND_FIXTURE]);
  } catch (err) {
    threw = true;
    stderr = String(err.stderr ?? '') + String(err.message ?? '');
  }
  assert.ok(threw, 'build-labels should exit non-zero on an unknown kind');
  assert.match(stderr, /thereom|not one of/);
});

test('build-labels: a label= override needs no kind — no throw, number null (#126)', () => {
  // Regression guard: computing the kind-aware word for an override entry would
  // throw on this documented kindless `<Theorem id label="…">` form. The word
  // is discarded for overrides, so it must not be resolved/validated.
  const labels = runInTempDir([OVERRIDE_NOKIND_FIXTURE]);
  assert.equal(labels['w9:ovr:custom'].display, 'Custom display');
  assert.equal(labels['w9:ovr:custom'].number, null);
});

test('build-labels: an id <Theorem> with no kind and no label throws "no kind=" (#126)', () => {
  let stderr = '';
  try {
    runInTempDir([NO_KIND_FIXTURE]);
  } catch (err) {
    stderr = String(err.stderr ?? '') + String(err.message ?? '');
  }
  // The fix normalizes the absent attr to undefined so the message is the
  // actionable "no kind=", not the misleading kind="null" (extractAttr → null).
  assert.match(stderr, /no kind=/);
  assert.doesNotMatch(stderr, /kind="null"/);
});

test('build-labels: no week/chapter frontmatter → bare-counter number, kind-aware (#126)', () => {
  const labels = runInTempDir([NO_CHAPTER_FIXTURE]);
  assert.equal(labels['nochap:thm:a'].number, '1');
  assert.equal(labels['nochap:thm:a'].display, 'Theorem 1');
  assert.equal(labels['nochap:lem:b'].number, '2');
  assert.equal(labels['nochap:lem:b'].display, 'Lemma 2'); // shared counter, kind-aware
});
