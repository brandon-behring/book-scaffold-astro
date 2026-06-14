import { test, expect, type Page } from '@playwright/test';

/**
 * Interaction coverage for the section-map scrollspy island (#section-map),
 * driven against the research-portfolio fixture (port 4175; built + served by
 * playwright.fixtures.config.ts) — the gallery has no content collections, so
 * the data-bound island is exercised where a real chapter exists.
 *
 * Fixture chapter /chapters/ch01-fixture/ carries 5 h2/h3 headings (>= the
 * 3-heading gate), in document order:
 *   all-4-new-components-in-one-fixture (h2)
 *   policyref · aicollaborationdisclosure · blockedbycallout · body-content (h3)
 *
 * The gutter map renders ONLY at >= 64rem (the desktop project, 1280px); the
 * collapsed ChapterTOC is the < 64rem fallback (the mobile project, 768px).
 * Each test runtime-skips the project it doesn't apply to (the suite runs under
 * both projects, like the other fixture specs).
 *
 * Assertions only (no toHaveScreenshot) — the scrollspy's *behaviour* is the
 * contract here; the section map's pixels ride the fixtures' visual baselines.
 */
const BASE = 'http://127.0.0.1:4175';
const CH = `${BASE}/chapters/ch01-fixture/`;
// ch02-math carries 3 h2 headings (>= the gate, so the gutter map WOULD render)
// PLUS a <Sidenote> — the #151 handshake suppresses the map there and keeps the
// collapsed ChapterTOC as the nav (the gutter belongs to the sidenote).
const CH_SIDENOTE = `${BASE}/chapters/ch02-math/`;

// h2/h3 slugs Astro/rehype-slug generates for ch01-fixture, in document order.
const SLUGS = [
  'all-4-new-components-in-one-fixture',
  'policyref',
  'aicollaborationdisclosure',
  'blockedbycallout',
  'body-content',
];

async function hydrated(page: Page): Promise<void> {
  // client:idle hydration race (see exam-interaction.spec.ts): an
  // <astro-island> carries `ssr` until it hydrates — assert nothing about the
  // scrollspy until the marker drops.
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
}

test.describe('section-map scrollspy (#section-map)', () => {
  test('desktop: gutter map renders, ChapterTOC hidden, scroll lights a later section', async ({
    page,
  }) => {
    const vp = page.viewportSize();
    test.skip(!vp || vp.width < 1024, 'the gutter map renders only at >= 64rem');

    await page.goto(CH);
    await hydrated(page);

    const nav = page.locator('[data-section-map-root]');
    await expect(nav).toBeVisible();
    // One link per h2/h3; at this width ChapterTOC is the hidden half of the
    // no-double-show handshake.
    await expect(nav.locator('a[data-section-id]')).toHaveCount(SLUGS.length);
    await expect(page.locator('.chapter-toc')).toBeHidden();

    // (The pre-scroll active count is intentionally NOT asserted — whether the
    // first heading starts in the observer's top zone depends on the fixture's
    // header height, which is fragile to pin. The scroll→active assertion below
    // is the real behavioural contract.)

    // Scroll to the foot of the chapter: a late section sits in the observer's
    // top zone (rootMargin biases active toward the top), and pickActive's
    // sticky-prev keeps the last-seen section lit even past the final heading.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

    // Exactly one section is active, and it's one of the lower headings — proof
    // the island observes the body and tracks position (web-first assert retries
    // over the IntersectionObserver callback).
    const active = nav.locator('a[aria-current="page"]');
    await expect(active).toHaveCount(1);
    await expect(active).toHaveClass(/\bactive\b/);
    const slug = await active.getAttribute('data-section-id');
    expect(SLUGS.indexOf(slug ?? '')).toBeGreaterThanOrEqual(2);
  });

  test('desktop: a chapter with a <Sidenote> hides the gutter map, keeps ChapterTOC (#151)', async ({
    page,
  }) => {
    const vp = page.viewportSize();
    test.skip(!vp || vp.width < 1024, 'the gutter handshake applies only at >= 64rem');

    await page.goto(CH_SIDENOTE);
    await hydrated(page);

    // The map would render (3 headings clear the gate), but its gutter collides
    // with the sidenote's float — so the handshake hides it and ChapterTOC, the
    // < 64rem fallback, stays on as the nav. The island still hydrates over the
    // now-hidden nav (harmless); we assert the *display* outcome, not the DOM.
    await expect(page.locator('[data-section-map-root]')).toBeHidden();
    await expect(page.locator('.chapter-toc')).toBeVisible();
  });

  test('mobile: gutter map hidden, collapsed ChapterTOC is the fallback', async ({ page }) => {
    const vp = page.viewportSize();
    test.skip(!vp || vp.width >= 1024, 'the fallback applies only below 64rem');

    await page.goto(CH);
    await hydrated(page);

    await expect(page.locator('[data-section-map-root]')).toBeHidden();
    await expect(page.locator('.chapter-toc')).toBeVisible();
  });
});
