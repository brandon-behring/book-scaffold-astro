import { test, expect } from '@playwright/test';

test('demo substrate — interaction, theme redraw, reduced motion, and visuals', async ({ page }) => {
  await page.addInitScript(() => {
    document.documentElement.setAttribute('data-theme', 'light');
  });
  await page.goto('/demo-substrate/');

  const frame = page.locator('#gallery-demo-substrate');
  const slider = page.getByRole('slider', { name: 'Sample size' });
  const hookMark = page.getByTestId('hook-themed-mark');
  const cssMark = page.getByTestId('css-themed-mark');

  await expect(frame).toHaveAttribute('aria-labelledby', 'gallery-demo-substrate-title');
  await expect(page.getByRole('img', { name: /Uncertainty by sample size/ })).toBeVisible();
  await expect(slider).toHaveAttribute('aria-valuetext', '40 observations');
  await expect(page.getByTestId('theme-status')).toHaveText('light');
  await expect(page).toHaveScreenshot('demo-substrate-light.png', { fullPage: true });

  const hookFillBefore = await hookMark.getAttribute('fill');
  const cssStrokeBefore = await cssMark.evaluate((element) => getComputedStyle(element).stroke);
  await page.getByRole('button', { name: 'Toggle demo theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByTestId('theme-status')).toHaveText('dark');
  await expect.poll(() => hookMark.getAttribute('fill')).not.toBe(hookFillBefore);
  await expect.poll(
    () => cssMark.evaluate((element) => getComputedStyle(element).stroke),
  ).not.toBe(cssStrokeBefore);
  await expect(page).toHaveScreenshot('demo-substrate-dark.png', { fullPage: true });

  await slider.evaluate((element) => {
    const input = element as HTMLInputElement;
    input.value = '80';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(slider).toHaveValue('80');
  await expect(slider).toHaveAttribute('aria-valuetext', '80 observations');
  await expect(page.locator('.demo-stat-card__value').filter({ hasText: /^80$/ })).toBeVisible();

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.getByTestId('motion-status')).toHaveText('true');
  await expect.poll(async () => {
    const duration = await page.getByTestId('motion-sample').evaluate(
      (element) => getComputedStyle(element).animationDuration,
    );
    return Number.parseFloat(duration);
  }).toBeLessThan(0.001);
});
