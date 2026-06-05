import { test, expect } from '@playwright/test';
import { lightAndDark } from './_shot';

// Phase 2 (hybrid scope): standalone + small-fixture-backed utilities × light/dark.
// (Book-coupled chrome — Sidebar/ChapterNav/ChapterHeader/Citation — is deferred
// to Phase 3 route snapshots, which give real chapter/collection context.)
test('utilities — standalone + data-backed (light + dark)', async ({ page }) => {
  await page.goto('/utilities/');
  await page.locator('[data-gallery="statusbadge"]').waitFor();

  // Cite + XRef resolved from the gallery's fixture data files.
  await expect(page.locator('[data-gallery="cite"] a').first()).toBeVisible();
  await expect(page.locator('[data-gallery="xref"]')).toContainText('Theorem 4.2');
  await expect(page.locator('[data-gallery="xref"]')).toContainText('[?missing-id]');

  // ChapterTOC is a native <details>; force it open so the TOC list is captured.
  const toc = page.locator('[data-gallery="chaptertoc"] details');
  await expect(toc).toHaveCount(1);
  await page.evaluate(() =>
    document
      .querySelectorAll('[data-gallery="chaptertoc"] details')
      .forEach((d) => ((d as HTMLDetailsElement).open = true)),
  );

  // CodeRef/CodeBlock (#109): links resolve to the *configured* repo (the
  // gallery stub's brandon-behring/book-scaffold-astro), not the old hardcoded
  // post_transformers default. Functional assertion — would have caught #109.
  await expect(page.locator('[data-gallery="coderef"] a').first()).toHaveAttribute(
    'href',
    /github\.com\/brandon-behring\/book-scaffold-astro\/blob\/main\/.*repo-url\.ts#L51-L71/,
  );
  await expect(page.locator('[data-gallery="codeblock"] a')).toHaveAttribute(
    'href',
    /github\.com\/brandon-behring\/book-scaffold-astro\/blob\/main\/package\.json/,
  );

  await lightAndDark(page, 'utilities');
});
