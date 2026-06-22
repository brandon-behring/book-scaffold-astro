import { test, expect } from '@playwright/test';

/* Gating layout-overflow guard — docs/responsive-reading.md (#171 review, A1).
 *
 * The v4.25.3 code break-out widens `.prose > pre` to `--measure-code` and
 * centers it within `.prose`. With the docs-style LEFT SIDEBAR (all fixtures,
 * ≥1024px) the prose column is offset from viewport centre, so the break-out
 * must stay CONTAINER-bounded and never push the whole PAGE into horizontal
 * scroll (WCAG 1.4.10 reflow). A viewport-bounded (`100vw`) width overflowed the
 * page ~8px at the 1024px sidebar boundary — this renders a wide-code chapter
 * under the sidebar at three desktop widths and asserts the document never
 * scrolls sideways.
 *
 * GATING (unlike the warning-level equation-overflow check): a horizontal page
 * scroll is a layout bug, not an authoring choice. Viewports are set in-test, so
 * it runs once per width under the `desktop` project. */

const ROUTE = { port: 4175, path: '/chapters/wide-code/' }; // research-portfolio
const WIDTHS = [1024, 1280, 1440]; // sidebar regime (≥64rem): 16rem then 18rem track

test.describe('layout-overflow (sidebar + wide code)', () => {
  for (const width of WIDTHS) {
    test(`no horizontal page scroll @${width}px`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'viewport set in-test; run once per width');
      await page.setViewportSize({ width, height: 900 });
      const resp = await page.goto(`http://127.0.0.1:${ROUTE.port}${ROUTE.path}`);
      expect(resp?.ok(), `${ROUTE.path} should respond 2xx`).toBeTruthy();
      const m = await page.evaluate(() => {
        const de = document.documentElement;
        return { scrollW: de.scrollWidth, clientW: de.clientWidth };
      });
      expect(
        m.scrollW - m.clientW,
        `page scrolls horizontally by ${m.scrollW - m.clientW}px at ${width}px ` +
          `(scrollWidth ${m.scrollW} > clientWidth ${m.clientW}) — the code break-out overflows ` +
          `the page under the sidebar; keep the break-out width container-bounded, not 100vw ` +
          `(docs/responsive-reading.md).`,
      ).toBeLessThanOrEqual(1);
    });
  }
});
