/**
 * book-link — resolve a cross-book `<BookLink>` href from the consumer's
 * sibling-book registry (#96).
 *
 * Each scaffold book is a separate Astro app with its own `labels.json` and
 * deploy origin, so `<XRef>` can't reach a sibling book — a cross-book ref
 * resolves against the wrong labels and dies. `<BookLink book to>` instead
 * resolves `book` against a per-consumer registry of sibling base URLs
 * (`defineBookConfig({ siblingBooks })`) — the single place to update when a
 * sibling redeploys or extracts to its own repo. An unknown `book` THROWS
 * rather than emitting a dead cross-origin link (fail-loud, like #109).
 *
 * #147 extends each registry entry from a URL string to the backward-compatible
 * `{ url, labels? }` descriptor. Runtime href resolution uses `url`; the
 * validator uses `labels` to check literal sibling path/fragment targets.
 */
import type { SiblingBookEntry, SiblingBooks } from '../types.js';

const CORPUS_BOOK_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function normalizedBase(baseUrl: string): string {
  const inner = baseUrl.replace(/^\/+|\/+$/g, '');
  return inner.length === 0 ? '/' : `/${inner}/`;
}

function invalidLocalTarget(book: string, to: string, reason: string): never {
  throw new Error(
    `<BookLink book="${book}" to=${JSON.stringify(to)}>: invalid local corpus target (${reason}).`,
  );
}

/**
 * Resolve a link to another book inside the same corpus application.
 *
 * Chapter targets retain the scaffold's `/chapters/<book>/…` namespace;
 * every other relative target lives below the book landing namespace.
 */
export function resolveCorpusBookHref(
  book: string,
  to: string,
  baseUrl = '/',
): string {
  if (!CORPUS_BOOK_ID.test(book)) {
    throw new Error(`<BookLink book=${JSON.stringify(book)}>: invalid corpus book id.`);
  }
  if (typeof to !== 'string' || to.trim().length === 0) {
    invalidLocalTarget(book, String(to), 'target must be non-empty');
  }
  if (to !== to.trim()) invalidLocalTarget(book, to, 'surrounding whitespace is not allowed');
  if (/^[a-z][a-z0-9+.-]*:/i.test(to) || to.startsWith('/') || to.includes('\\')) {
    invalidLocalTarget(book, to, 'absolute URLs and paths are not allowed');
  }
  if (/[\u0000-\u001f\u007f]/.test(to)) {
    invalidLocalTarget(book, to, 'control characters are not allowed');
  }

  const suffixIndex = [...[to.indexOf('?'), to.indexOf('#')]]
    .filter((index) => index >= 0)
    .reduce((minimum, index) => Math.min(minimum, index), to.length);
  const path = to.slice(0, suffixIndex);
  const suffix = to.slice(suffixIndex);
  if (path.length === 0) invalidLocalTarget(book, to, 'query-only and fragment-only targets are not allowed');

  const segments = path.replace(/\/+$/, '').split('/');
  if (segments.some((segment) => segment.length === 0)) {
    invalidLocalTarget(book, to, 'empty path segments are not allowed');
  }
  for (const segment of segments) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      invalidLocalTarget(book, to, 'malformed percent encoding');
    }
    if (decoded === '.' || decoded === '..' || decoded.includes('/') || decoded.includes('\\')) {
      invalidLocalTarget(book, to, 'path traversal is not allowed');
    }
  }

  const base = normalizedBase(baseUrl);
  const local = segments.join('/');
  const destination =
    local === 'chapters'
      ? `chapters/${book}`
      : local.startsWith('chapters/')
        ? `chapters/${book}/${local.slice('chapters/'.length)}`
        : `${book}/${local}`;
  return `${base}${destination}/`.replace(/\/{2,}/g, '/') + suffix;
}

function entryUrl(entry: SiblingBookEntry | undefined): string | undefined {
  if (typeof entry === 'string') return entry;
  return entry?.url;
}

export function resolveBookHref(
  siblingBooks: SiblingBooks | null | undefined,
  book: string,
  to: string,
): string {
  const registered =
    siblingBooks !== null &&
    siblingBooks !== undefined &&
    Object.prototype.hasOwnProperty.call(siblingBooks, book);
  if (!registered) {
    const known = siblingBooks ? Object.keys(siblingBooks) : [];
    throw new Error(
      `<BookLink book="${book}">: unknown sibling book. Register it in ` +
        `defineBookConfig({ siblingBooks: { "${book}": "https://…" } })` +
        (known.length ? ` (known: ${known.join(', ')})` : '') +
        '.',
    );
  }

  const entry = siblingBooks![book];
  const base = entryUrl(entry);
  if (typeof base !== 'string' || base.length === 0) {
    throw new Error(
      `<BookLink book="${book}">: invalid siblingBooks entry. Expected a URL ` +
        'string or { url: "https://…", labels?: "./path/to/labels.json" }.',
    );
  }
  return `${base.replace(/\/+$/, '')}/${to.replace(/^\/+/, '')}`;
}
