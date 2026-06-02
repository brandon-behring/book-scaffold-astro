import { test, expect } from '@playwright/test';

// #103 / v4.14.2: the `book:theme:change` hook. CSS-token elements recolor from
// the [data-theme] attribute; canvas/JS islands can't, so they listen to the
// event and repaint. Toggle the theme and assert BOTH a full-page recolor
// (light/dark screenshots) AND that the canvas corner pixel changed — the
// honest proof that the event fired and the island redrew (independent of CSS).
test('theme — toggle recolors CSS + canvas via book:theme:change', async ({ page }) => {
  await page.goto('/theme/');
  await page.locator('#theme-canvas').waitFor();

  const cornerPixel = () =>
    page.evaluate(() => {
      const c = document.getElementById('theme-canvas') as HTMLCanvasElement;
      return Array.from(c.getContext('2d')!.getImageData(2, 2, 1, 1).data);
    });

  const before = await cornerPixel();
  await expect(page).toHaveScreenshot('theme-light.png', { fullPage: true });

  await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  const after = await cornerPixel();
  expect(
    after,
    'canvas corner pixel must change after toggle → book:theme:change fired + island repainted',
  ).not.toEqual(before);

  await expect(page).toHaveScreenshot('theme-dark.png', { fullPage: true });
});
