import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  QA_PRESETS,
  SCAFFOLD_MDX_COMPONENTS,
  QaExecutionError,
  qaExitCode,
  renderQaHuman,
  renderQaJson,
  runQa,
} from '../scripts/qa-core.mjs';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(TEST_DIR, 'fixtures/qa');

const CORPUS = Object.freeze({
  __bookCorpusVersion: 1,
  preset: 'minimal',
  books: Object.freeze([
    Object.freeze({ id: 'alpha', title: 'Alpha' }),
    Object.freeze({ id: 'beta', title: 'Beta' }),
  ]),
});

function config(preset, corpus = null) {
  return {
    preset,
    numberStyle: 'shared',
    siblingBooks: {},
    corpus,
    chapterRoute: '/chapters/:id/',
    bookField: 'book',
    apparatusRoute: corpus ? '/:book/:route/' : '/:route/',
    apparatusRoutes: [],
    base: '/',
    integrationFound: true,
  };
}

function validation(preset, {
  corpus = null,
  selectedBooks = corpus?.books ?? [],
  errors = [],
  warnings = [],
  fatal = null,
} = {}) {
  return {
    preset,
    corpus,
    selectedBooks,
    errors,
    warnings,
    fatal,
    toolingConfig: config(preset, corpus),
  };
}

function schemaValidator({ value, schema }) {
  const missing = (schema.required ?? []).filter(
    (key) => !Object.prototype.hasOwnProperty.call(value, key),
  );
  return missing.length === 0
    ? { valid: true, errors: [] }
    : {
        valid: false,
        errors: missing.map((key) => ({
          instancePath: '/',
          message: `must have required property ${JSON.stringify(key)}`,
        })),
      };
}

function singleOptions(preset = 'minimal', extra = {}) {
  const root = resolve(FIXTURES, 'single');
  return {
    root,
    chaptersRoot: resolve(root, 'src/content/chapters'),
    validationResult: validation(preset),
    toolingConfig: config(preset),
    validateJsonSchema: schemaValidator,
    ...extra,
  };
}

function corpusOptions({ selectedBooks = CORPUS.books, root = resolve(FIXTURES, 'corpus'), ...extra } = {}) {
  return {
    root,
    chaptersRoot: resolve(root, 'src/content'),
    argv: selectedBooks.length === 1 ? ['--book', selectedBooks[0].id] : [],
    validationResult: validation('minimal', { corpus: CORPUS, selectedBooks }),
    toolingConfig: config('minimal', CORPUS),
    validateJsonSchema: schemaValidator,
    ...extra,
  };
}

test('#158: all five presets emit deterministic schema-v1 and human results', async () => {
  assert.deepEqual(QA_PRESETS, [
    'academic',
    'tools',
    'minimal',
    'course-notes',
    'research-portfolio',
  ]);
  for (const preset of QA_PRESETS) {
    const first = await runQa(singleOptions(preset));
    const second = await runQa(singleOptions(preset));
    assert.deepEqual(second, first, `${preset} output must be deterministic`);
    assert.equal(first.schemaVersion, 1);
    assert.equal(first.preset, preset);
    assert.equal(first.scope.kind, 'single');
    assert.deepEqual(first.scope.selected, ['book']);
    assert.equal(first.verdict, 'green');
    assert.deepEqual(first.shared, {
      verdict: 'not_applicable',
      checks: {},
      diagnostics: [],
    });
    assert.deepEqual(JSON.parse(renderQaJson(first)), first);
    assert.match(renderQaHuman(first), new RegExp(`^preset\\s+${preset}`, 'm'));
    assert.doesNotMatch(renderQaHuman(first), /\u001b\[/);
    assert.equal(qaExitCode(first), 0);
  }
});

test('#158: single-book checks report chapters, links, objectives, components, and fixtures', async () => {
  const result = await runQa(singleOptions());
  const book = result.books.book;
  assert.equal(book.verdict, 'green');
  assert.deepEqual(book.checks.content_contract, {
    state: 'green',
    metrics: { errors: 0, advisories: 0 },
    diagnosticIds: [],
  });
  assert.deepEqual(book.checks.chapters.metrics, { total: 3, nonDraft: 2, draft: 1 });
  assert.deepEqual(book.checks.links.metrics, {
    checked: 2,
    broken: 0,
    skippedFragments: 0,
  });
  assert.deepEqual(book.checks.learning_objectives.metrics, {
    declared: 2,
    resolved: 2,
    coverage: 1,
  });
  assert.deepEqual(book.checks.components.metrics, {
    total: 3,
    byName: { Cite: 1, DemoFrame: 1, Figure: 1 },
  });
  for (const publicName of ['PatternTimeline', 'PreReleaseBanner', 'QuestionCard']) {
    assert.ok(SCAFFOLD_MDX_COMPONENTS.includes(publicName), `${publicName} must be countable`);
  }
  assert.deepEqual(book.checks.demo_fixtures.metrics, {
    discovered: 1,
    valid: 1,
    invalid: 0,
    schemasValidated: 1,
  });
  assert.equal(book.diagnostics.length, 0);
});

test('#158: validation diagnostics retain source context and partition by book', async () => {
  const result = await runQa(singleOptions('minimal', {
    validationResult: validation('minimal', {
      warnings: [{
        code: 'validation.book_link_dynamic',
        msg: 'Dynamic BookLink target was not checked.',
        file: 'src/content/chapters/01-intro.mdx',
        line: 7,
        column: 3,
      }],
    }),
  }));
  const book = result.books.book;
  assert.equal(book.verdict, 'amber');
  assert.equal(book.checks.content_contract.state, 'amber');
  assert.equal(book.checks.content_contract.diagnosticIds.length, 1);
  assert.deepEqual(book.diagnostics[0], {
    id: 'qa:book:0001',
    severity: 'warning',
    code: 'validation.book_link_dynamic',
    message: 'Dynamic BookLink target was not checked.',
    book: 'book',
    file: 'src/content/chapters/01-intro.mdx',
    line: 7,
    column: 3,
  });
  assert.equal(result.summary.advisories, 1);
  assert.equal(qaExitCode(result), 0);
});

test('#158: corpus books keep repeated ids/counts independent and aggregate one red book', async () => {
  const result = await runQa(corpusOptions());
  assert.deepEqual(Object.keys(result.books), ['alpha', 'beta']);
  assert.deepEqual(result.scope, { kind: 'corpus', selected: ['alpha', 'beta'] });
  assert.equal(result.books.alpha.verdict, 'green');
  assert.equal(result.books.beta.verdict, 'red');
  assert.deepEqual(result.books.alpha.checks.chapters.metrics, {
    total: 1,
    nonDraft: 1,
    draft: 0,
  });
  assert.deepEqual(result.books.beta.checks.chapters.metrics, {
    total: 1,
    nonDraft: 0,
    draft: 1,
  });
  assert.deepEqual(result.books.alpha.checks.components.metrics.byName, { Figure: 1 });
  assert.deepEqual(result.books.beta.checks.components.metrics.byName, { Figure: 1 });
  assert.equal(result.books.alpha.checks.learning_objectives.state, 'green');
  assert.equal(result.books.beta.checks.learning_objectives.state, 'not_applicable');
  assert.equal(result.shared.verdict, 'green');
  assert.deepEqual(result.shared.checks.demo_fixtures.metrics, {
    discovered: 1,
    valid: 1,
    invalid: 0,
    schemasValidated: 0,
  });
  assert.equal(result.verdict, 'red');
  assert.equal(result.summary.booksChecked, 2);
  assert.equal(qaExitCode(result), 1);
  assert.match(renderQaHuman(result), /^corpus\s+RED\s+2 books checked$/m);
});

test('#158: selected corpus QA contains exactly one requested manifest book', async () => {
  const result = await runQa(corpusOptions({ selectedBooks: [CORPUS.books[0]] }));
  assert.deepEqual(Object.keys(result.books), ['alpha']);
  assert.deepEqual(result.scope.selected, ['alpha']);
  assert.equal(result.books.alpha.verdict, 'green');
  assert.equal(result.summary.booksChecked, 1);
  assert.match(renderQaHuman(result), /^corpus\s+GREEN\s+1 book checked$/m);
});

test('#158: corpus shared check stays explicit N/A when no shared JSON exists', async () => {
  const root = mkdtempSync(join(tmpdir(), 'book-qa-no-shared-'));
  try {
    cpSync(resolve(FIXTURES, 'corpus'), root, { recursive: true });
    rmSync(join(root, 'src/data/shared.json'));
    const result = await runQa(corpusOptions({ root, selectedBooks: [CORPUS.books[0]] }));
    assert.deepEqual(result.shared, {
      verdict: 'not_applicable',
      checks: {
        demo_fixtures: {
          state: 'not_applicable',
          metrics: { discovered: 0, valid: 0, invalid: 0, schemasValidated: 0 },
          diagnosticIds: [],
        },
      },
      diagnostics: [],
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('#158: data discovery includes hidden JSON and excludes generated artifacts only at root', async () => {
  const root = mkdtempSync(join(tmpdir(), 'book-qa-data-paths-'));
  try {
    cpSync(resolve(FIXTURES, 'corpus'), root, { recursive: true });
    writeFileSync(join(root, 'src/data/.hidden.json'), '{"hidden":true}\n');
    writeFileSync(join(root, 'src/data/alpha/labels.json'), '{"consumer":"fixture"}\n');
    const result = await runQa(corpusOptions({ root, selectedBooks: [CORPUS.books[0]] }));
    assert.deepEqual(result.books.alpha.checks.demo_fixtures.metrics, {
      discovered: 2,
      valid: 2,
      invalid: 0,
      schemasValidated: 1,
    });
    assert.deepEqual(result.shared.checks.demo_fixtures.metrics, {
      discovered: 2,
      valid: 2,
      invalid: 0,
      schemasValidated: 0,
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('#158: unindexable known-route fragments become explicit link advisories', async () => {
  const root = mkdtempSync(join(tmpdir(), 'book-qa-fragment-'));
  try {
    cpSync(resolve(FIXTURES, 'single'), root, { recursive: true });
    const chapterPath = join(root, 'src/content/chapters/01-intro.mdx');
    writeFileSync(
      chapterPath,
      `${readFileSync(chapterPath, 'utf8')}\n[Search result](/search/#result)\n`,
    );
    const result = await runQa(singleOptions('minimal', {
      root,
      chaptersRoot: resolve(root, 'src/content/chapters'),
    }));
    assert.deepEqual(result.books.book.checks.links.metrics, {
      checked: 3,
      broken: 0,
      skippedFragments: 1,
    });
    assert.equal(result.books.book.checks.links.state, 'amber');
    assert.equal(result.books.book.diagnostics[0].code, 'qa.links.fragment_unverified');
    assert.equal(result.verdict, 'amber');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('#158: objective marker diagnostics report source-file rather than body-relative lines', async () => {
  const root = mkdtempSync(join(tmpdir(), 'book-qa-objective-line-'));
  try {
    cpSync(resolve(FIXTURES, 'single'), root, { recursive: true });
    const chapterPath = join(root, 'src/content/chapters/01-intro.mdx');
    const source = `${readFileSync(chapterPath, 'utf8')}\n{/* anchor: orphan */}\n`;
    writeFileSync(chapterPath, source);
    const result = await runQa(singleOptions('minimal', {
      root,
      chaptersRoot: resolve(root, 'src/content/chapters'),
    }));
    const orphan = result.books.book.diagnostics.find(
      (entry) => entry.code === 'qa.learning_objectives.orphan_marker',
    );
    assert.equal(orphan.line, source.split('\n').findIndex((line) => line.includes('anchor: orphan')) + 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('#158: actual validator bookResults/notices shape feeds content-contract advisories', async () => {
  const result = await runQa(singleOptions('minimal', {
    validationResult: {
      preset: 'minimal',
      scope: { kind: 'single', selected: ['book'] },
      bookResults: {
        book: {
          errors: [],
          warnings: [],
          notices: [{ code: 'validation.route_shadow', message: 'Route is shadowed.' }],
        },
      },
      fatal: null,
    },
  }));
  assert.equal(result.books.book.checks.content_contract.state, 'amber');
  assert.equal(result.books.book.checks.content_contract.metrics.advisories, 1);
  assert.equal(result.books.book.diagnostics[0].code, 'validation.route_shadow');
});

test('#158: invalid corpus-shared JSON reddens only the aggregate/shared result', async () => {
  const root = mkdtempSync(join(tmpdir(), 'book-qa-shared-'));
  try {
    cpSync(resolve(FIXTURES, 'corpus'), root, { recursive: true });
    writeFileSync(join(root, 'src/data/shared-broken.json'), '{ broken');
    const result = await runQa(corpusOptions({
      root,
      selectedBooks: [CORPUS.books[0]],
    }));
    assert.equal(result.books.alpha.verdict, 'green');
    assert.equal(result.shared.verdict, 'red');
    assert.equal(result.verdict, 'red');
    assert.equal(result.shared.checks.demo_fixtures.metrics.invalid, 1);
    assert.equal(result.shared.diagnostics[0].book, 'corpus');
    assert.equal(result.shared.diagnostics[0].code, 'qa.demo_fixtures.invalid_json');
    assert.equal(result.summary.blockingFailures, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('#158: schema mismatch is a source diagnostic and schema files/generated outputs are excluded', async () => {
  const root = mkdtempSync(join(tmpdir(), 'book-qa-schema-'));
  try {
    cpSync(resolve(FIXTURES, 'single'), root, { recursive: true });
    const path = join(root, 'src/data/demo.json');
    const value = JSON.parse(readFileSync(path, 'utf8'));
    delete value.title;
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
    const result = await runQa(singleOptions('minimal', {
      root,
      chaptersRoot: resolve(root, 'src/content/chapters'),
    }));
    const check = result.books.book.checks.demo_fixtures;
    assert.equal(check.state, 'red');
    assert.deepEqual(check.metrics, {
      discovered: 1,
      valid: 0,
      invalid: 1,
      schemasValidated: 1,
    });
    assert.equal(result.books.book.diagnostics[0].code, 'qa.demo_fixtures.schema_mismatch');
    assert.equal(result.books.book.diagnostics[0].file, 'src/data/demo.json');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('#158: validation runs through the injected core and fatal/config failures stay exit-2 errors', async () => {
  let received = null;
  const result = await runQa(singleOptions('minimal', {
    validationResult: undefined,
    argv: ['--all'],
    env: { QA_SENTINEL: 'yes' },
    runValidation: async (input) => {
      received = input;
      return validation('minimal');
    },
    validationOptions: { regenerateArtifact: 'injected-self-heal' },
  }));
  assert.equal(result.verdict, 'green');
  assert.deepEqual(received.argv, ['--all']);
  assert.equal(received.env.QA_SENTINEL, 'yes');
  assert.equal(received.regenerateArtifact, 'injected-self-heal');

  await assert.rejects(
    runQa(singleOptions('minimal', {
      validationResult: validation('minimal', { fatal: { message: 'bad config' } }),
    })),
    (error) => error instanceof QaExecutionError && /bad config/.test(error.message),
  );
  await assert.rejects(
    runQa(singleOptions('minimal', { validateJsonSchema: undefined })),
    /no validateJsonSchema adapter/,
  );
});
