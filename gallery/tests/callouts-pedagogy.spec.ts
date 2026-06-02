import { test, expect } from '@playwright/test';
import { lightAndDark } from './_shot';

// Phase 2 (hybrid scope): the pedagogy callout family × light/dark, plus
// WorkedExample's interactive <details> — assert the `expanded` instance is
// open and the default instance is collapsed (the interaction state run.sh
// could never drive).
test('callouts — pedagogy family + WorkedExample states (light + dark)', async ({ page }) => {
  await page.goto('/callouts-pedagogy/');

  const expanded = page.locator('[data-gallery="workedexample-expanded"] details');
  const collapsed = page.locator('[data-gallery="workedexample-collapsed"] details');
  await expect(expanded).toHaveJSProperty('open', true);
  await expect(collapsed).toHaveJSProperty('open', false);

  await lightAndDark(page, 'callouts-pedagogy');
});
