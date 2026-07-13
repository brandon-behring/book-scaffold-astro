import { test, expect } from '@playwright/test';

test('demo substrate — interaction, theme redraw, reduced motion, and visuals', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('theme', 'light');
    const listeners = new Set<EventListenerOrEventListenerObject>();
    const add = window.addEventListener;
    const remove = window.removeEventListener;
    window.addEventListener = function (type, listener, options) {
      if (type === 'book:theme:change' && listener) listeners.add(listener);
      return add.call(this, type, listener, options);
    };
    window.removeEventListener = function (type, listener, options) {
      if (type === 'book:theme:change' && listener) listeners.delete(listener);
      return remove.call(this, type, listener, options);
    };
    Object.defineProperty(window, '__bookThemeListenerCount', {
      get: () => listeners.size,
    });
  });

  const serverResponse = await page.request.get('/demo-substrate/');
  const serverHtml = await serverResponse.text();
  const serverGeneratedIds = [...serverHtml.matchAll(/ id="(demo-(?:slider-)?[^"]+)"/g)]
    .map((match) => match[1]);
  await page.goto('/demo-substrate/');

  const frame = page.locator('#gallery-demo-substrate');
  const slider = page.getByRole('slider', { name: 'Sample size' });
  const hookMark = page.getByTestId('hook-themed-mark');
  const cssMark = page.getByTestId('css-themed-mark');

  await expect(frame).toHaveAttribute('aria-labelledby', 'gallery-demo-substrate-title');
  await expect(page.getByRole('img', { name: /Uncertainty by sample size/ })).toBeVisible();
  await expect(slider).toHaveAttribute('aria-valuetext', '40 observations');
  await expect(page.getByTestId('theme-status')).toHaveText('light');
  const hydratedGeneratedIds = await page
    .locator('[data-demo-contract-fixtures] [id^="demo-"]')
    .evaluateAll((elements) => elements.map((element) => element.id));
  expect(hydratedGeneratedIds).toEqual(serverGeneratedIds);
  expect(new Set(hydratedGeneratedIds).size).toBe(hydratedGeneratedIds.length);
  expect(hydratedGeneratedIds).toHaveLength(4);

  const switchedFallback = await page.getByTestId('theme-spec-toggle').evaluate(async (element) => {
    (element as HTMLButtonElement).click();
    await Promise.resolve();
    return document.querySelector('[data-testid="theme-spec-value"]')?.textContent;
  });
  expect(switchedFallback).toBe('#345678');
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

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(frame).toHaveCSS('margin-left', '0px');
  await expect(frame).toHaveCSS('margin-right', '0px');
  const mobileBox = await frame.boundingBox();
  expect(mobileBox?.width).toBeGreaterThan(340);

  await expect.poll(() => page.evaluate(
    () => (window as Window & { __bookThemeListenerCount: number }).__bookThemeListenerCount,
  )).toBe(2);
  await page.locator('astro-island').evaluateAll((elements) => {
    for (const element of elements) element.remove();
  });
  await page.evaluate(() => document.dispatchEvent(new Event('astro:after-swap')));
  await expect.poll(() => page.evaluate(
    () => (window as Window & { __bookThemeListenerCount: number }).__bookThemeListenerCount,
  )).toBe(0);
});

test('demo substrate resolves reduced motion before animation is allowed', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/demo-substrate/');

  await expect(page.getByTestId('motion-status')).toHaveText('true');
  const duration = await page.getByTestId('motion-sample').evaluate(
    (element) => Number.parseFloat(getComputedStyle(element).animationDuration),
  );
  expect(duration).toBeLessThan(0.001);
});
