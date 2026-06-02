import { test } from '@playwright/test';
import { lightAndDark } from './_shot';

// Phase 2 (hybrid scope): the academic callout family (incl. Theorem kinds) ×
// light/dark.
test('callouts — academic family (light + dark)', async ({ page }) => {
  await page.goto('/callouts-academic/');
  await page.locator('[data-gallery="notebox"]').waitFor();
  await lightAndDark(page, 'callouts-academic');
});
