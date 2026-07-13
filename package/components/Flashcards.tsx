/**
 * Flashcards — Preact island for the spaced-recall deck (#116).
 *
 * Same controller-over-server-rendered-cards architecture as ExamRunner: card
 * backs are MDX glossary definitions (not serializable into island props), so
 * flashcards.astro renders every card statically and this island receives only
 * the deck manifest (id + front). Start shuffles (the exam-engine Fisher–Yates)
 * and shows ONE card at a time — others get the `hidden` attribute, the
 * wrapper gains data-flashcards-mode="deck", and CSS keyed on that attribute
 * hides the back of the unflipped current card. Know/still-learning buckets
 * persist to localStorage (ToolFilter pattern) so the "review unknown only"
 * pass survives reloads. No JS → the full front+back list stays readable.
 *
 * DOM contract with flashcards.astro:
 *   [data-flashcards-root]          wrapper; gains data-flashcards-mode="deck"
 *   [data-card-id="<id>"]           one card per term; `hidden` toggled;
 *                                   gains/loses class "flashcard-flipped"
 *
 * Fail-loud (house invariant): a missing wrapper or deck/DOM drift throws a
 * named error — never silently dead buttons or a silently short deck.
 *
 * Hydrated with `client:idle`. Colors via CSS tokens only.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { shuffle } from '../src/lib/exam-engine';
import type { FlashcardRef } from '../src/lib/flashcards';

const DEFAULT_STORAGE_KEY = 'book:flashcards:known';

interface Props {
  /** Deck manifest (buildFlashcardDeck output) — card ids + fronts only. */
  deck: FlashcardRef[];
  /**
   * Persistence namespace. Corpus routes pass a base- and book-specific key
   * so repeated local glossary ids never share or erase another book's state.
   */
  storageKey?: string;
}

type Phase = 'idle' | 'deck';

function readKnown(storageKey: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((s): s is string => typeof s === 'string'));
  } catch {
    return new Set();
  }
}

function writeKnown(storageKey: string, known: Set<string>): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify([...known]));
  } catch {
    /* localStorage unavailable — keep in-memory state only */
  }
}

export default function Flashcards({ deck, storageKey = DEFAULT_STORAGE_KEY }: Props) {
  if (typeof storageKey !== 'string' || storageKey.trim().length === 0) {
    throw new Error('Flashcards: storageKey must be a non-empty string.');
  }
  const [phase, setPhase] = useState<Phase>('idle');
  const [order, setOrder] = useState<string[]>([]);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<string>>(new Set());
  const [unknownOnly, setUnknownOnly] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Intersect the stored bucket with the CURRENT deck: a term deleted from
    // the glossary would otherwise inflate "marked known" forever (even past
    // deck.length) — evict stale ids on mount and persist the cleaned set.
    const stored = readKnown(storageKey);
    const deckIds = new Set(deck.map((c) => c.id));
    const cleaned = new Set([...stored].filter((id) => deckIds.has(id)));
    if (cleaned.size !== stored.size) writeKnown(storageKey, cleaned);
    setKnown(cleaned);
  }, [deck, storageKey]);

  function requireRoot(): HTMLElement {
    const r = ref.current?.closest<HTMLElement>('[data-flashcards-root]');
    if (!r) {
      throw new Error(
        'Flashcards: no [data-flashcards-root] ancestor — mount the island inside ' +
          'the wrapper that contains its cards (see the DOM contract in Flashcards.tsx).',
      );
    }
    return r;
  }
  function cardEl(r: HTMLElement, id: string): HTMLElement {
    const el = r.querySelector<HTMLElement>(`[data-card-id="${CSS.escape(id)}"]`);
    if (!el) {
      throw new Error(`Flashcards: deck/DOM drift — no rendered card for term "${id}".`);
    }
    return el;
  }
  function allCards(r: HTMLElement): HTMLElement[] {
    return Array.from(r.querySelectorAll<HTMLElement>('[data-card-id]'));
  }

  function showOnly(r: HTMLElement, id: string): void {
    for (const card of allCards(r)) {
      card.hidden = card.dataset.cardId !== id;
      card.classList.remove('flashcard-flipped');
    }
    setFlipped(false);
  }

  function start(): void {
    const r = requireRoot();
    const pool = unknownOnly ? deck.filter((c) => !known.has(c.id)) : deck;
    if (pool.length === 0) return; // the idle UI disables Start in this state
    const shuffled = shuffle(pool.map((c) => c.id));
    // Fail loud on drift before hiding anything (ExamRunner precedent).
    for (const id of shuffled) cardEl(r, id);
    r.setAttribute('data-flashcards-mode', 'deck');
    showOnly(r, shuffled[0]!);
    setOrder(shuffled);
    setPos(0);
    setPhase('deck');
  }

  function goTo(next: number): void {
    const r = requireRoot();
    const clamped = Math.max(0, Math.min(next, order.length - 1));
    showOnly(r, order[clamped]!);
    setPos(clamped);
  }

  function flip(): void {
    const r = requireRoot();
    const card = cardEl(r, order[pos]!);
    const next = !flipped;
    card.classList.toggle('flashcard-flipped', next);
    setFlipped(next);
  }

  function mark(knewIt: boolean): void {
    const id = order[pos]!;
    const next = new Set(known);
    if (knewIt) next.add(id);
    else next.delete(id);
    setKnown(next);
    writeKnown(storageKey, next);
    if (pos < order.length - 1) goTo(pos + 1);
    else end();
  }

  function end(): void {
    const r = requireRoot();
    for (const card of allCards(r)) {
      card.hidden = false;
      card.classList.remove('flashcard-flipped');
    }
    r.removeAttribute('data-flashcards-mode');
    setPhase('idle');
    setOrder([]);
    setPos(0);
    setFlipped(false);
  }

  function resetKnown(): void {
    const next = new Set<string>();
    setKnown(next);
    writeKnown(storageKey, next);
  }

  if (deck.length === 0) {
    return <p class="flashcards-empty">No glossary terms to study yet.</p>;
  }

  const unknownCount = deck.filter((c) => !known.has(c.id)).length;
  const poolSize = unknownOnly ? unknownCount : deck.length;

  return (
    <div class="flashcards-runner" ref={ref}>
      {phase === 'idle' && (
        <div class="flashcards-controls">
          <p class="flashcards-intro">
            Study the glossary as flashcards: shuffled, one term at a time — recall the
            definition, flip to check, and sort each card into "knew it" / "still learning".
          </p>
          <p class="flashcards-stats" role="status">
            {deck.length} card{deck.length === 1 ? '' : 's'} · {known.size} marked known
            {known.size > 0 && (
              <>
                {' '}
                (<button type="button" class="flashcards-link" onClick={resetKnown}>reset</button>)
              </>
            )}
          </p>
          <label class="flashcards-filter-label">
            <input
              type="checkbox"
              checked={unknownOnly}
              onInput={(e) => setUnknownOnly((e.target as HTMLInputElement).checked)}
            />{' '}
            only cards I don't know yet ({unknownCount})
          </label>
          <button
            type="button"
            class="flashcards-button flashcards-start"
            onClick={start}
            disabled={poolSize === 0}
          >
            {poolSize === 0 ? 'All cards marked known — reset to review' : `Start deck (${poolSize})`}
          </button>
        </div>
      )}

      {phase === 'deck' && (
        <div class="flashcards-controls">
          <p class="flashcards-progress" role="status">
            Card {pos + 1} of {order.length} · {known.size} known
          </p>
          <div class="flashcards-buttons">
            <button type="button" class="flashcards-button flashcards-flip" onClick={flip}>
              {flipped ? 'Hide definition' : 'Flip'}
            </button>
            <button type="button" class="flashcards-button flashcards-knew" onClick={() => mark(true)}>
              Knew it
            </button>
            <button type="button" class="flashcards-button flashcards-learning" onClick={() => mark(false)}>
              Still learning
            </button>
            <button
              type="button"
              class="flashcards-button flashcards-prev"
              onClick={() => goTo(pos - 1)}
              disabled={pos === 0}
            >
              ← Prev
            </button>
            <button
              type="button"
              class="flashcards-button flashcards-next"
              onClick={() => goTo(pos + 1)}
              disabled={pos === order.length - 1}
            >
              Next →
            </button>
            <button type="button" class="flashcards-button flashcards-end" onClick={end}>
              End — show all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
