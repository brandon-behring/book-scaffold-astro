import { test, expect, type Page } from '@playwright/test';

/**
 * Interaction coverage for the v4.26.0 mobile nav drawer (#80) — the inline
 * focus-trap / ESC / scroll-lock controller in Base.astro. Filed as the T1
 * test gap of #183: a11y-critical, reworked in the nav release, and its
 * failure mode (focus escaping the dialog, a stranded scroll-lock) is
 * invisible to screenshot suites.
 *
 * Driven against the academic-chapters fixture (port 4176; built + served by
 * playwright.fixtures.config.ts) — chapter pages carry showSidebar=true, so
 * the hamburger + drawer render. The drawer applies BELOW 80rem (1280px):
 * layout.css hides .nav-toggle/.nav-drawer at ≥80rem and the controller
 * auto-closes when the viewport crosses in. Most tests therefore run under
 * the `mobile` project (768px) and skip `desktop`; the visibility test does
 * the reverse.
 *
 * The controller is an is:inline script — NOT an astro-island — so there is
 * no hydration marker to await (contrast section-map-interaction.spec.ts);
 * the toggle is actionable as soon as the script runs.
 *
 * Assertions only (no toHaveScreenshot) — behavior is the contract here.
 */
const BASE = 'http://127.0.0.1:4176';
const CH = `${BASE}/chapters/found-week1/`;

const DRAWER = '#nav-drawer';
const TOGGLE = '#nav-toggle';
const PANEL = '.nav-drawer-panel';
const LOCK = 'nav-drawer-locked';

function onMobile(page: Page): boolean {
  const vp = page.viewportSize();
  return !!vp && vp.width < 1280;
}

async function expectClosed(page: Page): Promise<void> {
  await expect(page.locator(DRAWER)).not.toHaveClass(/\bis-open\b/);
  await expect(page.locator(TOGGLE)).toHaveAttribute('aria-expanded', 'false');
  const locked = await page.evaluate(
    (cls) => document.documentElement.classList.contains(cls),
    LOCK,
  );
  expect(locked, 'scroll-lock class must be released when closed').toBe(false);
}

async function open(page: Page): Promise<void> {
  await page.locator(TOGGLE).click();
  await expect(page.locator(DRAWER)).toHaveClass(/\bis-open\b/);
  await expect(page.locator(TOGGLE)).toHaveAttribute('aria-expanded', 'true');
}

test.describe('nav drawer controller (#183, v4.26.0 #80)', () => {
  test('mobile: opens on toggle — is-open + aria-expanded + scroll-lock + focus enters dialog, no hash pushed', async ({
    page,
  }) => {
    test.skip(!onMobile(page), 'drawer applies below 80rem');
    await page.goto(CH);
    await expectClosed(page);

    await open(page);
    const locked = await page.evaluate(
      (cls) => document.documentElement.classList.contains(cls),
      LOCK,
    );
    expect(locked, 'documentElement must carry the scroll-lock class while open').toBe(true);
    // The JS path preventDefaults the anchor — no #nav-drawer history entry.
    expect(new URL(page.url()).hash, 'controller must not push the :target hash').toBe('');
    // Focus moved inside the dialog (first focusable = the dismiss link).
    const focusInPanel = await page.evaluate(
      (sel) => !!document.activeElement?.closest(sel),
      PANEL,
    );
    expect(focusInPanel, 'focus must move into the dialog on open').toBe(true);
  });

  test('mobile: ESC closes, releases the lock, and restores focus to the opener', async ({
    page,
  }) => {
    test.skip(!onMobile(page), 'drawer applies below 80rem');
    await page.goto(CH);
    await open(page);

    await page.keyboard.press('Escape');
    await expectClosed(page);
    await expect(page.locator(TOGGLE), 'focus must return to the opener').toBeFocused();
  });

  test('mobile: role=button toggle activates with Space without scrolling', async ({ page }) => {
    test.skip(!onMobile(page), 'drawer applies below 80rem');
    await page.goto(CH);
    await page.locator(TOGGLE).focus();
    const before = await page.evaluate(() => window.scrollY);

    await page.keyboard.press('Space');
    await expect(page.locator(DRAWER)).toHaveClass(/\bis-open\b/);
    expect(await page.evaluate(() => window.scrollY)).toBe(before);

    await page.locator(TOGGLE).focus();
    await page.keyboard.press('Space');
    await expectClosed(page);
  });

  test('mobile: backdrop and dismiss both close via [data-nav-close]', async ({ page }) => {
    test.skip(!onMobile(page), 'drawer applies below 80rem');
    await page.goto(CH);

    await open(page);
    await page.locator('.nav-drawer-dismiss').click();
    await expectClosed(page);

    await open(page);
    // The backdrop is aria-hidden/tabindex=-1 by design (it duplicates the
    // dismiss affordance for pointer users) — force past the a11y-tree check,
    // and click its RIGHT side: the panel slides in over the left edge, so a
    // top-left click would land on the panel, not the backdrop.
    await page
      .locator('.nav-drawer-backdrop')
      .click({ force: true, position: { x: 700, y: 400 } });
    await expectClosed(page);
  });

  test('mobile: Tab wraps inside the dialog in both directions (focus trap)', async ({ page }) => {
    test.skip(!onMobile(page), 'drawer applies below 80rem');
    await page.goto(CH);
    await open(page);

    const ids = await page.evaluate((sel) => {
      const panel = document.querySelector(sel)!;
      const els = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
      return { count: els.length };
    }, PANEL);
    expect(ids.count, 'the dialog must contain focusable nav links').toBeGreaterThan(1);

    // Shift+Tab from the FIRST focusable must wrap to the LAST.
    const atFirstThenBack = await page.evaluate((sel) => {
      const panel = document.querySelector(sel)!;
      const els = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
      els[0].focus();
      return document.activeElement === els[0];
    }, PANEL);
    expect(atFirstThenBack).toBe(true);
    await page.keyboard.press('Shift+Tab');
    const wrappedToLast = await page.evaluate((sel) => {
      const panel = document.querySelector(sel)!;
      const els = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
      return document.activeElement === els[els.length - 1];
    }, PANEL);
    expect(wrappedToLast, 'Shift+Tab from the first focusable must wrap to the last').toBe(true);

    // Tab from the LAST must wrap back to the FIRST.
    await page.keyboard.press('Tab');
    const wrappedToFirst = await page.evaluate((sel) => {
      const panel = document.querySelector(sel)!;
      const els = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
      return document.activeElement === els[0];
    }, PANEL);
    expect(wrappedToFirst, 'Tab from the last focusable must wrap to the first').toBe(true);
  });

  test('mobile: resize across 80rem auto-closes and releases the scroll-lock (F1 regression armor)', async ({
    page,
  }) => {
    test.skip(!onMobile(page), 'starts in the drawer regime');
    await page.goto(CH);
    await open(page);

    // Cross into the desktop range: drawer goes display:none; the controller's
    // matchMedia listener must clear .is-open AND the scroll-lock, else the
    // page is stranded unscrollable under an invisible drawer.
    await page.setViewportSize({ width: 1300, height: 900 });
    await expect(page.locator(DRAWER)).not.toHaveClass(/\bis-open\b/);
    const locked = await page.evaluate(
      (cls) => document.documentElement.classList.contains(cls),
      LOCK,
    );
    expect(locked, 'scroll-lock must not survive the crossing into >=80rem').toBe(false);
  });

  test('mobile: a :target-opened drawer (no-JS deep link) is still closable via ESC', async ({
    page,
  }) => {
    test.skip(!onMobile(page), 'drawer applies below 80rem');
    // Arrive with the hash — the CSS :target fallback shows the drawer even
    // though JS is active; isOpen() counts this state so ESC must close it
    // and clear the hash (the post-review hardening of #80).
    await page.goto(`${CH}#nav-drawer`);
    await page.keyboard.press('Escape');
    await expect(page.locator(DRAWER)).not.toHaveClass(/\bis-open\b/);
    expect(new URL(page.url()).hash, 'ESC must clear the :target hash').toBe('');
    const locked = await page.evaluate(
      (cls) => document.documentElement.classList.contains(cls),
      LOCK,
    );
    expect(locked).toBe(false);
  });

  test('desktop: hamburger and drawer are display:none at ≥80rem (sidebar is the nav)', async ({
    page,
  }) => {
    test.skip(onMobile(page), 'sidebar regime only');
    await page.goto(CH);
    await expect(page.locator(TOGGLE)).toBeHidden();
    await expect(page.locator(DRAWER)).toBeHidden();
    await expect(page.locator('aside.sidebar')).toBeVisible();
  });
});
