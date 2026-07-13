#!/usr/bin/env node
/** CLI adapter for the deterministic scaffold QA engine. */
import Ajv from 'ajv';
import Ajv2019 from 'ajv/dist/2019.js';
import Ajv2020 from 'ajv/dist/2020.js';
import { realpathSync } from 'node:fs';
import { readFile, realpath } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import {
  qaExitCode,
  renderQaHuman,
  renderQaJson,
  runQa,
} from './qa-core.mjs';
import { runValidation } from './validate-core.mjs';
import { regenerateValidationArtifact } from './validation-artifacts.mjs';

export const QA_USAGE = `Usage: book-scaffold qa [--book <id> | --all] [--format human|json]

Run scaffold content validation and deterministic readiness checks.

Options:
  --book <id>          Check exactly one registered corpus book.
  --all                Check every corpus book (the default).
  --format <format>    human (default) or json.
  --json               Alias for --format json.
  --help, -h           Print this message without inspecting the project.

Exit codes:
  0  No blocking failures (green or amber).
  1  At least one selected content/shared check is red.
  2  Invalid invocation, config, manifest, or internal execution failure.
`;

export class QaUsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'QaUsageError';
  }
}

/** Parse and sanitize only the public QA flags. */
export function parseQaArgs(argv) {
  if (!Array.isArray(argv)) throw new TypeError('qa arguments must be an array.');
  let book = null;
  let all = false;
  let format = null;
  let jsonAlias = false;
  let help = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--book') {
      if (book !== null) throw new QaUsageError('--book may be provided only once.');
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new QaUsageError('--book requires a registered book id.');
      }
      book = value;
      index += 1;
    } else if (arg === '--all') {
      if (all) throw new QaUsageError('--all may be provided only once.');
      all = true;
    } else if (arg === '--format') {
      if (format !== null) throw new QaUsageError('--format may be provided only once.');
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new QaUsageError('--format requires human or json.');
      }
      if (value !== 'human' && value !== 'json') {
        throw new QaUsageError(`--format must be human or json (got ${JSON.stringify(value)}).`);
      }
      format = value;
      index += 1;
    } else if (arg === '--json') {
      if (jsonAlias) throw new QaUsageError('--json may be provided only once.');
      jsonAlias = true;
    } else if (arg === '--help' || arg === '-h') {
      help = true;
    } else {
      throw new QaUsageError(`unknown argument ${JSON.stringify(arg)}.`);
    }
  }

  if (book !== null && all) {
    throw new QaUsageError('--book and --all are mutually exclusive.');
  }
  if (jsonAlias && format !== null) {
    throw new QaUsageError('--json and --format may not be combined.');
  }

  const outputFormat = jsonAlias ? 'json' : format ?? 'human';
  return Object.freeze({
    book,
    all,
    format: outputFormat,
    help,
    validationArgv: Object.freeze(book === null ? [] : ['--book', book]),
  });
}

const JSON_SCHEMA_DIALECTS = new Map([
  ['http://json-schema.org/draft-07/schema', { name: 'draft-07', Constructor: Ajv }],
  ['https://json-schema.org/draft/2019-09/schema', { name: '2019-09', Constructor: Ajv2019 }],
  ['https://json-schema.org/draft/2020-12/schema', { name: '2020-12', Constructor: Ajv2020 }],
]);

function schemaDialect(schema, inherited = null) {
  if (schema?.$schema === undefined) {
    return inherited ?? JSON_SCHEMA_DIALECTS.get('http://json-schema.org/draft-07/schema');
  }
  if (typeof schema.$schema !== 'string') {
    throw new Error('JSON Schema $schema must be a supported dialect URI string.');
  }
  const normalized = schema.$schema.endsWith('#') ? schema.$schema.slice(0, -1) : schema.$schema;
  const dialect = JSON_SCHEMA_DIALECTS.get(normalized);
  if (!dialect) {
    throw new Error(
      `Unsupported JSON Schema dialect ${JSON.stringify(schema.$schema)}; ` +
      'supported dialects are draft-07, 2019-09, and 2020-12.',
    );
  }
  if (inherited && dialect.name !== inherited.name) {
    throw new Error(
      `Local JSON Schema resource uses ${dialect.name}, but the root schema uses ` +
      `${inherited.name}; mixed dialects are not supported.`,
    );
  }
  return dialect;
}

function insideRoot(root, path) {
  const local = relative(root, path);
  return local === '' || (!local.startsWith('..') && !isAbsolute(local));
}

/** Validate a fixture against one already-loaded local JSON Schema. */
export async function validateLocalJsonSchema({
  value,
  schema,
  schemaPath,
  schemaFragment = '',
  root = dirname(schemaPath),
}) {
  const dialect = schemaDialect(schema);
  const projectRoot = await realpath(root);
  const canonicalSchemaPath = await realpath(schemaPath);
  if (!insideRoot(projectRoot, canonicalSchemaPath)) {
    throw new Error(
      `JSON Schema root ${JSON.stringify(schemaPath)} escapes the project root.`,
    );
  }
  const loadSchema = async (uri) => {
    let url;
    try {
      url = new URL(uri);
    } catch {
      throw new Error(`JSON Schema reference ${JSON.stringify(uri)} is not a project-local file URL.`);
    }
    if (url.protocol !== 'file:') {
      throw new Error(
        `JSON Schema reference ${JSON.stringify(uri)} is not project-local; network schemas are disabled.`,
      );
    }
    const requestedPath = fileURLToPath(url);
    let canonicalPath;
    try {
      canonicalPath = await realpath(requestedPath);
    } catch (error) {
      throw new Error(
        `Project-local JSON Schema ${JSON.stringify(requestedPath)} could not be read: ` +
        `${error?.message ?? error}`,
      );
    }
    if (!insideRoot(projectRoot, canonicalPath)) {
      throw new Error(
        `JSON Schema reference ${JSON.stringify(uri)} escapes the project root.`,
      );
    }
    const loaded = JSON.parse(await readFile(canonicalPath, 'utf8'));
    schemaDialect(loaded, dialect);
    return loaded;
  };
  const ajv = new dialect.Constructor({
    allErrors: true,
    strict: false,
    validateFormats: false,
    loadSchema,
  });
  const schemaKey = pathToFileURL(schemaPath).href;
  ajv.addSchema(schema, schemaKey);
  const reference = `${schemaKey}${schemaFragment}`;
  const validate = await ajv.compileAsync({ $ref: reference });
  const valid = await validate(value);
  return { valid: Boolean(valid), errors: validate.errors ?? [] };
}

async function withCliStdoutGuard(enabled, stderr, execute) {
  if (!enabled) return execute();

  const originalWrite = process.stdout.write;
  const diverted = [];
  process.stdout.write = function guardedStdoutWrite(chunk, encoding, callback) {
    diverted.push(Buffer.isBuffer(chunk) ? chunk.toString() : String(chunk));
    const done = typeof encoding === 'function' ? encoding : callback;
    if (typeof done === 'function') queueMicrotask(done);
    return true;
  };
  try {
    return await execute();
  } finally {
    process.stdout.write = originalWrite;
    if (diverted.length > 0) {
      const content = diverted.join('');
      stderr.write('qa: consumer stdout redirected to stderr:\n');
      stderr.write(content.endsWith('\n') ? content : `${content}\n`);
    }
  }
}

/** Execute QA with injectable boundaries and return the public exit code. */
export async function runQaCli({
  argv = process.argv.slice(2),
  projectRoot = process.cwd(),
  env = process.env,
  stdout = process.stdout,
  stderr = process.stderr,
  executeQa = runQa,
  runValidationImpl = runValidation,
  regenerateArtifact = regenerateValidationArtifact,
  schemaValidator = validateLocalJsonSchema,
} = {}) {
  let parsed;
  try {
    parsed = parseQaArgs(argv);
  } catch (error) {
    stderr.write(`qa: ${error?.message ?? error}\n\n${QA_USAGE}`);
    return 2;
  }

  if (parsed.help) {
    stdout.write(QA_USAGE);
    return 0;
  }

  const root = resolve(projectRoot);
  const validationAdapter = async (input) => {
    const result = await runValidationImpl(input);
    if (result?.fatal && result.output?.stderr) stderr.write(result.output.stderr);
    return result;
  };

  try {
    const result = await withCliStdoutGuard(stdout === process.stdout, stderr, () =>
      executeQa({
        root,
        argv: parsed.validationArgv,
        env,
        runValidation: validationAdapter,
        validateJsonSchema: schemaValidator,
        validationOptions: {
          regenerateArtifact,
          onProgress(event) {
            const selected = event.book ? ` for ${event.book}` : '';
            stderr.write(`qa: regenerating ${event.artifact}${selected}\n`);
          },
        },
      }));
    if (parsed.format === 'json') stdout.write(renderQaJson(result));
    else {
      const color = Boolean(stdout.isTTY && env.NO_COLOR === undefined && env.TERM !== 'dumb');
      stdout.write(renderQaHuman(result, { color }));
    }
    return qaExitCode(result);
  } catch (error) {
    stderr.write(`qa: fatal: ${error?.message ?? error}\n`);
    return 2;
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
const modulePath = fileURLToPath(import.meta.url);
function canonicalPath(path) {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}
if (invokedPath && canonicalPath(invokedPath) === canonicalPath(modulePath)) {
  process.exitCode = await runQaCli();
}
