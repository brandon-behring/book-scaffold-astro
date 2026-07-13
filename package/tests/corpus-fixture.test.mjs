import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

const execFileAsync = promisify(execFile);
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(packageRoot, '..');
const fixture = join(packageRoot, 'tests', 'fixtures', 'corpus');
const astro = join(repoRoot, 'node_modules', '.bin', 'astro');
const pagefind = join(repoRoot, 'node_modules', '.bin', 'pagefind');

async function run(binary, args, env = {}) {
  return execFileAsync(binary, args, {
    cwd: fixture,
    env: { ...process.env, ...env },
    maxBuffer: 8 * 1024 * 1024,
  });
}

async function html(outDir, route = '') {
  return readFile(join(outDir, route, 'index.html'), 'utf8');
}

async function cleanupGenerated() {
  await rm(join(fixture, '.astro'), { recursive: true, force: true });
  await rm(join(fixture, 'node_modules'), { recursive: true, force: true });
}

function assertLocalUrlsUseBase(source, base) {
  for (const match of source.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const target = match[1];
    if (target.startsWith('/') && !target.startsWith('//')) {
      assert.ok(target.startsWith(base), `local URL escaped ${base}: ${target}`);
    }
  }
}

async function assertPagefindBookFilter(outDir) {
  const filterDir = join(outDir, 'pagefind', 'filter');
  const files = await readdir(filterDir);
  const decoded = (
    await Promise.all(
      files.map(async (file) => gunzipSync(await readFile(join(filterDir, file))).toString('utf8')),
    )
  ).join('\n');
  assert.match(decoded, /book/);
  assert.match(decoded, /evaluation/);
  assert.match(decoded, /llm-app-engineering/);
}

async function assertPagefindResultUrls(outDir, base) {
  const fragmentDir = join(outDir, 'pagefind', 'fragment');
  const files = await readdir(fragmentDir);
  const decoded = (
    await Promise.all(
      files.map(async (file) => gunzipSync(await readFile(join(fragmentDir, file))).toString('utf8')),
    )
  ).join('\n');
  assert.ok(
    decoded.includes(`${base}chapters/evaluation/shared/`),
    `Pagefind omitted ${base} from the evaluation result URL`,
  );
  assert.ok(
    decoded.includes(`${base}chapters/llm-app-engineering/shared/`),
    `Pagefind omitted ${base} from the LLM result URL`,
  );
}

test('two-book corpus emits isolated root and /canary/ route graphs with Pagefind filters', async () => {
  const rootOut = join(fixture, '.test-dist-root');
  const canaryOut = join(fixture, '.test-dist-canary');
  await rm(rootOut, { recursive: true, force: true });
  await rm(canaryOut, { recursive: true, force: true });

  try {
    await run(astro, ['build'], { CORPUS_OUT_DIR: './.test-dist-root', CORPUS_BASE: '/' });
    await run(pagefind, ['--site', '.test-dist-root']);

    const requiredRoutes = [
      '',
      'chapters',
      'chapters/evaluation',
      'chapters/llm-app-engineering',
      'chapters/evaluation/shared',
      'chapters/llm-app-engineering/shared',
      'evaluation',
      'llm-app-engineering',
      'evaluation/references',
      'llm-app-engineering/references',
      'evaluation/print',
      'llm-app-engineering/print',
      'evaluation/practice-exam',
      'evaluation/glossary',
      'llm-app-engineering/glossary',
      'evaluation/answers',
      'llm-app-engineering/tips',
      'llm-app-engineering/exercises',
      'llm-app-engineering/flashcards',
      'search',
    ];
    await Promise.all(requiredRoutes.map((route) => html(rootOut, route)));
    await assert.rejects(() => html(rootOut, 'llm-app-engineering/practice-exam'), /ENOENT/);
    await assert.rejects(() => html(rootOut, 'evaluation/flashcards'), /ENOENT/);
    await assert.rejects(() => html(rootOut, 'evaluation/tips'), /ENOENT/);

    const root = await html(rootOut);
    assert.match(root, /Evaluation Engineering/);
    assert.match(root, /LLM Application Engineering/);
    assert.doesNotMatch(root, /Shared Evaluation Chapter|Shared LLM Chapter/);
    assert.match(root, /data-pagefind-filter="surface:corpus"/);

    const evaluationIndex = await html(rootOut, 'chapters/evaluation');
    const llmIndex = await html(rootOut, 'chapters/llm-app-engineering');
    assert.match(evaluationIndex, /Shared Evaluation Chapter/);
    assert.doesNotMatch(evaluationIndex, /Shared LLM Chapter/);
    assert.match(llmIndex, /Shared LLM Chapter/);
    assert.doesNotMatch(llmIndex, /Shared Evaluation Chapter/);

    const evaluationChapter = await html(rootOut, 'chapters/evaluation/shared');
    const llmChapter = await html(rootOut, 'chapters/llm-app-engineering/shared');
    assert.match(evaluationChapter, /Evaluation-only sentinel/);
    assert.match(evaluationChapter, /Evaluation Theorem 1\.1/);
    assert.match(evaluationChapter, /Evaluation-only reference sentinel/);
    assert.match(evaluationChapter, /href="\/chapters\/llm-app-engineering\/shared\/#llm-heading"/);
    assert.doesNotMatch(evaluationChapter, /Shared LLM Chapter|LLM Theorem 7\.2|LLM-only sentinel/);
    assert.match(evaluationChapter, /data-pagefind-filter="book:evaluation"/);
    assert.match(llmChapter, /LLM-only sentinel/);
    assert.match(llmChapter, /LLM Theorem 7\.2/);
    assert.match(llmChapter, /LLM-only reference sentinel/);
    assert.doesNotMatch(llmChapter, /Shared Evaluation Chapter|Evaluation Theorem 1\.1|Evaluation-only sentinel/);
    assert.match(llmChapter, /data-pagefind-filter="book:llm-app-engineering"/);

    const evaluationReferences = await html(rootOut, 'evaluation/references');
    const llmReferences = await html(rootOut, 'llm-app-engineering/references');
    assert.match(evaluationReferences, /Evaluation-only reference sentinel/);
    assert.doesNotMatch(evaluationReferences, /LLM-only reference sentinel/);
    assert.match(llmReferences, /LLM-only reference sentinel/);
    assert.doesNotMatch(llmReferences, /Evaluation-only reference sentinel/);

    const evaluationGlossary = await html(rootOut, 'evaluation/glossary');
    const llmGlossary = await html(rootOut, 'llm-app-engineering/glossary');
    assert.match(evaluationGlossary, /Evaluation Shared Term/);
    assert.doesNotMatch(evaluationGlossary, /LLM Shared Term/);
    assert.match(llmGlossary, /LLM Shared Term/);
    assert.doesNotMatch(llmGlossary, /Evaluation Shared Term/);
    assert.match(evaluationGlossary, /id="term-shared"/);
    assert.match(llmGlossary, /id="term-shared"/);

    const bank = await html(rootOut, 'evaluation/practice-exam');
    const answers = await html(rootOut, 'evaluation/answers');
    assert.match(bank, /Evaluation answer/);
    assert.doesNotMatch(bank, /LLM-only question sentinel|LLM answer/);
    assert.match(answers, /Evaluation-only rationale sentinel/);
    assert.doesNotMatch(answers, /LLM-only question sentinel|LLM answer/);

    const evaluationPrint = await html(rootOut, 'evaluation/print');
    const llmPrint = await html(rootOut, 'llm-app-engineering/print');
    assert.match(evaluationPrint, /Evaluation-only sentinel/);
    assert.doesNotMatch(evaluationPrint, /LLM-only sentinel/);
    assert.match(llmPrint, /LLM-only sentinel/);
    assert.doesNotMatch(llmPrint, /Evaluation-only sentinel/);

    const search = await html(rootOut, 'search');
    assert.match(search, /<option value="evaluation">Evaluation Engineering<\/option>/);
    assert.match(search, /<option value="llm-app-engineering">LLM Application Engineering<\/option>/);
    assert.match(search, /triggerFilters\(\{ book: \[selectedBook\] \}\)/);
    assert.doesNotMatch(search, /Search · book-template-astro/);
    await assertPagefindBookFilter(rootOut);

    await run(astro, ['build'], {
      CORPUS_OUT_DIR: './.test-dist-canary',
      CORPUS_BASE: '/canary/',
    });
    await run(pagefind, ['--site', '.test-dist-canary']);
    const canaryRoot = await html(canaryOut);
    const canaryChapter = await html(canaryOut, 'chapters/evaluation/shared');
    const canarySearch = await html(canaryOut, 'search');
    assert.match(canaryRoot, /href="\/canary\/evaluation\/"/);
    assert.match(canaryChapter, /href="\/canary\/evaluation\/references\/#shared2026"/);
    assert.match(canarySearch, /src="\/canary\/pagefind\/pagefind-ui\.js"/);
    assertLocalUrlsUseBase(canaryRoot, '/canary/');
    assertLocalUrlsUseBase(canaryChapter, '/canary/');
    assertLocalUrlsUseBase(canarySearch, '/canary/');
    await assertPagefindBookFilter(canaryOut);
    await assertPagefindResultUrls(canaryOut, '/canary/');
  } finally {
    await rm(rootOut, { recursive: true, force: true });
    await rm(canaryOut, { recursive: true, force: true });
    await cleanupGenerated();
  }
});

test('corpus content sync rejects a frontmatter book that disagrees with path ownership', async () => {
  const mismatch = join(fixture, 'src', 'content', 'evaluation', 'mismatch.mdx');
  await writeFile(
    mismatch,
    `---\ntitle: Mismatch\nbook: llm-app-engineering\nlast_verified: 2026-07-13\n---\nMismatch.\n`,
    'utf8',
  );
  try {
    await assert.rejects(
      () => run(astro, ['sync']),
      (error) => {
        const output = `${error.stdout ?? ''}\n${error.stderr ?? ''}`;
        assert.match(output, /frontmatter book "llm-app-engineering"/);
        assert.match(output, /path owner is "evaluation"/);
        return true;
      },
    );
  } finally {
    await rm(mismatch, { force: true });
    await cleanupGenerated();
  }
});

test('corpus question and glossary roots reject orphan and unknown-book entries', async () => {
  const cases = [
    {
      entry: 'src/content/questions/orphan.mdx',
      label: 'Question',
      body: `---\nid: orphan\ntype: mcq\nchapter: shared\ndomain: engineering\noptions:\n  - id: a\n    correct: true\n    text: A\n  - id: b\n    text: B\n---\nOrphan question.\n`,
    },
    {
      entry: 'src/content/questions/unknown/orphan.mdx',
      label: 'Question',
      body: `---\nid: orphan\ntype: mcq\nchapter: shared\ndomain: engineering\noptions:\n  - id: a\n    correct: true\n    text: A\n  - id: b\n    text: B\n---\nUnknown-book question.\n`,
    },
    {
      entry: 'src/content/glossary/orphan.mdx',
      label: 'Glossary term',
      body: `---\nterm: Orphan\n---\nOrphan glossary term.\n`,
    },
    {
      entry: 'src/content/glossary/unknown/orphan.mdx',
      label: 'Glossary term',
      body: `---\nterm: Unknown\n---\nUnknown-book glossary term.\n`,
    },
  ];

  for (const { entry, label, body } of cases) {
    const target = join(fixture, entry);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, body, 'utf8');
    try {
      await assert.rejects(
        () => run(astro, ['sync']),
        (error) => {
          const output = `${error.stdout ?? ''}\n${error.stderr ?? ''}`;
          assert.match(output, new RegExp(`${label}.*outside the registered corpus books`));
          return true;
        },
      );
    } finally {
      await rm(target, { force: true });
      if (entry.includes('/unknown/')) {
        await rm(dirname(target), { recursive: true, force: true });
      }
      await cleanupGenerated();
    }
  }
});

test('runtime consumers reject apparatus links narrowed out by the current book', async () => {
  const guardOut = join(fixture, '.test-dist-guard');
  await rm(guardOut, { recursive: true, force: true });
  try {
    await assert.rejects(
      () =>
        run(astro, ['build'], {
          CORPUS_OUT_DIR: './.test-dist-guard',
          PUBLIC_CORPUS_GUARD_PROBE: '1',
        }),
      (error) => {
        const output = `${error.stdout ?? ''}\n${error.stderr ?? ''}`;
        assert.match(output, /TipsCard.*current corpus book's tips route/);
        return true;
      },
    );
  } finally {
    await rm(guardOut, { recursive: true, force: true });
    await cleanupGenerated();
  }
});

test('global corpus surfaces cannot make book-local study components load all books', async () => {
  const components = ['ObjectiveMap.astro', 'AssessmentTest.astro', 'PartReview.astro'];
  for (const component of components) {
    const source = await readFile(join(packageRoot, 'components', component), 'utf8');
    assert.match(source, /bookConfig\.corpus && !currentBook/);
    assert.match(source, /requires a canonical corpus book route/);
  }
  const term = await readFile(join(packageRoot, 'components', 'Term.astro'), 'utf8');
  assert.match(term, /!currentBook/);
  assert.match(term, /current corpus book's glossary route/);
});
