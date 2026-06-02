import { test, expect } from '@playwright/test';

// #82: the Provenance block renders as a collapsed <details>, and on real
// chapter pages it sits below the old 2000px screenshot fold — so the legacy
// run.sh could never capture its body. Here we render it near the top of a
// dedicated gallery page and EXPAND it via interaction, then full-page
// screenshot — honest coverage of the populated body + the empty fallback,
// with no `open` prop / no component change.
test('provenance — expanded populated body + empty fallback', async ({ page }) => {
  await page.goto('/provenance/');

  // Expand every <details> (collapsed by default). Force the open state via the
  // DOM — deterministic; avoids click/animation races.
  await page.locator('details').first().waitFor();
  await page.evaluate(() =>
    document.querySelectorAll('details').forEach((d) => (d.open = true)),
  );
  await expect(page.locator('details[open]')).toHaveCount(2);

  // #82's crux: the POPULATED body must actually render its deep content — the
  // exact coverage the 2000px fold could never reach. Assert the body and a
  // leaf-level element (the citation-backstop badge) are visible, not merely
  // that <details> is open. And the empty instance must show the fallback.
  const populated = page.locator('[data-gallery="provenance-populated"]');
  await expect(populated.locator('.provenance-body')).toBeVisible();
  await expect(populated.locator('.provenance-badge')).toHaveText('research-kb');
  await expect(
    page.locator('[data-gallery="provenance-empty"] .provenance-fallback'),
  ).toBeVisible();

  await expect(page).toHaveScreenshot('provenance.png', { fullPage: true });
});
