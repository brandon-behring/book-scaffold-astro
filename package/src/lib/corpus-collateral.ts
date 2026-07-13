/** Internal collection names for per-book convergence collateral (#80). */
export function corpusPatternsCollection(bookId: string): string {
  return `corpus-patterns-${bookId}`;
}

/** Internal collection names for per-book tool timelines (#80). */
export function corpusChangelogCollection(bookId: string): string {
  return `corpus-changelog-${bookId}`;
}
