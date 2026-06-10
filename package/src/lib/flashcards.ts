/**
 * flashcards.ts — PURE deck-manifest bridge between the `glossary` collection
 * and the Flashcards island (#116).
 *
 * Same architecture as exam-manifest.ts: card backs are MDX definitions
 * (server-rendered — not serializable into island props), so the island
 * receives only this manifest (id + front text) and controls the
 * server-rendered cards by id. Question/objective-derived cards are a
 * deliberate later increment; v1 decks are glossary-only.
 *
 * No astro:content import — node-tested straight from dist/
 * (tests/flashcards.test.mjs).
 */
import type { GlossaryTerm } from '../schemas.js';

/** One deck entry: the stable card id + the front (the display term). */
export interface FlashcardRef {
  id: string;
  front: string;
}

/** The entry shape accepted — a CollectionEntry-like wrapper (glossary
 *  entries carry the file-derived `id` at the top level, not in data). */
type GlossaryLike = {
  id: string;
  data: Pick<GlossaryTerm, 'term' | 'draft'>;
};

/**
 * Build the deck manifest: published (non-draft) terms, alphabetical by
 * display term (locale-aware — same order as /glossary, so the static list
 * fallback and the deck agree). Draft filtering is defensive; the shipped
 * caller passes getCollection('glossary', e => !e.data.draft) output.
 */
export function buildFlashcardDeck(entries: readonly GlossaryLike[]): FlashcardRef[] {
  return entries
    .filter((e) => !e.data.draft)
    .map((e) => ({ id: e.id, front: e.data.term }))
    .sort((a, b) => a.front.localeCompare(b.front));
}
