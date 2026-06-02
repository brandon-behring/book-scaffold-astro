import { type Page, expect } from '@playwright/test';

// Capture a gallery page in BOTH themes: light (default), then dark by flipping
// `html[data-theme]` (tokens.css scopes dark on `:root[data-theme="dark"]`, so
// setting it on <html> recolors the whole subtree). This is the differentiator
// the legacy viewport-screenshot run.sh never had — dark-mode coverage per
// family. `animations: 'disabled'` (Playwright default for toHaveScreenshot)
// avoids transition races.
export async function lightAndDark(page: Page, base: string) {
  await expect(page).toHaveScreenshot(`${base}-light.png`, { fullPage: true });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await expect(page).toHaveScreenshot(`${base}-dark.png`, { fullPage: true });
}
