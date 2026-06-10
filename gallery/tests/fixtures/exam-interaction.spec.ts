import { test, expect, type Page } from '@playwright/test';

/**
 * Interaction coverage for the v4.21.0 exam apparatus (#112-UI/#113/#114),
 * driven against the book-genre fixture (port 4178; built + served by
 * playwright.fixtures.config.ts) — the gallery has no content collections, so
 * the data-bound islands are exercised where real questions exist.
 *
 * Fixture's scoreable pool (3 MCQs; free + cloze are excluded from the manifest
 * and hidden during an active exam):
 *   q-arrays-index      → correct option a   (domain arrays,  chapter 1)
 *   q-arrays-bounds     → correct option b   (domain arrays,  chapter 1)
 *   q-strings-immutable → correct option b   (domain strings, chapter 2)
 */
const BASE = 'http://127.0.0.1:4178';
const CORRECT: Record<string, string> = {
  'q-arrays-index': 'a',
  'q-arrays-bounds': 'b',
  'q-strings-immutable': 'b',
};

async function startExam(page: Page): Promise<void> {
  // client:idle hydration race: an <astro-island> carries `ssr` until its
  // component hydrates — clicking before that hits a listener-less
  // server-rendered button. Wait for the marker to drop.
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  await page.locator('.exam-runner-start').click();
  await expect(page.locator('[data-exam-root]')).toHaveAttribute('data-exam-phase', 'active');
}

test.describe('practice exam runner (#112-UI)', () => {
  test('start → answer correctly → submit scores 100% and reveals answers', async ({ page }) => {
    await page.goto(`${BASE}/practice-exam/`);

    // Static bank is the no-JS fallback: all cards visible before start.
    await expect(page.locator('[data-question-id]')).toHaveCount(5);

    await startExam(page);

    // Non-scoreable cards (free + cloze) hide during an active exam; the
    // 3-question default form (min(10, pool)) keeps all 3 MCQs visible.
    await expect(page.locator('[data-question-id]:visible')).toHaveCount(3);
    // No peeking: answer reveals are display:none while active.
    await expect(page.locator('details.question-reveal:visible')).toHaveCount(0);

    for (const [qid, opt] of Object.entries(CORRECT)) {
      await page.locator(`input[name="exam-${qid}"][value="${opt}"]`).check();
    }
    await page.locator('.exam-runner-submit').click();

    await expect(page.locator('[data-exam-root]')).toHaveAttribute('data-exam-phase', 'review');
    await expect(page.locator('.exam-runner-score')).toContainText('100%');
    await expect(page.locator('[data-exam-result="correct"]')).toHaveCount(3);
    await expect(page.locator('[data-exam-result="incorrect"]')).toHaveCount(0);
    // Review re-opens the answer reveals on all scored cards (the appendix-mode
    // rationale replaces only the in-stem rationale, not the card's reveal).
    await expect(
      page.locator('[data-exam-result] details.question-reveal[open]'),
    ).toHaveCount(3);
    // No weak domains at 100%.
    await expect(page.locator('.exam-runner-routing')).toHaveCount(0);
  });

  test('unanswered submit scores 0% with weak-domain anchors; reset restores the bank', async ({ page }) => {
    await page.goto(`${BASE}/practice-exam/`);
    await startExam(page);
    await page.locator('.exam-runner-submit').click();

    await expect(page.locator('.exam-runner-score')).toContainText('0%');
    await expect(page.locator('[data-exam-result="incorrect"]')).toHaveCount(3);
    // Both manifest domains are weak; practice mode anchors into the bank.
    const routing = page.locator('.exam-runner-routing');
    await expect(routing).toContainText('arrays');
    await expect(routing).toContainText('strings');
    await expect(routing.locator('a[href="#domain-arrays"]')).toBeVisible();

    await page.locator('.exam-runner-reset').click();
    await expect(page.locator('[data-exam-root]')).not.toHaveAttribute('data-exam-phase');
    await expect(page.locator('[data-question-id]')).toHaveCount(5);
    await expect(page.locator('[data-exam-result]')).toHaveCount(0);
  });

  test('the appendix-mode rationale renders as a link into /answers from the bank (#114)', async ({ page }) => {
    await page.goto(`${BASE}/practice-exam/`);
    const ref = page.locator('#question-q-arrays-bounds .question-rationale-ref a');
    await expect(ref).toHaveAttribute('href', '/answers#answer-q-arrays-bounds');
  });
});

test.describe('assessment test (#113)', () => {
  test('cross-domain form scores with chapter routing for weak domains', async ({ page }) => {
    await page.goto(`${BASE}/assessment-test/`);

    // Only scoreable MCQs render here (free/cloze omitted entirely).
    await expect(page.locator('[data-question-id]')).toHaveCount(3);

    await startExam(page);
    await page.locator('.exam-runner-submit').click();

    await expect(page.locator('.exam-runner-score')).toContainText('0%');
    const routing = page.locator('.exam-runner-routing');
    // Numeric chapters render as labels (no fabricated /chapters/<n>/ links);
    // the practice bank cross-link carries the domain anchor.
    await expect(routing).toContainText('chapter 1');
    await expect(routing).toContainText('chapter 2');
    await expect(routing.locator('a[href="/chapters/1/"]')).toHaveCount(0);
    await expect(
      routing.locator('a[href="/practice-exam#domain-arrays"]'),
    ).toBeVisible();
  });
});

test.describe('answers appendix (#114)', () => {
  test('rationales and reveals are pre-expanded, correct options marked, backlinks present', async ({ page }) => {
    await page.goto(`${BASE}/answers/`);

    // The inline script force-opens every details in the appendix.
    const bounds = page.locator('#answer-q-arrays-bounds');
    await expect(bounds.locator('details.question-rationale')).toHaveJSProperty('open', true);
    await expect(bounds.locator('.question-rationale-body')).toContainText('language contract');

    // Correct option marked; answer line present; backlink into the bank.
    await expect(bounds.locator('.answer-option-correct')).toContainText('language-dependent');
    await expect(bounds.locator('.answer-line')).toContainText('Correct:');
    await expect(
      bounds.locator('a[href="/practice-exam#question-q-arrays-bounds"]'),
    ).toBeVisible();

    // Free-response answer renders too (no options list).
    const free = page.locator('#answer-q-arrays-append-cost');
    await expect(free.locator('.answer-line')).toContainText('Amortized O(1)');
  });
});
