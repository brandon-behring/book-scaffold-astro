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
 * Phase 1 (this): registry-backed href + fail-loud on unknown book. Phase 2
 * (deferred): validate the `to` id against a vendored sibling `labels.json`.
 */
export function resolveBookHref(
  siblingBooks: Record<string, string> | null | undefined,
  book: string,
  to: string,
): string {
  const base = siblingBooks?.[book];
  if (!base) {
    const known = siblingBooks ? Object.keys(siblingBooks) : [];
    throw new Error(
      `<BookLink book="${book}">: unknown sibling book. Register it in ` +
        `defineBookConfig({ siblingBooks: { "${book}": "https://…" } })` +
        (known.length ? ` (known: ${known.join(', ')})` : '') +
        '.',
    );
  }
  return `${base.replace(/\/+$/, '')}/${to.replace(/^\/+/, '')}`;
}
