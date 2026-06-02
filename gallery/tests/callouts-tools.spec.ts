import { test } from '@playwright/test';
import { lightAndDark } from './_shot';

// Phase 2 (hybrid scope): the tools callout family × light/dark. The dark
// capture is coverage run.sh never had — it surfaces any callout whose tint
// doesn't adapt to the dark token scope.
test('callouts — tools family (light + dark)', async ({ page }) => {
  await page.goto('/callouts-tools/');
  await page.locator('[data-gallery="skillbox"]').waitFor();
  await lightAndDark(page, 'callouts-tools');
});
