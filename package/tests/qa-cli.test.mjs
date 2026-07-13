import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  QA_USAGE,
  parseQaArgs,
  runQaCli,
  validateLocalJsonSchema,
} from '../scripts/qa.mjs';

const CLI = fileURLToPath(new URL('../bin/book-scaffold.mjs', import.meta.url));

function stream({ isTTY = false } = {}) {
  let value = '';
  return {
    isTTY,
    write(chunk) { value += String(chunk); },
    value() { return value; },
  };
}

function result(verdict = 'green') {
  return {
    schemaVersion: 1,
    preset: 'minimal',
    scope: { kind: 'single', selected: ['book'] },
    verdict,
    books: {
      book: { verdict, checks: {}, diagnostics: [] },
    },
    shared: { verdict: 'not_applicable', checks: {}, diagnostics: [] },
    summary: {
      booksChecked: 1,
      blockingFailures: verdict === 'red' ? 1 : 0,
      advisories: 0,
    },
  };
}

function write(root, relative, contents) {
  const path = join(root, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
  return path;
}

test('#158: QA argument parser sanitizes selectors and output aliases', () => {
  assert.deepEqual(parseQaArgs([]), {
    book: null,
    all: false,
    format: 'human',
    help: false,
    validationArgv: [],
  });
  assert.deepEqual(parseQaArgs(['--book', 'alpha', '--json']), {
    book: 'alpha',
    all: false,
    format: 'json',
    help: false,
    validationArgv: ['--book', 'alpha'],
  });
  assert.deepEqual(parseQaArgs(['--all', '--format', 'json']), {
    book: null,
    all: true,
    format: 'json',
    help: false,
    validationArgv: [],
  });
});

test('#158: QA parser rejects every ambiguous selector/format branch', () => {
  const invalid = [
    [['--book'], /requires/],
    [['--book', 'alpha', '--book', 'beta'], /only once/],
    [['--book', 'alpha', '--all'], /mutually exclusive/],
    [['--all', '--all'], /only once/],
    [['--format'], /requires/],
    [['--format', 'xml'], /human or json/],
    [['--format', 'json', '--format', 'human'], /only once/],
    [['--json', '--json'], /only once/],
    [['--json', '--format', 'json'], /may not be combined/],
    [['--wat'], /unknown argument/],
    [['alpha'], /unknown argument/],
  ];
  for (const [argv, expected] of invalid) {
    assert.throws(() => parseQaArgs(argv), expected, argv.join(' '));
  }
});

test('#158: help is non-mutating and invalid invocation exits 2 on stderr', async () => {
  for (const argv of [['--help'], ['-h']]) {
    const stdout = stream();
    const stderr = stream();
    let executed = false;
    const status = await runQaCli({
      argv,
      stdout,
      stderr,
      executeQa: async () => { executed = true; return result(); },
    });
    assert.equal(status, 0);
    assert.equal(stdout.value(), QA_USAGE);
    assert.equal(stderr.value(), '');
    assert.equal(executed, false);
  }

  const stdout = stream();
  const stderr = stream();
  const status = await runQaCli({ argv: ['--wat'], stdout, stderr });
  assert.equal(status, 2);
  assert.equal(stdout.value(), '');
  assert.match(stderr.value(), /^qa: unknown argument/);
  assert.match(stderr.value(), /Usage: book-scaffold qa/);
});

test('#158: JSON stdout is clean while progress uses stderr', async () => {
  const stdout = stream();
  const stderr = stream();
  let received;
  const status = await runQaCli({
    argv: ['--book', 'alpha', '--format', 'json'],
    stdout,
    stderr,
    env: {},
    executeQa: async (options) => {
      received = options;
      options.validationOptions.onProgress({ artifact: 'src/data/labels.json', book: 'alpha' });
      return result();
    },
  });
  assert.equal(status, 0);
  assert.deepEqual(JSON.parse(stdout.value()), result());
  assert.equal(stderr.value(), 'qa: regenerating src/data/labels.json for alpha\n');
  assert.deepEqual(received.argv, ['--book', 'alpha']);
  assert.equal(typeof received.runValidation, 'function');
  assert.equal(typeof received.validateJsonSchema, 'function');
  assert.equal(typeof received.validationOptions.regenerateArtifact, 'function');
});

test('#158: direct CLI diverts consumer config stdout in JSON and human modes', () => {
  const root = mkdtempSync(join(tmpdir(), 'book-qa-cli-noisy-config-'));
  try {
    write(
      root,
      'src/content.config.ts',
      `export const collections = defineBookSchemas({ preset: 'minimal' });\n`,
    );
    write(
      root,
      'src/content/chapters/01-ready.mdx',
      `---\ntitle: Ready\ndraft: false\n---\n\n## Start\n\nReady.\n`,
    );
    write(root, 'src/data/demo.json', JSON.stringify({
      $schema: './demo.schema.json',
      title: 'Local reference',
    }));
    write(root, 'src/data/demo.schema.json', JSON.stringify({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $ref: './schemas/demo-defs.json#/$defs/demo',
    }));
    write(root, 'src/data/schemas/demo-defs.json', JSON.stringify({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $defs: {
        demo: {
          $anchor: 'demo',
          type: 'object',
          required: ['title'],
          properties: { title: { type: 'string' } },
        },
      },
    }));
    const metadata = {
      preset: 'minimal',
      numberStyle: 'shared',
      siblingBooks: {},
      corpus: null,
      chapterRoute: '/chapters/:id/',
      bookField: 'book',
      apparatusRoute: '/:route/',
      apparatusRoutes: [],
      enabledRoutes: ['references', 'search', 'print', 'chapters', 'landing'],
      frontmatterRoute: '/frontmatter/[slug]',
    };
    write(
      root,
      'astro.config.mjs',
      `console.log('consumer-config-noise');\n` +
        `export default { integrations: [{ name: 'book-scaffold-astro', ` +
        `__bookScaffoldResolvedConfig: ${JSON.stringify(metadata)} }] };\n`,
    );

    const json = spawnSync(process.execPath, [CLI, 'qa', '--format', 'json'], {
      cwd: root,
      encoding: 'utf8',
      timeout: 20_000,
    });
    assert.equal(json.status, 0, json.stderr);
    assert.equal(JSON.parse(json.stdout).verdict, 'green');
    assert.match(json.stderr, /consumer stdout redirected.*consumer-config-noise/s);

    const human = spawnSync(process.execPath, [CLI, 'qa'], {
      cwd: root,
      encoding: 'utf8',
      timeout: 20_000,
    });
    assert.equal(human.status, 0, human.stderr);
    assert.match(human.stdout, /^preset\s+minimal\nscope\s+single/);
    assert.doesNotMatch(human.stdout, /consumer-config-noise/);
    assert.match(human.stderr, /consumer stdout redirected.*consumer-config-noise/s);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('#158: content red exits 1; fatal execution exits 2 without stdout', async () => {
  const redOut = stream();
  const redErr = stream();
  const redStatus = await runQaCli({
    argv: ['--format', 'json'],
    stdout: redOut,
    stderr: redErr,
    executeQa: async () => result('red'),
  });
  assert.equal(redStatus, 1);
  assert.equal(JSON.parse(redOut.value()).verdict, 'red');
  assert.equal(redErr.value(), '');

  const fatalOut = stream();
  const fatalErr = stream();
  const fatalStatus = await runQaCli({
    argv: ['--format', 'json'],
    stdout: fatalOut,
    stderr: fatalErr,
    executeQa: async () => { throw new Error('broken config'); },
  });
  assert.equal(fatalStatus, 2);
  assert.equal(fatalOut.value(), '');
  assert.equal(fatalErr.value(), 'qa: fatal: broken config\n');
});

test('#158: local JSON Schema adapter supports declared dialects and JSON pointers', async () => {
  const root = mkdtempSync(join(tmpdir(), 'book-qa-schema-dialects-'));
  try {
    const schema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $defs: {
        demo: {
          $anchor: 'demo',
          type: 'object',
          required: ['title'],
          properties: { title: { type: 'string' } },
        },
      },
    };
    const schemaPath = write(root, 'demo.schema.json', JSON.stringify(schema));
    const input = { schema, schemaPath, schemaFragment: '#/$defs/demo', root };
    assert.equal(
      (await validateLocalJsonSchema({ ...input, value: { title: 'Ready' } })).valid,
      true,
    );
    const invalid = await validateLocalJsonSchema({ ...input, value: {} });
    assert.equal(invalid.valid, false);
    assert.match(invalid.errors[0].message, /required property/);
    assert.equal((await validateLocalJsonSchema({
      ...input,
      schemaFragment: '#demo',
      value: { title: 'Anchored' },
    })).valid, true);

    const dialects = [
      undefined,
      'http://json-schema.org/draft-07/schema#',
      'https://json-schema.org/draft/2019-09/schema',
      'https://json-schema.org/draft/2020-12/schema#',
    ];
    for (const [index, dialect] of dialects.entries()) {
      const dialectSchema = {
        ...(dialect ? { $schema: dialect } : {}),
        type: 'string',
        format: 'email',
      };
      const dialectPath = write(
        root,
        `dialect-${index}.schema.json`,
        JSON.stringify(dialectSchema),
      );
      const outcome = await validateLocalJsonSchema({
        value: 'format-is-annotation-only',
        schema: dialectSchema,
        schemaPath: dialectPath,
        root,
      });
      assert.equal(outcome.valid, true, dialect);
    }

    for (const [index, unsupported] of [
      'http://json-schema.org/draft-04/schema#',
      'http://json-schema.org/draft-06/schema#',
      'https://example.invalid/custom-schema',
    ].entries()) {
      const unsupportedSchema = { $schema: unsupported };
      const unsupportedPath = write(
        root,
        `unsupported-${index}.schema.json`,
        JSON.stringify(unsupportedSchema),
      );
      await assert.rejects(
        validateLocalJsonSchema({
          value: {},
          schema: unsupportedSchema,
          schemaPath: unsupportedPath,
          root,
        }),
        /supported dialects are draft-07, 2019-09, and 2020-12/,
      );
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('#158: JSON Schema adapter follows recursive project-local refs only', async () => {
  const root = mkdtempSync(join(tmpdir(), 'book-qa-schema-refs-'));
  const outside = mkdtempSync(join(tmpdir(), 'book-qa-schema-outside-'));
  try {
    const rootSchemaPath = write(root, 'schemas/root.schema.json', JSON.stringify({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $ref: './node.schema.json',
    }));
    write(root, 'schemas/node.schema.json', JSON.stringify({
      $defs: {
        node: {
          anyOf: [
            { type: 'null' },
            {
              type: 'object',
              required: ['title', 'next'],
              properties: {
                title: { type: 'string' },
                next: { $ref: './root.schema.json' },
              },
            },
          ],
        },
      },
      $ref: '#/$defs/node',
    }));
    const schema = JSON.parse(readFileSync(rootSchemaPath, 'utf8'));
    const valid = await validateLocalJsonSchema({
      value: { title: 'one', next: { title: 'two', next: null } },
      schema,
      schemaPath: rootSchemaPath,
      root,
    });
    assert.equal(valid.valid, true);
    const invalid = await validateLocalJsonSchema({
      value: { title: 'one', next: {} },
      schema,
      schemaPath: rootSchemaPath,
      root,
    });
    assert.equal(invalid.valid, false);

    write(outside, 'escaped.schema.json', '{"type":"object"}\n');
    symlinkSync(
      join(outside, 'escaped.schema.json'),
      join(root, 'schemas/escaped.schema.json'),
    );
    for (const reference of [
      'https://example.invalid/schema.json',
      './escaped.schema.json',
    ]) {
      await assert.rejects(
        validateLocalJsonSchema({
          value: {},
          schema: {
            $schema: 'https://json-schema.org/draft/2020-12/schema',
            $ref: reference,
          },
          schemaPath: rootSchemaPath,
          root,
        }),
        /network schemas are disabled|escapes the project root/,
      );
    }

    const escapedRoot = join(root, 'schemas/escaped-root.schema.json');
    symlinkSync(join(outside, 'escaped.schema.json'), escapedRoot);
    await assert.rejects(
      validateLocalJsonSchema({
        value: {},
        schema: { type: 'object' },
        schemaPath: escapedRoot,
        root,
      }),
      /root .* escapes the project root/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test('#158: fresh single-book CLI self-heals artifacts and emits clean JSON', async () => {
  const root = mkdtempSync(join(tmpdir(), 'book-qa-cli-single-'));
  try {
    write(
      root,
      'src/content.config.ts',
      `export const collections = defineBookSchemas({ preset: 'minimal' });\n`,
    );
    write(
      root,
      'src/content/chapters/01-ready.mdx',
      `---\ntitle: Ready\ndraft: false\n---\n\n## Start\n\nReady.\n`,
    );
    write(root, 'src/data/demo.json', JSON.stringify({
      $schema: './demo.schema.json',
      title: 'Local reference',
    }));
    write(root, 'src/data/demo.schema.json', JSON.stringify({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $ref: './schemas/demo-defs.json#/$defs/demo',
    }));
    write(root, 'src/data/schemas/demo-defs.json', JSON.stringify({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $defs: {
        demo: {
          type: 'object',
          required: ['title'],
          properties: { title: { type: 'string' } },
        },
      },
    }));
    const stdout = stream();
    const stderr = stream();
    const status = await runQaCli({
      argv: ['--format', 'json'],
      projectRoot: root,
      env: {},
      stdout,
      stderr,
    });
    assert.equal(status, 0, stderr.value());
    const parsed = JSON.parse(stdout.value());
    assert.equal(parsed.verdict, 'green');
    assert.deepEqual(parsed.scope, { kind: 'single', selected: ['book'] });
    assert.equal(parsed.books.book.checks.chapters.metrics.nonDraft, 1);
    assert.equal(parsed.books.book.checks.demo_fixtures.metrics.schemasValidated, 1);
    assert.equal(parsed.books.book.checks.demo_fixtures.metrics.discovered, 1);
    assert.match(stderr.value(), /regenerating src\/data\/labels\.json/);
    assert.match(stderr.value(), /regenerating src\/data\/references\.json/);
    assert.equal(existsSync(join(root, 'src/data/labels.json')), true);
    assert.equal(existsSync(join(root, 'src/data/references.json')), true);

    write(root, 'src/data/demo.schema.json', JSON.stringify({
      $schema: 'http://json-schema.org/draft-06/schema#',
      type: 'object',
    }));
    const unsupportedOut = stream();
    const unsupportedErr = stream();
    const unsupportedStatus = await runQaCli({
      argv: ['--format', 'json'],
      projectRoot: root,
      env: {},
      stdout: unsupportedOut,
      stderr: unsupportedErr,
    });
    assert.equal(unsupportedStatus, 1, unsupportedErr.value());
    const unsupported = JSON.parse(unsupportedOut.value());
    assert.ok(unsupported.books.book.diagnostics.some(
      (entry) => entry.code === 'qa.demo_fixtures.schema_error' &&
        /supported dialects/.test(entry.message),
    ));

    const invalidOut = stream();
    const invalidErr = stream();
    const invalidStatus = await runQaCli({
      argv: ['--book', 'not-a-corpus', '--format', 'json'],
      projectRoot: root,
      env: {},
      stdout: invalidOut,
      stderr: invalidErr,
    });
    assert.equal(invalidStatus, 2);
    assert.equal(invalidOut.value(), '');
    assert.match(invalidErr.value(), /--book is available only/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('#158: fresh two-book corpus CLI preserves manifest selection and turns green', async () => {
  const root = mkdtempSync(join(tmpdir(), 'book-qa-cli-corpus-'));
  try {
    const corpus = {
      __bookCorpusVersion: 1,
      preset: 'minimal',
      books: [
        { id: 'alpha', title: 'Alpha' },
        { id: 'beta', title: 'Beta' },
      ],
    };
    const metadata = {
      preset: 'minimal',
      numberStyle: 'shared',
      siblingBooks: {},
      corpus,
      chapterRoute: '/chapters/:id/',
      bookField: 'book',
      apparatusRoute: '/:book/:route/',
      apparatusRoutes: [],
    };
    write(
      root,
      'astro.config.mjs',
      `export default { integrations: [{ name: 'book-scaffold-astro', ` +
        `__bookScaffoldResolvedConfig: ${JSON.stringify(metadata)} }] };\n`,
    );
    for (const id of ['alpha', 'beta']) {
      write(
        root,
        `src/content/${id}/01-ready.mdx`,
        `---\ntitle: ${id}\ndraft: false\n---\n\n## Start\n\n${id}.\n`,
      );
    }

    const stdout = stream();
    const stderr = stream();
    const status = await runQaCli({
      argv: ['--all', '--format', 'json'],
      projectRoot: root,
      env: {},
      stdout,
      stderr,
    });
    assert.equal(status, 0, stderr.value());
    const parsed = JSON.parse(stdout.value());
    assert.equal(parsed.verdict, 'green');
    assert.deepEqual(parsed.scope, { kind: 'corpus', selected: ['alpha', 'beta'] });
    assert.deepEqual(Object.keys(parsed.books), ['alpha', 'beta']);
    assert.equal(JSON.parse(readFileSync(join(root, 'src/data/labels.json'))).schemaVersion, 1);
    assert.equal(JSON.parse(readFileSync(join(root, 'src/data/references.json'))).schemaVersion, 1);

    const selectedOut = stream();
    const selectedErr = stream();
    const selectedStatus = await runQaCli({
      argv: ['--book', 'beta', '--format', 'json'],
      projectRoot: root,
      env: {},
      stdout: selectedOut,
      stderr: selectedErr,
    });
    assert.equal(selectedStatus, 0, selectedErr.value());
    assert.deepEqual(JSON.parse(selectedOut.value()).scope.selected, ['beta']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
