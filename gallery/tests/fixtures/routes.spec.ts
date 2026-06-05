import { test, expect } from '@playwright/test';

// The exact routes run.sh covered (package/tests/visual/run.sh FIXTURES), ported
// to full-page Playwright snapshots. One test per route × 2 viewport projects.
const FIXTURES: { name: string; port: number; routes: string[] }[] = [
  { name: 'academic', port: 4173, routes: ['/', '/chapters/full/', '/chapters/minimal/'] },
  { name: 'course-notes', port: 4174, routes: ['/', '/chapters/example/', '/print/'] },
  {
    name: 'research-portfolio',
    port: 4175,
    // example.mdx has `slug: ch01-fixture` → served at /chapters/ch01-fixture/
    // (run.sh's /chapters/example/ was a stale 404 it silently screenshotted).
    routes: ['/', '/chapters/ch01-fixture/', '/chapters/ch02-math/', '/frontmatter/title-page/'],
  },
  {
    name: 'academic-chapters',
    port: 4176,
    routes: ['/', '/chapters/', '/chapters/found-week1/', '/chapters/synth-week5/'],
  },
  {
    name: 'pedagogy',
    port: 4177,
    routes: [
      '/',
      '/chapters/01-pitfall/',
      '/chapters/02-worked-example/',
      '/chapters/03-you-will-learn/',
      '/chapters/04-poc-layout/',
    ],
  },
  {
    name: 'book-genre',
    port: 4178,
    // v4.17.0 (#112/#117): /practice-exam (questions collection → static bank
    // with reveals) + /objective-map (auto-derived domain×chapter coverage).
    routes: [
      '/',
      '/chapters/01-tips/',
      '/chapters/02-exercises/',
      '/tips/',
      '/exercises/',
      '/practice-exam/',
      '/objective-map/',
    ],
  },
];

function slug(path: string): string {
  if (path === '/') return 'index';
  return path.replace(/^\/+|\/+$/g, '').replace(/\//g, '-');
}

for (const fx of FIXTURES) {
  test.describe(fx.name, () => {
    for (const path of fx.routes) {
      test(slug(path), async ({ page }) => {
        const resp = await page.goto(`http://127.0.0.1:${fx.port}${path}`);
        expect(resp?.ok(), `${fx.name}${path} should respond 2xx`).toBeTruthy();
        await expect(page).toHaveScreenshot(`${fx.name}-${slug(path)}.png`, { fullPage: true });
      });
    }
  });
}
