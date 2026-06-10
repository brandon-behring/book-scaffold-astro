import { test, expect, type Page } from '@playwright/test';

/**
 * Interaction coverage for the v4.22.0 flashcards deck (#116), driven against
 * the book-genre fixture (port 4178) — see exam-interaction.spec.ts for the
 * architecture rationale (no collections in the gallery).
 *
 * The fixture glossary holds 4 terms; deck order is alphabetical in the
 * static list and shuffled in deck mode (4 cards total either way).
 */
const BASE = 'http://127.0.0.1:4178';

async function hydrated(page: Page): Promise<void> {
  // client:idle hydration race (see exam-interaction.spec.ts).
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
}

test('idle: full front+back list renders (the no-JS fallback content)', async ({ page }) => {
  await page.goto(`${BASE}/flashcards/`);
  await expect(page.locator('[data-card-id]')).toHaveCount(4);
  // Backs are visible in list mode — the page reads like a compact glossary.
  await expect(page.locator('#card-array .flashcard-back')).toBeVisible();
  await expect(page.locator('.flashcards-stats')).toContainText('4 cards');
});

test('deck: start shows one card, flip reveals the definition, buckets persist across reload', async ({ page }) => {
  await page.goto(`${BASE}/flashcards/`);
  await hydrated(page);

  await page.locator('.flashcards-start').click();
  await expect(page.locator('[data-flashcards-root]')).toHaveAttribute('data-flashcards-mode', 'deck');
  await expect(page.locator('[data-card-id]:visible')).toHaveCount(1);
  await expect(page.locator('.flashcards-progress')).toContainText('Card 1 of 4');

  // Recall first: the visible card's back is hidden until flipped.
  const current = page.locator('[data-card-id]:visible');
  await expect(current.locator('.flashcard-back')).toBeHidden();
  await page.locator('.flashcards-flip').click();
  await expect(current.locator('.flashcard-back')).toBeVisible();

  // Sort it into the known bucket — advances to card 2 and persists.
  await page.locator('.flashcards-knew').click();
  await expect(page.locator('.flashcards-progress')).toContainText('Card 2 of 4');
  await expect(page.locator('.flashcards-progress')).toContainText('1 known');

  await page.reload();
  await hydrated(page);
  await expect(page.locator('.flashcards-stats')).toContainText('1 marked known');

  // "Unknown only" narrows the next deck to the 3 remaining cards.
  await page.locator('.flashcards-filter-label input').check();
  await expect(page.locator('.flashcards-start')).toContainText('Start deck (3)');
});

test('deck: End restores the full list; reset clears the known bucket', async ({ page }) => {
  await page.goto(`${BASE}/flashcards/`);
  await hydrated(page);

  await page.locator('.flashcards-start').click();
  await page.locator('.flashcards-end').click();
  await expect(page.locator('[data-flashcards-root]')).not.toHaveAttribute('data-flashcards-mode');
  await expect(page.locator('[data-card-id]:visible')).toHaveCount(4);

  // Known bucket survives from the previous test only within ITS page context;
  // this is a fresh context — mark one, then reset.
  await page.locator('.flashcards-start').click();
  await page.locator('.flashcards-knew').click();
  await page.locator('.flashcards-end').click();
  await expect(page.locator('.flashcards-stats')).toContainText('1 marked known');
  await page.locator('.flashcards-link').click(); // (reset)
  await expect(page.locator('.flashcards-stats')).toContainText('0 marked known');
});
