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
const BOOK_CORPUS_BRAND = Symbol.for(
  '@brandon_m_behring/book-scaffold-astro/BookCorpus/v1',
);

/**
 * First-segment names owned by application routes/assets or shared content
 * collection roots rather than a corpus book.
 */
export const RESERVED_CORPUS_BOOK_IDS = Object.freeze([
  'assets',
  'chapters',
  'search',
  'questions',
  'glossary',
  'frontmatter',
  '_astro',
  '_og',
  'pagefind',
] as const);

/** Route metadata derived from the corpus contract, never consumer-overridden. */
export const CORPUS_OWNED_ROUTE_FIELDS = Object.freeze([
  'chapterRoute',
  'bookField',
  'apparatusRoute',
  'apparatusRoutes',
] as const);

/**
 * Public URL slug -> `RouteToggles` key. Keep this explicit: the public
 * `practice-exam` route is intentionally not the camel-cased config key.
 */
export const CORPUS_APPARATUS_TOGGLE_BY_ROUTE = Object.freeze({
  references: 'references',
  print: 'print',
  convergence: 'convergence',
  tips: 'tips',
  exercises: 'exercises',
  'practice-exam': 'practiceExam',
  glossary: 'glossary',
  flashcards: 'flashcards',
  answers: 'answers',
} as const satisfies Record<CorpusApparatusRoute, string>);

const RESERVED = new Set<string>(RESERVED_CORPUS_BOOK_IDS);
const APPARATUS = new Set<string>(CORPUS_APPARATUS_ROUTES);
const RESERVED_CONTENT_ROOTS: Readonly<Record<string, string>> = Object.freeze({
  questions: 'src/content/questions/ is the dedicated questions collection root',
  glossary: 'src/content/glossary/ is the dedicated glossary collection root',
  frontmatter: 'src/content/frontmatter/ is the shared frontmatter collection root',
});
const TOP_LEVEL_KEYS = new Set(['preset', 'books']);
const BRANDED_CORPUS_KEYS = new Set(['__bookCorpusVersion', 'preset', 'books']);
const CORPUS_ARTIFACT_KEYS = new Set(['schemaVersion', 'books']);
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
    const reason = RESERVED_CONTENT_ROOTS[id] ?? 'the scaffold owns that route or asset namespace';
    throw new BookConfigError(
      `${label}.id ${JSON.stringify(id)} is reserved because ${reason}; ` +
        'choose a book-specific id.',
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

  const corpus = {
    __bookCorpusVersion: 1 as const,
    preset: input.preset as BookCorpus['preset'],
    books: Object.freeze(books),
  };
  Object.defineProperty(corpus, BOOK_CORPUS_BRAND, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return Object.freeze(corpus);
}

/** Validate that a value came from this major's `defineBookCorpus`. */
export function assertBookCorpus(value: unknown): asserts value is BookCorpus {
  const invalid = () =>
    new BookConfigError(
      'corpus must be created by defineBookCorpus() from this book-scaffold major.',
    );
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw invalid();
  }

  const input = value as Record<PropertyKey, unknown>;
  if (
    input[BOOK_CORPUS_BRAND] !== true ||
    input.__bookCorpusVersion !== 1 ||
    !Object.isFrozen(value) ||
    !Object.isFrozen(input.books)
  ) {
    throw invalid();
  }

  try {
    rejectUnknownKeys(input as Record<string, unknown>, BRANDED_CORPUS_KEYS, 'corpus');
    if (typeof input.preset !== 'string' || !BOOK_PRESETS.includes(input.preset as never)) {
      throw invalid();
    }
    if (!Array.isArray(input.books) || input.books.length === 0) throw invalid();

    const seen = new Set<string>();
    for (const [index, rawBook] of input.books.entries()) {
      if (!Object.isFrozen(rawBook)) throw invalid();
      const book = validateBook(rawBook, index);
      if (seen.has(book.id)) throw invalid();
      seen.add(book.id);
      if (book.apparatus !== undefined) {
        const original = (rawBook as { apparatus?: unknown }).apparatus;
        if (!Object.isFrozen(original)) throw invalid();
      }
    }
  } catch (error) {
    if (error instanceof BookConfigError && error.message.startsWith('corpus must be created')) {
      throw error;
    }
    throw invalid();
  }
}

/** Return the effective apparatus routes for one manifest book. */
export function corpusApparatusRoutesForBook(
  corpus: BookCorpus,
  bookId: string,
  inheritedRoutes: readonly CorpusApparatusRoute[] = [],
): readonly CorpusApparatusRoute[] {
  const book = resolveCorpusBook(corpus, bookId);
  return book.apparatus ?? inheritedRoutes;
}

/** True when a public apparatus route is enabled for one manifest book. */
export function corpusBookHasApparatusRoute(
  corpus: BookCorpus,
  bookId: string,
  route: CorpusApparatusRoute,
  inheritedRoutes: readonly CorpusApparatusRoute[] = [],
): boolean {
  return corpusApparatusRoutesForBook(corpus, bookId, inheritedRoutes).includes(route);
}

/**
 * Select the current book's payload from a v1 corpus artifact envelope.
 * Single-book mode deliberately returns the input unchanged, preserving the
 * legacy JSON contract byte-for-byte.
 */
export function selectBookArtifact<Payload>(
  value: unknown,
  corpus: BookCorpus | null | undefined,
  bookId: string | null | undefined,
  artifact = 'artifact',
): Payload {
  if (!corpus) return value as Payload;
  if (!bookId) {
    throw new Error(`${artifact}: cannot select a corpus payload without a current book.`);
  }
  resolveCorpusBook(corpus, bookId);

  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(
      `${artifact} is not a corpus artifact envelope; expected ` +
        '`{ "schemaVersion": 1, "books": { ... } }`.',
    );
  }
  const envelopeRecord = value as Record<string, unknown>;
  rejectUnknownKeys(envelopeRecord, CORPUS_ARTIFACT_KEYS, artifact);
  const envelope = envelopeRecord as { schemaVersion?: unknown; books?: unknown };
  if (
    envelope.schemaVersion !== 1 ||
    envelope.books === null ||
    typeof envelope.books !== 'object' ||
    Array.isArray(envelope.books)
  ) {
    throw new BookConfigError(
      `${artifact} is not a corpus artifact envelope; expected ` +
        '`{ "schemaVersion": 1, "books": { ... } }`.',
    );
  }

  const books = envelope.books as Record<string, unknown>;
  const expected = corpus.books.map((book) => book.id);
  const actual = Object.keys(books);
  const missing = expected.filter((id) => !Object.prototype.hasOwnProperty.call(books, id));
  const unknown = actual.filter((id) => !expected.includes(id));
  if (missing.length > 0 || unknown.length > 0) {
    throw new Error(
      `${artifact} book keys do not match the corpus manifest` +
        (missing.length > 0 ? `; missing ${missing.join(', ')}` : '') +
        (unknown.length > 0 ? `; unknown ${unknown.join(', ')}` : '') +
        '.',
    );
  }
  return books[bookId] as Payload;
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

/** Strip the registered `<book>/` prefix from one collection entry id. */
export function localCorpusEntryId(corpus: BookCorpus, bookId: string, entryId: string): string {
  resolveCorpusBook(corpus, bookId);
  const prefix = `${bookId}/`;
  if (!entryId.startsWith(prefix) || entryId.length === prefix.length) {
    throw new Error(
      `Collection entry ${JSON.stringify(entryId)} is outside corpus book ${JSON.stringify(bookId)}.`,
    );
  }
  return entryId.slice(prefix.length);
}

/** Filter content entries to the current registered book. */
export function filterCorpusEntries<Entry extends { id: string }>(
  entries: readonly Entry[],
  corpus: BookCorpus | null | undefined,
  bookId: string | null | undefined,
): Entry[] {
  if (!corpus) return [...entries];
  if (!bookId) throw new Error('Cannot scope corpus content without a current book.');
  resolveCorpusBook(corpus, bookId);
  const prefix = `${bookId}/`;
  return entries.filter((entry) => entry.id.startsWith(prefix));
}

/**
 * Derive a collision-safe collection id from a corpus-relative source path.
 * A legacy `book:` field may agree with the path-derived owner, but can never
 * override it; disagreement fails before schema parsing can silently strip it.
 */
export function corpusCollectionEntryId(
  corpus: BookCorpus,
  entry: string,
  data: Record<string, unknown>,
  options: { label?: string; slugField?: string } = {},
): string {
  const label = options.label ?? 'Content entry';
  const normalized = entry.replaceAll('\\', '/').replace(/^\.\//, '');
  const [bookId, ...localParts] = normalized.split('/');
  if (!bookId || !corpus.books.some((book) => book.id === bookId)) {
    throw new Error(`${label} ${JSON.stringify(entry)} is outside the registered corpus books.`);
  }

  if (
    Object.prototype.hasOwnProperty.call(data, 'book') &&
    data.book !== bookId
  ) {
    throw new Error(
      `${label} ${JSON.stringify(entry)} has frontmatter book ${JSON.stringify(data.book)}, ` +
        `but its registered path owner is ${JSON.stringify(bookId)}.`,
    );
  }

  const fileId = localParts.join('/').replace(/\.(?:md|mdx)$/i, '');
  const configured = options.slugField ? data[options.slugField] : undefined;
  const localId = typeof configured === 'string' ? configured : fileId;
  const localSegments = localId.split('/');
  let hasInvalidEncodedSegment = false;
  for (const segment of localSegments) {
    try {
      const decoded = decodeURIComponent(segment);
      if (
        decoded === '.' ||
        decoded === '..' ||
        decoded.includes('/') ||
        decoded.includes('\\')
      ) {
        hasInvalidEncodedSegment = true;
      }
    } catch {
      hasInvalidEncodedSegment = true;
    }
  }
  if (
    localId.length === 0 ||
    localId.startsWith('/') ||
    localId.endsWith('/') ||
    localId.includes('\\') ||
    localSegments.some((part) => part === '.' || part === '..' || part.length === 0) ||
    hasInvalidEncodedSegment
  ) {
    throw new Error(
      `${label} ${JSON.stringify(entry)} resolved invalid corpus id ${JSON.stringify(localId)}.`,
    );
  }
  return `${bookId}/${localId}`;
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
