import { expect, test } from '@playwright/test';

/**
 * #187 gating regression: a cold Roboto response delayed by 2.2 seconds used
 * to swap after paint and move the complete sidebar prose layout (CLS 0.229 in
 * this fixture; 0.274 in field data). `font-display: optional` must keep every
 * responsive state inside the Core Web Vitals "good" threshold.
 */

const ROUTE = 'http://127.0.0.1:4175/chapters/ch02-math/';
const WIDTHS = [390, 768, 1280, 1440];
const FONT_DELAY_MS = 2_200;

type ShiftState = {
  value: number;
  entries: Array<{ value: number; startTime: number; sources: string[] }>;
};

test.describe('delayed Roboto layout stability (#187)', () => {
  for (const width of WIDTHS) {
    test(`CLS stays good at ${width}px`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'viewport set in-test; run once per width');
      await page.setViewportSize({ width, height: 900 });

      await page.addInitScript(() => {
        const state: ShiftState = { value: 0, entries: [] };
        (window as typeof window & { __bookScaffoldShiftState: ShiftState })
          .__bookScaffoldShiftState = state;

        new PerformanceObserver((list) => {
          const entries = list.getEntries() as Array<PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
            sources?: Array<{ node?: Node }>;
          }>;
          for (const entry of entries) {
            if (entry.hadRecentInput) continue;
            const sources = (entry.sources ?? []).map(({ node }) => {
              if (!(node instanceof Element)) return 'unknown';
              return `${node.tagName}.${node.className}`;
            });
            state.value += entry.value;
            state.entries.push({ value: entry.value, startTime: entry.startTime, sources });
          }
        }).observe({ type: 'layout-shift', buffered: true });
      });

      await page.route(/roboto-.*\.woff2(?:\?.*)?$/, async (route) => {
        await new Promise((resolve) => setTimeout(resolve, FONT_DELAY_MS));
        await route.continue();
      });

      const response = await page.goto(ROUTE, { waitUntil: 'domcontentloaded' });
      expect(response?.ok(), `${ROUTE} should respond 2xx`).toBeTruthy();
      await page.waitForTimeout(FONT_DELAY_MS + 800);

      const state = await page.evaluate(
        () => (window as typeof window & { __bookScaffoldShiftState: ShiftState })
          .__bookScaffoldShiftState,
      );
      expect(
        state.value,
        `CLS ${state.value.toFixed(4)} exceeds 0.1 at ${width}px: ` +
          JSON.stringify(state.entries),
      ).toBeLessThanOrEqual(0.1);
    });
  }

  test('built output keeps the font policy narrowly scoped', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'CSS contract needs one browser project');
    const response = await page.goto(ROUTE);
    expect(response?.ok(), `${ROUTE} should respond 2xx`).toBeTruthy();

    const preload = page.locator(
      'link[rel="preload"][as="font"][href*="roboto-latin-wght-normal"]',
    );
    await expect(preload).toHaveCount(1);
    await expect(preload).toHaveAttribute('type', 'font/woff2');
    await expect(preload).toHaveAttribute('crossorigin', 'anonymous');

    const faces = await page.evaluate(async () => {
      const hrefs = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))
        .map(({ href }) => href);
      const css = (await Promise.all(hrefs.map(async (href) => (await fetch(href)).text())))
        .join('\n');
      return css.match(/@font-face\s*\{[^}]+\}/g) ?? [];
    });

    const roboto = faces.filter((face) => face.includes('Roboto Variable'));
    const sourceCode = faces.filter((face) => face.includes('Source Code Pro Variable'));
    const katex = faces.filter((face) => face.includes('KaTeX_Main'));
    expect(roboto.length).toBeGreaterThan(0);
    expect(roboto.every((face) => /font-display:\s*optional/.test(face))).toBe(true);
    expect(sourceCode.length).toBeGreaterThan(0);
    expect(sourceCode.every((face) => /font-display:\s*swap/.test(face))).toBe(true);
    expect(katex.length).toBeGreaterThan(0);
    expect(katex.every((face) => /font-display:\s*block/.test(face))).toBe(true);
  });
});
