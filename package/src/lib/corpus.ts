/** Pure corpus-manifest validation and lookup helpers (#80). */
import {
  BOOK_PRESETS,
  CORPUS_APPARATUS_ROUTES,
  BookConfigError,
  type BookCorpus,
  type BookCorpusInput,
  type CorpusApparatusRoute,
  type CorpusBook,
  type CorpusBookInput,
} from '../types.js';

const BOOK_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** First-segment names owned by the application rather than a corpus book. */
export const RESERVED_CORPUS_BOOK_IDS = Object.freeze([
  'assets',
  'chapters',
  'search',
  '_astro',
  '_og',
  'pagefind',
] as const);

const RESERVED = new Set<string>(RESERVED_CORPUS_BOOK_IDS);
const APPARATUS = new Set<string>(CORPUS_APPARATUS_ROUTES);
const TOP_LEVEL_KEYS = new Set(['preset', 'books']);
const BOOK_KEYS = new Set([
  'id',
  'title',
  'subtitle',
  'description',
  'author',
  'image',
  'apparatus',
]);

function objectRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new BookConfigError(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  label: string,
): void {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw new BookConfigError(
      `${label} has unknown field${unknown.length === 1 ? '' : 's'}: ${unknown.join(', ')}.`,
    );
  }
}

function optionalNonBlankString(
  value: unknown,
  label: string,
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BookConfigError(`${label} must be a non-blank string when provided.`);
  }
  return value;
}

function validateBook(value: unknown, index: number): CorpusBook {
  const label = `defineBookCorpus books[${index}]`;
  const input = objectRecord(value, label);
  rejectUnknownKeys(input, BOOK_KEYS, label);

  const id = optionalNonBlankString(input.id, `${label}.id`);
  if (id === undefined || !BOOK_ID.test(id)) {
    throw new BookConfigError(
      `${label}.id must match [a-z0-9]+(?:-[a-z0-9]+)* (got ${JSON.stringify(input.id)}).`,
    );
  }
  if (RESERVED.has(id)) {
    throw new BookConfigError(
      `${label}.id ${JSON.stringify(id)} is reserved; choose a book-specific id.`,
    );
  }

  const title = optionalNonBlankString(input.title, `${label}.title`);
  if (title === undefined) {
    throw new BookConfigError(`${label}.title must be a non-blank string.`);
  }

  let apparatus: readonly CorpusApparatusRoute[] | undefined;
  if (input.apparatus !== undefined) {
    if (!Array.isArray(input.apparatus)) {
      throw new BookConfigError(`${label}.apparatus must be an array when provided.`);
    }
    const seen = new Set<string>();
    const routes: CorpusApparatusRoute[] = [];
    for (const route of input.apparatus) {
      if (typeof route !== 'string' || !APPARATUS.has(route)) {
        throw new BookConfigError(
          `${label}.apparatus contains ${JSON.stringify(route)}; expected a subset of ` +
            CORPUS_APPARATUS_ROUTES.join(' | ') +
            '.',
        );
      }
      if (seen.has(route)) {
        throw new BookConfigError(`${label}.apparatus contains duplicate route ${JSON.stringify(route)}.`);
      }
      seen.add(route);
      routes.push(route as CorpusApparatusRoute);
    }
    apparatus = Object.freeze(routes);
  }

  const book: CorpusBook = {
    id,
    title,
    ...optionalField('subtitle', optionalNonBlankString(input.subtitle, `${label}.subtitle`)),
    ...optionalField('description', optionalNonBlankString(input.description, `${label}.description`)),
    ...optionalField('author', optionalNonBlankString(input.author, `${label}.author`)),
    ...optionalField('image', optionalNonBlankString(input.image, `${label}.image`)),
    ...(apparatus === undefined ? {} : { apparatus }),
  };
  return Object.freeze(book);
}

function optionalField<Key extends string>(
  key: Key,
  value: string | undefined,
): {} | Record<Key, string> {
  return value === undefined ? {} : ({ [key]: value } as Record<Key, string>);
}

/**
 * Define and eagerly validate one homogeneous-preset book corpus.
 *
 * The returned value is safe to share between `astro.config.mjs` and
 * `src/content.config.ts`; no filesystem or Astro virtual module is touched.
 */
export function defineBookCorpus(inputValue: BookCorpusInput): BookCorpus {
  const input = objectRecord(inputValue, 'defineBookCorpus input');
  rejectUnknownKeys(input, TOP_LEVEL_KEYS, 'defineBookCorpus input');

  if (typeof input.preset !== 'string' || !BOOK_PRESETS.includes(input.preset as never)) {
    throw new BookConfigError(
      `defineBookCorpus preset must be one of ${BOOK_PRESETS.join(' | ')} ` +
        `(got ${JSON.stringify(input.preset)}).`,
    );
  }
  if (!Array.isArray(input.books) || input.books.length === 0) {
    throw new BookConfigError('defineBookCorpus books must be a non-empty array.');
  }

  const books = input.books.map(validateBook);
  const seen = new Set<string>();
  for (const book of books) {
    if (seen.has(book.id)) {
      throw new BookConfigError(`defineBookCorpus book id ${JSON.stringify(book.id)} is duplicated.`);
    }
    seen.add(book.id);
  }

  return Object.freeze({
    __bookCorpusVersion: 1 as const,
    preset: input.preset as BookCorpus['preset'],
    books: Object.freeze(books),
  });
}

/** Validate that a value came from this major's `defineBookCorpus`. */
export function assertBookCorpus(value: unknown): asserts value is BookCorpus {
  if (
    value === null ||
    typeof value !== 'object' ||
    (value as { __bookCorpusVersion?: unknown }).__bookCorpusVersion !== 1
  ) {
    throw new BookConfigError(
      'corpus must be created by defineBookCorpus() from this book-scaffold major.',
    );
  }
}

/** Resolve one manifest book or fail with the complete known-id set. */
export function resolveCorpusBook(corpus: BookCorpus, id: string): CorpusBook {
  const book = corpus.books.find((candidate) => candidate.id === id);
  if (!book) {
    throw new BookConfigError(
      `Unknown corpus book ${JSON.stringify(id)}; expected one of ` +
        `${corpus.books.map((candidate) => candidate.id).join(' | ')}.`,
    );
  }
  return book;
}

/** Return the registered first entry-id segment, or null outside the corpus. */
export function corpusBookIdOf(corpus: BookCorpus, entryId: string): string | null {
  const candidate = entryId.split('/')[0] ?? '';
  return corpus.books.some((book) => book.id === candidate) ? candidate : null;
}

/** Resolve current book identity from canonical corpus routes. */
export function corpusBookIdFromPath(
  corpus: BookCorpus,
  pathname: string,
  baseUrl = '/',
): string | null {
  const normalizedBase = baseUrl === '/' ? '/' : `/${baseUrl.replace(/^\/+|\/+$/g, '')}/`;
  const relative = pathname.startsWith(normalizedBase)
    ? pathname.slice(normalizedBase.length)
    : pathname.replace(/^\/+/, '');
  const segments = relative.split('/').filter(Boolean);
  const candidate = segments[0] === 'chapters' ? segments[1] : segments[0];
  return candidate && corpus.books.some((book) => book.id === candidate) ? candidate : null;
}
