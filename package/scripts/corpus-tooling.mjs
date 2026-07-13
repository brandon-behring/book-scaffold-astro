/**
 * Shared corpus-mode helpers for scaffold CLI tools (#80).
 *
 * Keep these helpers Node-only. Published scripts run from a consumer's cwd
 * and cannot import Astro virtual modules directly, so the evaluated
 * integration metadata from resolve-book-config.mjs is their source of truth.
 */
import { readFile } from 'node:fs/promises';

/** Parse the common `--book <id>` selector without rejecting legacy flags. */
export function parseBookOption(argv = process.argv.slice(2), command = 'book-scaffold') {
  const indexes = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--book') indexes.push(index);
  }
  if (indexes.length > 1) {
    throw new Error(`${command}: --book may be provided only once.`);
  }
  if (indexes.length === 0) return null;

  const value = argv[indexes[0] + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${command}: --book requires a registered book id.`);
  }
  return value;
}

/**
 * Resolve a selector against evaluated config. Manifest order is retained for
 * full runs; a selected run contains exactly the requested manifest object.
 */
export function resolveBookSelection(
  toolingConfig,
  argv = process.argv.slice(2),
  command = 'book-scaffold',
) {
  const requestedBook = parseBookOption(argv, command);
  const corpus = toolingConfig?.corpus ?? null;

  if (!corpus) {
    if (requestedBook !== null) {
      throw new Error(
        `${command}: --book is available only when defineBookConfig({ corpus }) is active.`,
      );
    }
    return Object.freeze({ corpus: null, requestedBook: null, books: Object.freeze([]) });
  }

  if (requestedBook === null) {
    return Object.freeze({
      corpus,
      requestedBook: null,
      books: corpus.books,
    });
  }

  const selected = corpus.books.find((book) => book.id === requestedBook);
  if (!selected) {
    throw new Error(
      `${command}: unknown corpus book ${JSON.stringify(requestedBook)}; expected one of ` +
        `${corpus.books.map((book) => book.id).join(' | ')}.`,
    );
  }
  return Object.freeze({
    corpus,
    requestedBook,
    books: Object.freeze([selected]),
  });
}

/** Return the registered path prefix for a corpus-relative content file. */
export function corpusBookForRelativePath(corpus, relativePath) {
  if (!corpus) return null;
  const candidate = String(relativePath).replaceAll('\\', '/').split('/')[0] ?? '';
  return corpus.books.find((book) => book.id === candidate) ?? null;
}

/** Strip the registered first segment from a corpus-relative content path. */
export function localCorpusPath(book, relativePath) {
  const normalized = String(relativePath).replaceAll('\\', '/');
  const prefix = `${book.id}/`;
  if (!normalized.startsWith(prefix)) {
    throw new Error(
      `Content path ${JSON.stringify(relativePath)} is outside corpus book ${JSON.stringify(book.id)}.`,
    );
  }
  return normalized.slice(prefix.length);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Validate and normalize an existing v1 corpus artifact envelope. */
export function assertCorpusEnvelope(value, corpus, artifact, validateValue = () => true) {
  if (!isObject(value) || value.schemaVersion !== 1 || !isObject(value.books)) {
    throw new Error(
      `${artifact} is not a corpus artifact envelope; expected ` +
        '`{ "schemaVersion": 1, "books": { ... } }`.',
    );
  }

  const expected = corpus.books.map((book) => book.id);
  const actual = Object.keys(value.books);
  const missing = expected.filter((id) => !Object.prototype.hasOwnProperty.call(value.books, id));
  const extra = actual.filter((id) => !expected.includes(id));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `${artifact} book keys do not match the corpus manifest` +
        (missing.length ? `; missing ${missing.join(', ')}` : '') +
        (extra.length ? `; unknown ${extra.join(', ')}` : '') +
        '.',
    );
  }

  for (const id of expected) {
    if (!validateValue(value.books[id])) {
      throw new Error(`${artifact} has an invalid payload for book ${JSON.stringify(id)}.`);
    }
  }
  return value;
}

/** Read and validate a corpus artifact, returning null only when absent. */
export async function readCorpusEnvelope(path, corpus, artifact, validateValue) {
  let source;
  try {
    source = await readFile(path, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }

  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    throw new Error(`${artifact} contains invalid JSON: ${error.message}`, { cause: error });
  }
  return assertCorpusEnvelope(parsed, corpus, artifact, validateValue);
}

/**
 * Build the deterministic final envelope for an artifact producer.
 *
 * A selected run updates its one key in an existing valid envelope. With no
 * existing file, every manifest key starts at the artifact-specific empty
 * value. A full run ignores old data and requires a fresh value for each book.
 */
export async function mergeCorpusArtifact({
  path,
  corpus,
  requestedBook,
  values,
  emptyValue,
  artifact,
  validateValue,
}) {
  const existing = requestedBook === null
    ? null
    : await readCorpusEnvelope(path, corpus, artifact, validateValue);
  const books = {};

  for (const book of corpus.books) {
    let value;
    if (values.has(book.id)) value = values.get(book.id);
    else if (existing) value = existing.books[book.id];
    else value = emptyValue();

    if (!validateValue(value)) {
      throw new Error(`${artifact} producer returned an invalid payload for ${JSON.stringify(book.id)}.`);
    }
    books[book.id] = value;
  }

  return { schemaVersion: 1, books };
}

/** Extract a legacy scalar `book:` field and its source line from frontmatter. */
export function legacyFrontmatterBook(source) {
  const frontmatter = String(source).match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!frontmatter) return null;
  const lines = frontmatter[1].split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^\s*book\s*:\s*(.*?)\s*$/);
    if (!match) continue;
    const raw = match[1];
    const value = raw.replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, (_all, dq, sq) => dq ?? sq);
    return { value, line: index + 2 };
  }
  return null;
}

/** Return an explicit book-local slug from simple YAML frontmatter. */
export function frontmatterSlug(source) {
  const frontmatter = String(source).match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!frontmatter) return null;
  for (const line of frontmatter[1].split(/\r?\n/)) {
    const match = line.match(/^\s*slug\s*:\s*(.*?)\s*$/);
    if (!match || match[1].length === 0) continue;
    return match[1].replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, (_all, dq, sq) => dq ?? sq);
  }
  return null;
}

export function assertLegacyBookMatches(source, book, fileLabel) {
  const legacy = legacyFrontmatterBook(source);
  if (legacy && legacy.value !== book.id) {
    throw new Error(
      `${fileLabel}:${legacy.line}: frontmatter book ${JSON.stringify(legacy.value)} ` +
        `does not match path-derived corpus book ${JSON.stringify(book.id)}.`,
    );
  }
}
