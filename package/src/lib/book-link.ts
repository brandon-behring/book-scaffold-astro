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
