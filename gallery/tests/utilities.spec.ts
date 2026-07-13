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

  // BookLink (#96): resolves the sibling-book base URL from the registry stub.
  await expect(page.locator('[data-gallery="booklink"] a')).toHaveAttribute(
    'href',
    'https://design.example/chapters/patterns/#layered',
  );

  // #161/#164: a generated SVG is inlined, drops standalone defaults, keeps
  // its mapping rules, and resolves semantic vs ordinal tokens from the host.
  const figure = page.locator('#fig-sample');
  const semantic = figure.locator('#palette-semantic');
  const series = figure.locator('#palette-series');
  await expect(figure.getByRole('img', { name: 'A semantic stage beside a dashed categorical series' })).toBeVisible();
  await expect(figure.locator('style[data-diagram-theme]')).toHaveCount(0);
  await expect(figure.locator('style[data-diagram-map="2"]')).toHaveCount(1);
  await expect(semantic).toHaveAttribute('fill-opacity', '0.14');
  await expect(series).toHaveAttribute('stroke-dasharray', '10 6');
  await expect(figure.locator('#palette-series-marker')).toHaveCount(1);
  await expect(figure).toContainText('Series 1 — dashed + marker');

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  expect(await semantic.evaluate((element) => getComputedStyle(element).fill)).toBe('rgb(59, 111, 160)');
  expect(await semantic.evaluate((element) => getComputedStyle(element).stroke)).toBe('rgb(59, 111, 160)');
  expect(await series.evaluate((element) => getComputedStyle(element).stroke)).toBe('rgb(230, 159, 0)');

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await expect.poll(() => semantic.evaluate((element) => getComputedStyle(element).fill))
    .toBe('rgb(114, 151, 187)');
  await expect.poll(() => semantic.evaluate((element) => getComputedStyle(element).stroke))
    .toBe('rgb(114, 151, 187)');
  expect(await series.evaluate((element) => getComputedStyle(element).stroke)).toBe('rgb(230, 159, 0)');

  // lightAndDark owns the committed screenshots and expects light first.
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));

  await lightAndDark(page, 'utilities');
});
