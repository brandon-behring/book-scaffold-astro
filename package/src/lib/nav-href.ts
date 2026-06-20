/**
 * src/lib/nav-href.ts — pure route-href resolver (#80 multi-book navigation).
 *
 * No `astro:content` import (mirrors chapter-sort.ts) so tsup can include it in
 * the DTS bundle without dragging Astro virtual modules into the build graph.
 * The nav components (Sidebar, ChapterNav, NavContent, …) call these helpers
 * instead of hardcoding the single-book `/chapters/<id>/` URL shape — so ONE set
 * of components serves both a single-book site (the default pattern) and a
 * multi-book consumer whose chapters render at `/<book>/<slug>/`.
 *
 * Patterns are base-relative TOKEN STRINGS (a resolver *function* could not
 * survive the book-config virtual module's `JSON.stringify`, so the config
 * surface is a declarative string resolved here):
 *   :id   → entry.id verbatim, slashes preserved          e.g. 'kg/01-intro'
 *   :book → the entry's book name (see `bookField`), or '' e.g. 'kg'
 *   :slug → entry.id with a leading '<book>/' stripped     e.g. '01-intro'
 * BASE_URL is applied here, so patterns are written base-relative (lead '/').
 *
 * Defaults reproduce the single-book behavior BYTE-FOR-BYTE:
 *   chapterRoute   = '/chapters/:id/'  → `${base}chapters/${id}/`
 *   bookField      = 'book'   (academic/tools schemas have no `book` → bookOf
 *                              returns null → "show all chapters", today's nav)
 *   apparatusRoute = '/:route/'        → `${base}<route>/`
 */

/** Minimal shape the resolver needs from a chapter collection entry. */
export interface ChapterLike {
  id: string;
  data: Record<string, unknown>;
}

/** Normalize a base URL to exactly one trailing slash (`''` → `'/'`). */
function normBase(baseUrl: string): string {
  return (baseUrl || '/').replace(/\/*$/, '/');
}

/** Replace `:book` / `:slug` / `:route` / `:id` tokens; `\b` keeps each token
 *  whole, so order is irrelevant and `:id` never matches inside `:identifier`. */
function fillTokens(pattern: string, tokens: Record<string, string>): string {
  return pattern.replace(/:(book|slug|route|id)\b/g, (_m, k: string) => tokens[k] ?? '');
}

/**
 * The entry's book name from `data[bookField]`, or `null` when absent/blank.
 * Single-book schemas (academic/tools/minimal) have no such field → `null`,
 * which callers read as "this is the only book — show every chapter".
 */
export function bookOf(entry: ChapterLike, bookField = 'book'): string | null {
  const v = entry.data[bookField];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/** `entry.id` with a leading `'<book>/'` stripped (multi-book) or unchanged. */
export function slugOf(entry: ChapterLike, bookField = 'book'): string {
  const book = bookOf(entry, bookField);
  return book && entry.id.startsWith(`${book}/`) ? entry.id.slice(book.length + 1) : entry.id;
}

/** Resolve a chapter entry to a base-prefixed href via the `chapterRoute` pattern. */
export function chapterHref(
  entry: ChapterLike,
  pattern = '/chapters/:id/',
  baseUrl = '/',
  bookField = 'book',
): string {
  const path = fillTokens(pattern, {
    id: entry.id,
    book: bookOf(entry, bookField) ?? '',
    slug: slugOf(entry, bookField),
  }).replace(/\/{2,}/g, '/').replace(/^\//, '');   // collapse empties (absent token) — never a protocol-relative //
  return normBase(baseUrl) + path;
}

/**
 * Resolve a per-book apparatus route (glossary / practice-exam / flashcards /
 * answers) to a base-prefixed href via the `apparatusRoute` pattern.
 */
export function apparatusHref(
  route: string,
  book: string | null,
  pattern = '/:route/',
  baseUrl = '/',
): string {
  const path = fillTokens(pattern, { route, book: book ?? '' })
    .replace(/\/{2,}/g, '/')   // F2 (#80): an absent :book must collapse, never yield a protocol-relative //
    .replace(/^\//, '');
  return normBase(baseUrl) + path;
}

/** Whether `entry` is the page at `currentPath` (trailing-slash tolerant). */
export function isCurrentChapter(
  entry: ChapterLike,
  currentPath: string,
  pattern = '/chapters/:id/',
  baseUrl = '/',
  bookField = 'book',
): boolean {
  const href = chapterHref(entry, pattern, baseUrl, bookField);
  return currentPath === href || currentPath === href.replace(/\/$/, '');
}
